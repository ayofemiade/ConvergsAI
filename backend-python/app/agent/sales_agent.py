import asyncio
from typing import List, Tuple, Dict, Any

from app.agent.base_agent import BaseAgent
import app.agent.memory as memory
from app.agent.stages import SalesStage
from app.agent.transitions import ALLOWED_TRANSITIONS
from app.agent.prompts import (
    BASE_AGENT_PROMPT,
    VOICE_CONVERSATION_WRAPPER,
    STAGE_PROMPTS,
    PRICING_GATE_MODIFIER,
    SEMANTIC_LOCK_MODIFIER,
    NUDGE_MODIFIER,
    CLOSING_STEP_MODIFIER,
    BEHAVIORAL_REFINEMENT_PROMPT,
    DETERMINISTIC_SYSTEM_PROMPT,
)
from app.services.cerebras import cerebras_service
from app.agent.intelligence import (
    EXIT_CONDITIONS, 
    PRICING_GATE_METADATA_KEY, 
    SESSION_END_KEY, 
    ALLOWED_ADVANCE_INTENTS
)
from app.services.cerebras import cerebras_service
from app.logger_config import logger


class SalesAgent(BaseAgent):
    """
    Professional AI Sales Agent.
    Backend controls flow — LLM only generates language.
    """

    def prepare_payload(self, session_id: str) -> Tuple[str, SalesStage]:
        """
        Calculates the correct system prompt and current stage based on memory.
        Applies guardrails, semantic locks, pricing gates, and nudges.
        """
        # ---------- Metadata ----------
        mode = memory.session_memory.get_metadata(session_id, "mode")
        current_stage = memory.session_memory.get_metadata(session_id, "stage")
        value_presented = memory.session_memory.get_metadata(session_id, PRICING_GATE_METADATA_KEY) or False
        is_locked = memory.session_memory.get_metadata(session_id, SESSION_END_KEY) or False
        
        # Ensure current_stage is a SalesStage enum
        if isinstance(current_stage, str):
            current_stage = SalesStage(current_stage)

        # ---------- Guardrail: Stalling Nudge (Max 2) ----------
        turns = memory.session_memory.turns_in_stage(session_id)
        nudge_text = ""
        # Only nudge on the first 2 "stalled" turns (e.g. Turn 3 and 4)
        if 2 < turns <= 4 and current_stage != SalesStage.CLOSING:
            logger.info(f"[Guardrail] Stalling detected (Turn {turns}) in {current_stage.value}. Nudging.")
            nudge_text = NUDGE_MODIFIER.format(goal=STAGE_PROMPTS.get(current_stage, ""))
        elif turns > 4 and current_stage != SalesStage.CLOSING:
            logger.info(f"[Guardrail] Max nudges reached for {current_stage.value}. Silence on nudge.")

        # ---------- Context Injection ----------
        # Fetch all relevant metadata to keep the prompt context-aware
        role = memory.session_memory.get_metadata(session_id, "role")
        company = memory.session_memory.get_metadata(session_id, "company")
        pain_points = memory.session_memory.get_metadata(session_id, "pain_points")
        
        context_summary = f"\n[USER CONTEXT]\n- Role: {role or 'Unknown'}\n- Company: {company or 'Unknown'}\n- Identified Pain Points: {pain_points or 'None yet'}"
        
        # ---------- Prompt Generation ----------
        system_prompt = DETERMINISTIC_SYSTEM_PROMPT + "\n" + BASE_AGENT_PROMPT + context_summary
        
        # Add stage-specific precision
        stage_instruction = STAGE_PROMPTS.get(current_stage, "")
        
        # Add Semantic Lock
        system_prompt += SEMANTIC_LOCK_MODIFIER.format(
            stage=current_stage.value,
            goal=stage_instruction
        )
        
        # Add Pricing Gate
        system_prompt += f"\nValue Presented: {value_presented}"
        system_prompt += PRICING_GATE_MODIFIER

        # Add Nudge if stalling
        if nudge_text:
            system_prompt += nudge_text

        # Handle Session Lock
        if is_locked:
            system_prompt += CLOSING_STEP_MODIFIER

        # Add Behavioral Refinement
        system_prompt += f"\n\n{BEHAVIORAL_REFINEMENT_PROMPT}"

        system_prompt += f"\n\n{VOICE_CONVERSATION_WRAPPER}"

        
        return system_prompt, current_stage

    def update_memory(self, session_id: str, role: str, content: str):
        """Update session memory with a new message."""
        memory.session_memory.add_message(session_id, role, content)

    def advance_logic(self, session_id: str, current_stage: SalesStage, analysis: Dict[str, Any]):
        """
        Determines if we should advance based on analyzer recommendation, intents, and exit conditions.
        Implements smart jumping for high-priority intents.
        """
        if current_stage == SalesStage.CLOSING:
            # If meeting is locked, lock the session
            if memory.session_memory.get_metadata(session_id, "meeting_locked"):
                logger.info("[Flow] Meeting locked. Locking session.")
                memory.session_memory.set_metadata(session_id, SESSION_END_KEY, True)
            return

        intent = analysis.get("intent")
        should_advance = analysis.get("recommended_action") == "advance"
        
        # 1. Verification: Is the intent allowed for advancing?
        allowed_intents = ALLOWED_ADVANCE_INTENTS.get(current_stage, set())
        if should_advance and intent not in allowed_intents:
            logger.info(f"[Flow] Intent '{intent}' not in advance list for {current_stage.value}. Blocking advance.")
            should_advance = False

        # 2. Verify all exit conditions for the current stage are met in metadata
        required_info = EXIT_CONDITIONS.get(current_stage, [])
        for field in required_info:
            val = memory.session_memory.get_metadata(session_id, field)
            if not val:
                logger.info(f"[Flow] Missing required info '{field}' for stage {current_stage.value}. Staying.")
                should_advance = False
                break

        # 3. Smart Jumping Logic (Override transition flow)
        target_stage = None
        if current_stage == SalesStage.GREETING:
            if intent == "pricing_query":
                logger.info("[Flow] Smart Jump: GREETING -> QUALIFICATION (via pricing query)")
                target_stage = SalesStage.QUALIFICATION
            elif intent == "sharing_pain":
                logger.info("[Flow] Smart Jump: GREETING -> PROBLEM (via sharing pain)")
                target_stage = SalesStage.PROBLEM
            elif intent == "affirmation":
                logger.info("[Flow] Smart Jump: GREETING -> QUALIFICATION (via affirmation)")
                target_stage = SalesStage.QUALIFICATION

        if should_advance or target_stage:
            self._advance_stage(session_id, current_stage, target_stage=target_stage)
        else:
            logger.info(f"[Flow] Stage Lock: Staying in {current_stage.value}.")

    async def generate_stream(self, text: str, session_id: str):
        """
        Async generator that yields tokens for the assistant's human response,
        then parses the hidden <analysis> block at the end to update state.
        """
        # 1. Update user memory
        self.update_memory(session_id, "user", text)
        
        # 2. Get current state
        current_stage = memory.session_memory.get_metadata(session_id, "stage")
        if isinstance(current_stage, str):
            current_stage = SalesStage(current_stage)
        history = memory.session_memory.get_history(session_id)

        # 3. Prepare Unified Payload (Generator + Analyzer instructions)
        from app.agent.prompts import COMBINED_ANALYSIS_INSTRUCTION
        
        system_prompt, final_stage = self.prepare_payload(session_id)
        
        # Inject the combined analysis instruction
        system_prompt += f"\n\n{COMBINED_ANALYSIS_INSTRUCTION.format(current_stage=final_stage.value)}"
        
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)

        full_response_buffer = []
        is_parsing_analysis = False
        
        logger.info(f"[SalesAgent] Combined Call Start - Session: {session_id}, Stage: {final_stage.value}")
        
        # 4. Stream from Cerebras
        async for token in cerebras_service.stream_completion(messages):
            full_response_buffer.append(token)
            
            # Simple check to stop yielding once we hit the analysis block
            # This prevents the raw JSON from being spoken by the TTS
            if "<analysis>" in "".join(full_response_buffer[-10:]):
                is_parsing_analysis = True
                
            if not is_parsing_analysis:
                yield token

        full_content = "".join(full_response_buffer)
        
        # 5. Post-Stream: Extract Analysis & Update State
        try:
            if "<analysis>" in full_content and "</analysis>" in full_content:
                start = full_content.find("<analysis>") + len("<analysis>")
                end = full_content.find("</analysis>")
                analysis_json = full_content[start:end].strip()
                import json
                analysis = json.loads(analysis_json)
                
                # Human response is everything before <analysis>
                human_response = full_content[:full_content.find("<analysis>")].strip()
            else:
                logger.warning("[SalesAgent] No <analysis> block found in response.")
                human_response = full_content
                analysis = {
                    "intent": "other",
                    "extracted_info": {},
                    "is_vague": False,
                    "recommended_action": "stay"
                }
        except Exception as e:
            logger.error(f"[SalesAgent] Failed to parse combined analysis: {e}")
            human_response = full_content # Fallback
            analysis = {"intent": "other", "extracted_info": {}, "recommended_action": "stay"}

        # 6. Update Assistant Memory (Human part only)
        self.update_memory(session_id, "assistant", human_response)

        # 7. Update Metadata with extracted info
        for key, val in analysis.get("extracted_info", {}).items():
            if val is not None:
                memory.session_memory.set_metadata(session_id, key, val)
                if key == "value_accepted" and val is True:
                     memory.session_memory.set_metadata(session_id, PRICING_GATE_METADATA_KEY, True)

        # 8. Advance Stage logic
        self.advance_logic(session_id, final_stage, analysis)
        
        logger.info(f"[SalesAgent] Combined Call Complete - New Stage: {memory.session_memory.get_metadata(session_id, 'stage')}")

    async def generate_response(self, text: str, session_id: str) -> str:
        """Backward compatibility wrapper. Collects the stream and returns full text."""
        response_parts = []
        async for token in self.generate_stream(text, session_id):
            response_parts.append(token)
        return "".join(response_parts)

    def _advance_stage(self, session_id: str, current_stage: SalesStage, target_stage: SalesStage = None):
        if target_stage:
            next_stage = target_stage
        else:
            allowed = ALLOWED_TRANSITIONS.get(current_stage, [])
            next_stage = allowed[0] if allowed else None
            
        if next_stage:
            logger.info(f"[Transition] {current_stage.value} -> {next_stage.value}")
            memory.session_memory.advance_stage(session_id, next_stage)
        else:
            logger.info(f"[Flow] End of flow reached at {current_stage.value}")

    # ---------- CLI / Text Testing ----------
    def handle_text(self, text: str, session_id: str = "default") -> str:
        return asyncio.run(self.generate_response(text, session_id))


sales_agent = SalesAgent()
