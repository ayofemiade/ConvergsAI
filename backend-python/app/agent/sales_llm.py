from typing import List, Optional, Any
from livekit.agents import llm
from app.agent.sales_agent import sales_agent
from app.logger_config import logger

class SalesLLM(llm.LLM):
    def __init__(self, session_id: str):
        super().__init__()
        self.session_id = session_id

    def chat(
        self,
        *,
        chat_ctx: llm.ChatContext,
        tools: Optional[List[Any]] = None,
        tool_choice: Any = None,
        **kwargs
    ) -> "SalesLLMStream":
        return SalesLLMStream(
            llm=self,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=kwargs.get("conn_options")
        )

class SalesLLMStream(llm.LLMStream):
    def __init__(
        self, 
        *, 
        llm: SalesLLM,
        chat_ctx: llm.ChatContext,
        tools: List[Any],
        conn_options: Any = None
    ):
        super().__init__(llm, chat_ctx=chat_ctx, tools=tools, conn_options=conn_options)
        self.session_id = llm.session_id
        # chat_ctx is already available via self._chat_ctx from the base class property

    async def _run(self) -> None:
        """
        Main loop for the stream. Executes SalesAgent logic and yields chunks.
        """
        # 1. Safely extract last user message
        user_msg = "Hello"
        
        # Use the base class property which is verified in this SDK version
        messages = getattr(self.chat_ctx, "messages", [])
        
        if messages:
            last_msg = messages[-1]
            if last_msg.role in (llm.ChatRole.USER, "user"):
                # Handle potential list-based content in newer LiveKit versions
                content = last_msg.content
                if isinstance(content, str):
                    user_msg = content
                elif isinstance(content, list):
                    # Extract text from content chunks
                    text_parts = []
                    for chunk in content:
                        if hasattr(chunk, "text"):
                            text_parts.append(chunk.text)
                        elif isinstance(chunk, dict) and "text" in chunk:
                            text_parts.append(chunk["text"])
                        elif isinstance(chunk, str):
                            text_parts.append(chunk)
                    user_msg = " ".join(text_parts)
                
        session_id = self.session_id

        logger.info(f"[SalesLLM] Processing input for session {session_id}: {user_msg}")
        
        try:
            # Call the brain
            response_text = await sales_agent.generate_response(user_msg, session_id)
            
            # Stream the response back in chunks
            tokens = response_text.split()
            for i, token in enumerate(tokens):
                content = token + (" " if i < len(tokens) - 1 else "")
                # SDK 1.3.10 uses delta field, not choices list
                self._event_ch.send_nowait(
                    llm.ChatChunk(
                        id="", # Optional ID
                        delta=llm.ChoiceDelta(
                            role="assistant",
                            content=content
                        )
                    )
                )
        except Exception as e:
            logger.error(f"[SalesLLM] Error generating response: {e}", exc_info=True)
        finally:
            self._event_ch.close()
