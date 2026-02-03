from typing import List, Optional, Any
from livekit.agents import llm
from app.agent.sales_agent import sales_agent
from app.logger_config import logger

class SalesLLM(llm.LLM):
    def __init__(self, session_id: str, room: Optional[Any] = None):
        super().__init__()
        self.session_id = session_id
        self.room = room
        self.last_transcript = None # Track to avoid Turn Redundancy

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
        self.room = llm.room
        # chat_ctx is already available via self._chat_ctx from the base class property

    async def _run(self) -> None:
        """
        Main loop for the stream. Executes SalesAgent logic and yields chunks.
        """
        # 1. High-Fidelity Transcript Synchronization
        # We wait for real content if we are speculatively starting.
        # We prefer "final" transcripts over partial ones.
        user_msg = None
        import asyncio
        start_time = asyncio.get_event_loop().time()
        
        while (asyncio.get_event_loop().time() - start_time) < 0.6: # Reduced from 1.5s to 0.6s for snappiness
            messages = getattr(self.chat_ctx, "messages", [])
            has_rich_content = False
            
            # Find the MOST RECENT user message in the context
            last_user_msg = None
            for msg in reversed(messages):
                if msg.role in (llm.ChatRole.USER, "user"):
                    last_user_msg = msg
                    break
            
            if last_user_msg:
                content = last_user_msg.content
                current_text = ""
                if isinstance(content, str): current_text = content
                elif isinstance(content, list): current_text = " ".join([c.text if hasattr(c, "text") else str(c) for c in content])
                
                # [ANTI-REDUNDANCY]
                # If this is the SAME text we processed last turn, it's a stale transcript.
                if current_text == getattr(self.llm, "last_transcript", None) and current_text != "":
                    await asyncio.sleep(0.05)
                    continue

                if current_text.strip():
                    user_msg = current_text
                    # If we have a decent amount of text, stop waiting immediately
                    if len(user_msg) > 5:
                        break
                    has_rich_content = True
            
            if has_rich_content:
                await asyncio.sleep(0.05)
                continue
            
            await asyncio.sleep(0.05)

        # [INTELLIGENCE: Voice Restoration]
        # Always update tracker if we found something new
        if user_msg:
            self.llm.last_transcript = user_msg

        has_any_user_msg = any(m.role in (llm.ChatRole.USER, "user") for m in getattr(self.chat_ctx, "messages", []))
        
        if not user_msg and has_any_user_msg:
            # We have user history, but couldn't find a NEW transcript. 
            logger.info("[SalesLLM] No NEW transcript found. Skipping to avoid Turn Redundancy.")
            self._event_ch.close()
            return

        # If user_msg is still None here, it means it's likely the first turn (initial greeting).
        if user_msg is None:
            user_msg = "" # Allow empty string for the initial greeting
            logger.info("[SalesLLM] Initial turn detected. Proceeding with empty user_msg.")

        session_id = self.session_id

        # 1. STT Noise Gate
        if not user_msg:
            # Allow empty msg (Initial Greeting case)
            pass
        else:
            noise_patterns = ["uh", "um", "ah", "oh", "..", "..."]
            clean_msg = user_msg.strip().lower()
            if len(clean_msg) < 3 and clean_msg not in ["ok", "hi", "no", "go", "i"]:
                logger.info(f"[SalesLLM] STT Noise Gate: Filtering out '{user_msg}'")
                self._event_ch.close()
                return

            if clean_msg in noise_patterns:
                logger.info(f"[SalesLLM] STT Noise Gate: Filtering out filler '{user_msg}'")
                self._event_ch.close()
                return

        logger.info(f"[SalesLLM] Processing input for session {session_id}: {user_msg}")
        
        chunk_buffer = ""
        tokens_yielded = 0
        initial_msg = user_msg # Store for correction check

        def _send_chunk(content: str):
            self._event_ch.send_nowait(
                llm.ChatChunk(
                    choices=[
                        llm.Choice(
                            delta=llm.ChoiceDelta(role="assistant", content=content),
                            index=0,
                        )
                    ]
                )
            )

        def _get_text(msg_content):
            if isinstance(msg_content, str): return msg_content
            if isinstance(msg_content, list): return " ".join([c.text if hasattr(c, "text") else str(c) for c in msg_content])
            return ""

        try:
            # 2. Call the brain with TRUE STREAMING
            async for token in sales_agent.generate_stream(session_id, user_msg):
                tokens_yielded += 1
                
                # [LATE CORRECTION CHECK]
                # Every 5 tokens, check if a much better transcript has appeared
                if tokens_yielded % 5 == 0:
                    messages = getattr(self.chat_ctx, "messages", [])
                    
                    # Find last user msg again
                    curr_user_msg = None
                    for msg in reversed(messages):
                        if msg.role in (llm.ChatRole.USER, "user"):
                            curr_user_msg = msg
                            break
                    
                    if curr_user_msg:
                        curr_msg_text = _get_text(curr_user_msg.content)
                        if len(curr_msg_text) > len(initial_msg) + 15:
                            # User said way more than we thought. Pivot.
                            logger.warning(f"[SalesLLM] Late Correction! Predicted: '{initial_msg}', Real: '{curr_msg_text}'")
                            _send_chunk("Actually, wait, I think I missed that first part. ")
                            break

                # Hybrid Chunking
                if tokens_yielded <= 3:
                    _send_chunk(token)
                    continue

                chunk_buffer += token
                if any(p in token for p in [" ", ".", "!", "?", ",", "\n"]):
                    _send_chunk(chunk_buffer)
                    chunk_buffer = ""
            
            # Final flush
            if chunk_buffer:
                _send_chunk(chunk_buffer)

            # [INTELLIGENCE BROADCAST]
            # After the stream is done, we broadcast the latest analysis to the room
            try:
                import json
                from app.agent import memory
                
                analysis = memory.session_memory.get_metadata(session_id, "last_analysis")
                if analysis and self.room:
                    # Calculate simple latency (mocked or estimated for now)
                    import asyncio
                    latency = int((asyncio.get_event_loop().time() - start_time) * 1000)
                    
                    intel_packet = {
                        "type": "intelligence",
                        "intelligence": {
                            "latency": latency,
                            "sentiment": analysis.get("sentiment", "Neutral")
                        },
                        "qualification": analysis.get("extracted_info", {}),
                        "qualification_complete": analysis.get("recommended_action") == "advance"
                    }
                    
                    # Also include the full assistant response to ensure Frontend has the text
                    # (Transcripts are usually handled by AgentSession, but this is a safety backup)
                    
                    await self.room.local_participant.publish_data(
                        json.dumps(intel_packet),
                        reliable=True
                    )
                    logger.info(f"[SalesLLM] Broadcast intelligence: {analysis.get('sentiment')}")
            except Exception as e:
                logger.error(f"[SalesLLM] Failed to broadcast intelligence: {e}")

        except Exception as e:
            logger.error(f"[SalesLLM] Error in streaming response: {e}", exc_info=True)
        finally:
            self._event_ch.close()
