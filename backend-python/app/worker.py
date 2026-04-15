import logging
import os
import asyncio
from typing import AsyncIterable, Any
from dotenv import load_dotenv
from datetime import datetime

from . import logger_config

from livekit import rtc
from livekit.plugins import silero, openai, deepgram, cartesia
from livekit.agents import (
    AgentServer,
    JobContext,
    JobProcess,
    cli,
    metrics,
    voice,
    llm,
)
import json

# Standardized Minimal Prompt
from app.agent.prompts import DETERMINISTIC_SYSTEM_PROMPT

logger = logging.getLogger("basic-agent")
load_dotenv()

active_sessions = 0
MAX_SESSIONS = 5

server = AgentServer()

def prewarm(proc: JobProcess):
    # Pre-load VAD model into process memory for immediate Voice Activity Detection
    proc.userdata["vad"] = silero.VAD.load()

server.setup_fnc = prewarm

@server.rtc_session()
async def entrypoint(ctx: JobContext):
    global active_sessions
    logger.info(f"[Worker] Connecting to room: {ctx.room.name}")
    ctx.log_context_fields = {"room": ctx.room.name}
    
    # Store transcript manually
    session_transcript = []

    def broadcast_ui_event(data: dict):
        """Side-channel broadcast to the UI room."""
        try:
            payload = json.dumps(data)
            asyncio.create_task(ctx.room.local_participant.publish_data(payload))
        except Exception as e:
            logger.error(f"UI Sync Error: {e}")

    if active_sessions >= MAX_SESSIONS:
        logger.warning(f"Capacity Full. Rejecting session for room: {ctx.room.name}")
        await asyncio.sleep(0.5) # ensure connection gives time
        broadcast_ui_event({"type": "error", "text": "Capacity reached. Please try again."})
        return

    active_sessions += 1
    logger.info(f"[Worker] Session started. Active sessions: {active_sessions}")

    @ctx.room.on("disconnected")
    def _on_disconnected(*args, **kwargs):
        global active_sessions
        active_sessions = max(0, active_sessions - 1)
        logger.info(f"[Worker] Room disconnected. Active sessions: {active_sessions}")
        
        # Transcript Save Logic
        try:
            if session_transcript:
                os.makedirs("transcripts", exist_ok=True)
                filepath = os.path.join("transcripts", f"transcript_{ctx.room.name}.txt")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(f"--- Session: {ctx.room.name} ---\n")
                    f.write(f"--- Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n\n")
                    f.write("\n\n".join(session_transcript))
                logger.info(f"[Worker] Saved transcript to {filepath}")
        except Exception as e:
            logger.error(f"[Worker] Failed to save transcript: {e}")

    # Low-Latency Plugin Initialization
    # We pass API keys explicitly to resolve gateway/inheritance issues
    stt = deepgram.STT(api_key=os.environ.get("DEEPGRAM_API_KEY"))
    
    agent_llm = openai.LLM(
        model="llama3.1-8b",
        base_url="https://api.cerebras.ai/v1",
        api_key=os.environ.get("CEREBRAS_API_KEY"),
        temperature=0.5
    )
    
    tts = deepgram.TTS(model="aura-2-odysseus-en")

    # In LiveKit v1.5.2, AgentSession is the primary orchestrator.
    # We define an Agent instance to hold the instructions.
    emma_agent = voice.Agent(
        instructions=DETERMINISTIC_SYSTEM_PROMPT,
        stt=stt,
        llm=agent_llm,
        tts=tts,
        vad=ctx.proc.userdata["vad"]
    )

    session = voice.AgentSession(
        stt=stt,
        llm=agent_llm,
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        allow_interruptions=True,
        # Conservative latency for recovery (400ms)
        turn_handling={
            "endpointing": {
                "min_delay": 0.4,
                "max_delay": 3.0,
            },
            "interruption": {
                "min_duration": 0.3,
            }
        }
    )

    # Metrics collection for engineering audit
    @session.on("session_usage_updated")
    def _on_usage_updated(usage):
        logger.debug(f"[Telemetry] Session Metrics: {usage}")



    @session.on("user_input_transcribed")
    def on_user_transcript(ev: voice.UserInputTranscribedEvent):
        # Broadcast user words with zero latency
        if ev.transcript:
            broadcast_ui_event({
                "type": "text",
                "role": "user",
                "text": ev.transcript,
                "is_final": ev.is_final
            })

    @session.on("conversation_item_added")
    def on_item_added(ev: voice.ConversationItemAddedEvent):
        # We broadcast the final context item to ensure bubble synchronization
        if isinstance(ev.item, llm.ChatMessage):
            content = ev.item.content
            if isinstance(content, list):
                content = " ".join([c if isinstance(c, str) else str(c) for c in content])
            
            if content and ev.item.role in ["user", "assistant"]:
                display_role = "Emma" if ev.item.role == "assistant" else "User"
                session_transcript.append(f"{display_role}: {content}")
                
            if content and ev.item.role == "assistant":
                broadcast_ui_event({
                    "type": "text",
                    "role": "assistant",
                    "text": content,
                    "is_final": True
                })

    # --- Live Persona Sync ---
    # Listen for configuration changes from the UI (presets/prompts)
    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        try:
            payload = json.loads(data.data)
            if payload.get("type") == "metadata":
                new_prompt = payload.get("prompt")
                if new_prompt:
                    logger.info(f"[Worker] Syncing persona blocked (Disabled manual update)")
                    
                    # asyncio.create_task(emma_agent.update_instructions(new_prompt))
        except Exception:
            pass

    # Start the session with the defined agent and room context
    # This binds all plugins into a high-performance streaming loop
    try:
        await session.start(agent=emma_agent, room=ctx.room)
        
        # Emma's Initial Greeting
        session.say("Hello! This is Emma. How can I help you today?", allow_interruptions=True)
    except Exception as e:
        logger.error(f"[Worker] Critical voice engine failure: {e}")
        broadcast_ui_event({"type": "error", "text": "Voice engine offline. Please try again."})
        # Gracefully handle the crash without killing PM2
        await ctx.room.disconnect()

if __name__ == "__main__":
    cli.run_app(server)