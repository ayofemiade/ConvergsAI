import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

from livekit.agents import (
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.agents.voice import Agent, AgentSession

from livekit.plugins import (
    silero,      # VAD
    deepgram,    # STT
    cartesia,    # TTS
)

from app.services.cerebras_livekit import get_llm
from app.agent.prompts import (
    BASE_AGENT_PROMPT,
    BEHAVIORAL_REFINEMENT_PROMPT,
)
from app.logging import logger


# -----------------------------
# Custom Agent
# -----------------------------
class SalesAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=f"{BASE_AGENT_PROMPT}\n\n{BEHAVIORAL_REFINEMENT_PROMPT}"
        )


# -----------------------------
# Worker Entrypoint
# -----------------------------
async def entrypoint(ctx: JobContext):
    logger.info(f"Starting agent for job {ctx.job.id}")

    # Connect to LiveKit room
    await ctx.connect()

    # Create Agent Session
    # Using specific Cartesia settings to increase reliability on Windows
    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(
            api_key=os.environ.get("DEEPGRAM_API_KEY"),
        ),
        llm=get_llm(),
        tts=cartesia.TTS(
            api_key=os.environ.get("CARTESIA_API_KEY"),
            voice="79a045e3-1141-4b13-9a1c-7466c051ac9d", # British Male
            sample_rate=24000,
        ),
        allow_interruptions=True,
    )

    # Start agent
    await session.start(
        room=ctx.room,
        agent=SalesAgent(),
    )
    logger.info("Agent session started")

    # Give a small delay for connections to warm up on Windows
    await asyncio.sleep(2)

    # ✅ Initial greeting with error handling
    try:
        logger.info("Sending initial greeting...")
        await session.say(
            "Hello! I am your AI sales assistant. How can I help you scale today?",
            allow_interruptions=True,
        )
        logger.info("Greeting sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send greeting: {e}")


# -----------------------------
# CLI bootstrap
# -----------------------------
if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint)
    )
