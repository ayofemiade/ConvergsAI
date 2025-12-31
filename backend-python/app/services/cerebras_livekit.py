from typing import List, AsyncIterable, Optional, Any
import asyncio
from livekit.agents import llm
from app.services.cerebras import cerebras_service
from app.agent.sales_agent import sales_agent
import app.agent.memory as memory
from app.agent.stages import SalesStage
from app.logging import logger

class CerebrasLLM(llm.LLM):
    def __init__(self):
        super().__init__()

    @property
    def model(self) -> str:
        return "llama3.3-70b"

    @property
    def provider(self) -> str:
        return "cerebras"

    def chat(
        self,
        *,
        chat_ctx: llm.ChatContext,
        tools: Optional[List[Any]] = None,
        tool_choice: Any = None,
        **kwargs
    ) -> "CerebrasLLMStream":
        return CerebrasLLMStream(
            llm=self,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=kwargs.get("conn_options")
        )

class CerebrasLLMStream(llm.LLMStream):
    def __init__(
        self, 
        *, 
        llm: llm.LLM,
        chat_ctx: llm.ChatContext,
        tools: List[Any],
        conn_options: Any = None
    ):
        super().__init__(llm, chat_ctx=chat_ctx, tools=tools, conn_options=conn_options)

    async def _run(self) -> None:
        """
        Implementation of the abstract method _run from llm.LLMStream.
        """
        session_id = "livekit_voice"
        
        # 1. Sync latest user message to SalesAgent memory
        user_text = ""
        if self._chat_ctx.messages:
            last_msg = self._chat_ctx.messages[-1]
            if last_msg.role == llm.ChatRole.USER:
                user_text = last_msg.content
                sales_agent.update_memory(session_id, "user", user_text)

        # 2. Get state & history
        current_stage = memory.session_memory.get_metadata(session_id, "stage")
        if isinstance(current_stage, str):
            current_stage = SalesStage(current_stage)
        history = memory.session_memory.get_history(session_id)

        # 3. Analyze Input
        analysis = {"intent": "other", "recommended_action": "stay", "extracted_info": {}}
        if user_text:
            try:
                from app.agent.analyzer import analyzer
                logger.info(f"[CerebrasLLM] Analyzing input: '{user_text[:50]}...'")
                analysis = await analyzer.analyze(user_text, history, current_stage)
                logger.info(f"[CerebrasLLM-Analyzer] intent={analysis.get('intent')}")
                
                from app.agent.intelligence import PRICING_GATE_METADATA_KEY
                for key, val in analysis.get("extracted_info", {}).items():
                    if val is not None:
                        memory.session_memory.set_metadata(session_id, key, val)
                        if key == "value_accepted" and val is True:
                             memory.session_memory.set_metadata(session_id, PRICING_GATE_METADATA_KEY, True)
            except Exception as e:
                logger.error(f"[CerebrasLLM] Analysis failed: {e}")

        # 4. Prompting
        system_prompt, final_stage = sales_agent.prepare_payload(session_id)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)

        if analysis.get("is_vague"):
            messages.append({"role": "system", "content": "The user was vague. Ask for missing info."})

        # 5. Generate
        try:
            logger.info(f"[CerebrasLLM] Calling Cerebras API with {len(messages)} messages")
            response_text = await cerebras_service.chat_completion(messages)
            logger.info(f"[CerebrasLLM] Received response: '{response_text[:50]}...'")
            
            # Sync assistant response back
            sales_agent.update_memory(session_id, "assistant", response_text)
            
            # Advance Stage Machine logic
            sales_agent.advance_logic(session_id, final_stage, analysis)
            
            # Push results to the stream
            # We use await send() to ensure it's delivered before closing
            await self._event_ch.send(
                llm.ChatChunk(
                    choices=[
                        llm.Choice(
                            delta=llm.ChoiceDelta(role="assistant", content=response_text),
                            index=0
                        )
                    ]
                )
            )
        except Exception as e:
            logger.error(f"[CerebrasLLM] Chat failed: {e}")
        finally:
            self._event_ch.close()

# Factory function
def get_llm():
    return CerebrasLLM()