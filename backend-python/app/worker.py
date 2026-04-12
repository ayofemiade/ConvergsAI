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
    TurnHandlingOptions,
    EndpointingOptions,
    InterruptionOptions
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

    # 1. Emma's Identity & Logic (The Brain)
    # We apply the wrapped prompt immediately to enforce performance from t=0
    emma_agent = voice.Agent(
        instructions=generate_wrapped_prompt(DETERMINISTIC_SYSTEM_PROMPT),
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

    # 2. Emma's Execution Loop (The Orchestrator)
    # This handles the real-time VAD -> LLM -> TTS pipeline
    session = voice.AgentSession(
        stt=stt,
        llm=agent_llm,
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
        turn_handling=TurnHandlingOptions(
            endpointing=EndpointingOptions(min_delay=0.4, max_delay=3.0),
            interruption=InterruptionOptions(enabled=True, min_duration=0.3)
        )
    )

    # --- Live Events ---
    @session.on("session_usage_updated")
    def _on_usage_updated(usage):
        logger.debug(f"[Telemetry] Session Metrics: {usage}")

    @emma_agent.on("speech_created")
    def on_speech_created(ev: voice.SpeechCreatedEvent):
        try:
            # v1.5.2 uses speech_handle
            handle = getattr(ev, "speech_handle", None)
            if handle:
                # We broadcast the transcript immediately so the UI feels 'live'
                broadcast_ui_event("assistant_transcript", getattr(handle, "transcript", ""))
        except Exception as e:
            logger.error(f"UI Sync Error: {e}")

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
        # Final safety net to sync context items
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
        except Exception as e:
            logger.error(f"Persona Sync Error: {e}")

    # 5. Connect & Start Execution
    await session.start(agent=emma_agent, room=ctx.room)
    
    # 6. Smooth Greeting with Interruption Readiness
    session.say("Hello! This is Emma from ConvergsAI. How can I help you today?", allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(server)