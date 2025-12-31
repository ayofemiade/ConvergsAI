from typing import List, AsyncIterable
from livekit.agents import llm
from app.services.cerebras import cerebras_service
from app.agent.sales_agent import sales_agent
import app.agent.memory as memory
from app.agent.stages import SalesStage
from app.logging import logger

class CerebrasLLM(llm.LLM):
    def __init__(self):
        super().__init__()

    async def chat(self, chat_ctx: llm.ChatContext) -> AsyncIterable[llm.ChatChunk]:
        """
        Adapts Cerebras Service to LiveKit LLM interface with Stage Control & Hardening.
        """
        session_id = "livekit_voice" # Default session for voice
        
        # 1. Sync latest user message to SalesAgent memory
        user_text = ""
        if chat_ctx.messages:
            last_msg = chat_ctx.messages[-1]
            if last_msg.role == llm.ChatRole.USER:
                user_text = last_msg.content
                sales_agent.update_memory(session_id, "user", user_text)

        # 2. Get current state & history
        current_stage = memory.session_memory.get_metadata(session_id, "stage")
        if isinstance(current_stage, str):
            current_stage = SalesStage(current_stage)
        history = memory.session_memory.get_history(session_id)

        # 3. Analyze Input (Intent + Info Extraction)
        analysis = {"intent": "other", "recommended_action": "stay", "extracted_info": {}}
        if user_text:
            from app.agent.analyzer import analyzer
            analysis = await analyzer.analyze(user_text, history, current_stage)
            logger.info(f"[CerebrasLLM-Analyzer] session={session_id} intent={analysis.get('intent')}")

            # Update Metadata with extracted info
            from app.agent.intelligence import PRICING_GATE_METADATA_KEY
            for key, val in analysis.get("extracted_info", {}).items():
                if val is not None:
                    memory.session_memory.set_metadata(session_id, key, val)
                    if key == "value_accepted" and val is True:
                         memory.session_memory.set_metadata(session_id, PRICING_GATE_METADATA_KEY, True)

        # 4. Get governed system prompt and stage
        system_prompt, final_stage = sales_agent.prepare_payload(session_id)
        
        # 5. Build messages for Cerebras (System + History)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)

        # Add extra instruction if intent was vague
        if analysis.get("is_vague"):
            messages.append({"role": "system", "content": "The user was vague or evasive. Gently but firmly ask for the missing information before proceeding."})

        logger.info(f"[CerebrasLLM] Stage: {final_stage.value} | Turns: {memory.session_memory.turns_in_stage(session_id)}")
        
        response_text = await cerebras_service.chat_completion(messages)
        
        # 6. Sync assistant response back
        sales_agent.update_memory(session_id, "assistant", response_text)
        
        # 7. Advance Stage Machine logic
        sales_agent.advance_logic(session_id, final_stage, analysis)
        
        # Yield the response as a single chunk (LiveKit LLM interface)
        yield llm.ChatChunk(
            choices=[
                llm.Choice(
                    delta=llm.ChoiceDelta(role="assistant", content=response_text),
                    index=0
                )
            ]
        )

# Factory function
def get_llm():
    return CerebrasLLM()
