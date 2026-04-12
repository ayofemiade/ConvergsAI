import logging
import os
import asyncio
from typing import AsyncIterable, Any
from dotenv import load_dotenv

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
from app.agent.prompts import DETERMINISTIC_SYSTEM_PROMPT, generate_wrapped_prompt

logger = logging.getLogger("basic-agent")
load_dotenv()

server = AgentServer()

def prewarm(proc: JobProcess):
    # Pre-load VAD model into process memory for immediate Voice Activity Detection
    proc.userdata["vad"] = silero.VAD.load()

server.setup_fnc = prewarm

@server.rtc_session()
async def entrypoint(ctx: JobContext):
    logger.info(f"[Worker] Connecting to room: {ctx.room.name}")
    ctx.log_context_fields = {"room": ctx.room.name}

    # Low-Latency Plugin Initialization
    # We pass API keys explicitly to resolve gateway/inheritance issues
    stt = deepgram.STT(api_key=os.environ.get("DEEPGRAM_API_KEY"))
    
    agent_llm = openai.LLM(
        model="llama3.1-8b",
        base_url="https://api.cerebras.ai/v1",
        api_key=os.environ.get("CEREBRAS_API_KEY")
    )
    
    tts =  deepgram.TTS( model="aura-2-odysseus-en")

    # In LiveKit v1.5.2, AgentSession is the primary orchestrator.
    # We define an Agent instance to hold the instructions.
    emma_agent = voice.Agent(
        instructions=DETERMINISTIC_SYSTEM_PROMPT,
        stt=stt,
        llm=agent_llm,
        tts=tts,
        vad=ctx.proc.userdata["vad"]
    )

    def broadcast_ui_event(data: dict):
        """Side-channel broadcast to the UI room."""
        try:
            payload = json.dumps(data)
            asyncio.create_task(ctx.room.local_participant.publish_data(payload))
        except Exception as e:
            logger.error(f"UI Sync Error: {e}")

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

    @session.on("speech_created")
    def on_speech_created(ev: voice.SpeechCreatedEvent):
        # Passive tap: Forward words as they are generated without touching audio pipe
        async def _forward_transcript():
            cumulative_text = ""
            async for segment in ev.stt_stream:
                cumulative_text += segment
                broadcast_ui_event({
                    "type": "text",
                    "role": "assistant",
                    "text": cumulative_text,
                    "is_final": False
                })
        asyncio.create_task(_forward_transcript())

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
        if isinstance(ev.item, llm.ChatMessage) and ev.item.role == "assistant":
            content = ev.item.content
            if isinstance(content, list):
                content = " ".join([c if isinstance(c, str) else str(c) for c in content])
            
            if content:
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
                user_text = payload.get("prompt")
                if user_text:
                    logger.info(f"[Worker] Syncing persona instructions...")
                    wrapped_prompt = generate_wrapped_prompt(user_text)
                    asyncio.create_task(emma_agent.update_instructions(wrapped_prompt))
        except Exception:
            pass

    # Start the session with the defined agent and room context
    # This binds all plugins into a high-performance streaming loop
    await session.start(agent=emma_agent, room=ctx.room)
    
    # Emma's Initial Greeting
    session.say("Hello! This is Emma from ConvergsAI. How can I help you today?", allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(server)