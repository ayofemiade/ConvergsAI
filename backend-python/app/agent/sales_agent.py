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

    def prepare_payload(self, session_id: str, skip_nudge: bool = False) -> Tuple[str, SalesStage]:
        """
        Calculates the correct system prompt and current stage based on memory.
        Applies guardrails, semantic locks, pricing gates, and nudges.
        """
        # ---------- Metadata ----------
        from app.agent.prompts import SUPPORT_MODE_MODIFIER
        
        mode_type = memory.session_memory.get_metadata(session_id, "mode_type") or "sales"
        persona_name = memory.session_memory.get_metadata(session_id, "persona_name") or "Emma"
        custom_prompt = memory.session_memory.get_metadata(session_id, "custom_prompt")
        
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
        # Adjust Persona Identity
        base_persona = BASE_AGENT_PROMPT.replace("senior human sales and customer support professional", f"senior professional named {persona_name}")
        
        system_prompt = DETERMINISTIC_SYSTEM_PROMPT + "\n" + base_persona + context_summary
        
        # Add mode-specific behavior
        if mode_type == "support":
            system_prompt += "\n" + SUPPORT_MODE_MODIFIER
        
        # Add custom instructions if provided
        if custom_prompt:
            system_prompt += f"\n\n[PERSONA INSTRUCTIONS]\n{custom_prompt}"
        
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
        if nudge_text and not skip_nudge:
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
        missing_critical = False
        for field in required_info:
            val = memory.session_memory.get_metadata(session_id, field)
            if not val:
                # [SOFT ADVANCEMENT]
                # If we have clear Pain Points or Intent, we can often advance even if 
                # we don't know their specific Role/Company yet.
                if intent in ["sharing_pain", "interest"] and field in ["role", "company"]:
                    logger.info(f"[Flow] Soft Advance: Missing '{field}' but intent is '{intent}'. Allowing.")
                    continue
                
                logger.info(f"[Flow] Missing required info '{field}' for stage {current_stage.value}. Staying.")
                missing_critical = True
                break
        
        if missing_critical:
            should_advance = False

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

    async def generate_stream(self, session_id: str, text: str):
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
        
        # --- LOOP BREAKER LOGIC (Intelligence: Reset on substantive content) ---
        clean_text = text.strip().lower()
        # If the user's text is long or doesn't look like a greeting, it's substantive
        is_substantive = len(clean_text) > 15 or clean_text not in ["hello", "hi", "hey", "hello?", "hi there", "inquiry", "inquiry."]
        is_generic_greeting = clean_text in ["hello", "hi", "hey", "hello?", "hi there"]
        
        greeting_count = memory.session_memory.get_metadata(session_id, "greeting_loop_count") or 0
        
        if is_generic_greeting:
            greeting_count += 1
            memory.session_memory.set_metadata(session_id, "greeting_loop_count", greeting_count)
            logger.info(f"[SalesAgent] Greeting Loop Count: {greeting_count}")
        elif is_substantive:
            # User actually said something else, reset the loop
            memory.session_memory.set_metadata(session_id, "greeting_loop_count", 0)
            logger.info(f"[SalesAgent] Loop Reset: Substantive input received ('{text[:20]}...')")

        # 3. Prepare Unified Payload (Generator + Analyzer instructions)
        # We skip nudges if the user is being substantive
        system_prompt, final_stage = self.prepare_payload(session_id, skip_nudge=is_substantive)
        
        # [INTELLIGENCE: Pre-Transition Awareness]
        # If the user just provided value, ensure the brain doesn't sound robotic
        # by repeating greeting-stage "nudge" filler.
        if is_substantive:
            system_prompt += "\n\n[USER IS MAKING PROGRESS]\nIgnore any 'stalling' or 'greeting' instructions. The user just shared content. Respond to their content directly and move the conversation forward."
            # If we are STILL in greeting, but they said a lot, force a mental pivot
            if final_stage == SalesStage.GREETING:
                system_prompt += "\nAct as if you are already in the QUALIFICATION or PROBLEM stage. Do not say 'How can I help you' again."

        # If we are stuck in a loop, force the agent to lead
        # ONLY if the user just sent another greeting turn
        if greeting_count > 2 and is_generic_greeting:
            from app.agent.prompts import PATTERN_INTERRUPT_MODIFIER
            system_prompt += f"\n\n{PATTERN_INTERRUPT_MODIFIER}"
            logger.info("[SalesAgent] Loop Breaker Triggered: Injecting Pattern Interrupt")
            
        # [PERCEPTUAL RECOVERY]
        # If the user provided content but history shows we previously said "Hello" (ghost guess)
        # Force an apology and pivot.
        if is_substantive and len(history) >= 2:
             last_asst = history[-2] if history[-2]["role"] == "assistant" else None
             if last_asst and last_asst["content"].strip().lower() in ["hello", "hi", "hey"]:
                 from app.agent.prompts import PERCEPTUAL_RECOVERY_MODIFIER
                 system_prompt += f"\n\n{PERCEPTUAL_RECOVERY_MODIFIER}"
                 logger.info("[SalesAgent] Force Perceptual Recovery: Overriding previous 'Ghost' greeting.")

        # Inject the combined analysis instruction
        system_prompt += f"\n\n{COMBINED_ANALYSIS_INSTRUCTION.format(current_stage=final_stage.value)}"
        
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)

        full_response_buffer = []
        is_parsing_analysis = False
        
        # --- HARDENED SAFEGUARD WINDOW ---
        safeguard_buffer = ""
        SAFEGUARD_SIZE = 25 # Increased slightly for safer word detection
        
        logger.info(f"[SalesAgent] Combined Call Start - Session: {session_id}, Stage: {final_stage.value}")
        
        tokens_yielded = 0
        analysis_patterns = ["<analysis", "analysis:", '{"intent"', '"intent":']
        
        # 4. Stream from Cerebras
        async for token in cerebras_service.stream_completion(messages, max_tokens=250):
            tokens_yielded += 1
            full_response_buffer.append(token)
            
            if is_parsing_analysis:
                continue

            safeguard_buffer += token
            lower_buf = safeguard_buffer.lower()
            
            # 1. Proactive Tag Detection
            found_tag = None
            for p in analysis_patterns:
                if p in lower_buf:
                    found_tag = p
                    break
            
            if found_tag:
                is_parsing_analysis = True
                tag_start_idx = lower_buf.find(found_tag)
                # Yield only the clean text before the tag
                clean_text = safeguard_buffer[:tag_start_idx]
                if clean_text:
                    yield clean_text
                safeguard_buffer = ""
                continue

            # 2. Latency Optimization (Safe Yield)
            # For the first turn, we can yield if we have a word and no tag risk
            # We check if the buffer ends with a space or punctuation to avoid partial words
            if tokens_yielded < 10 and any(p in safeguard_buffer for p in [" ", ".", "!", "?", "\n"]):
                # Sanity check: ensure we aren't in the middle of a word that looks like "Analysis"
                # If the buffer is short and doesn't look like any pattern start, yield it
                if not any(p.startswith(lower_buf.strip()) for p in analysis_patterns):
                    yield safeguard_buffer
                    safeguard_buffer = ""
                    continue

            # 3. Guarded Surplus Yield
            if len(safeguard_buffer) > SAFEGUARD_SIZE:
                yield_len = len(safeguard_buffer) - SAFEGUARD_SIZE
                # Only yield up to the last whitespace to keep words whole
                last_space = safeguard_buffer[:yield_len].rfind(" ")
                if last_space != -1:
                    yield safeguard_buffer[:last_space + 1]
                    safeguard_buffer = safeguard_buffer[last_space + 1:]
                else:
                    # Fallback if no space, just yield the surplus
                    yield safeguard_buffer[:yield_len]
                    safeguard_buffer = safeguard_buffer[yield_len:]

        # Flush remaining buffer if we never hit analysis
        if safeguard_buffer and not is_parsing_analysis:
            yield safeguard_buffer

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
        
        # 9. Store analysis for SalesLLM to broadcast
        memory.session_memory.set_metadata(session_id, "last_analysis", analysis)
        
        logger.info(f"[SalesAgent] Combined Call Complete - New Stage: {memory.session_memory.get_metadata(session_id, 'stage')}")

    async def generate_response(self, text: str, session_id: str) -> str:
        """Backward compatibility wrapper. Collects the stream and returns full text."""
        response_parts = []
        async for token in self.generate_stream(session_id, text):
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
