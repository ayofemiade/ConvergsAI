import asyncio
from livekit.agents import JobContext, WorkerOptions, cli, job_process
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai
from app.services.cerebras_livekit import get_llm
from app.voice.vad import get_vad
from app.voice.tts import get_tts
from app.agent.prompts import BASE_AGENT_PROMPT
from app.logging import logger

async def entrypoint(ctx: JobContext):
    logger.info(f"Starting agent for job {ctx.job.id}")

    await ctx.connect()
    
    # Configure the high-level VoiceAssistant
    # It orchestrates STT -> LLM -> TTS pipeline automatically
    assistant = VoiceAssistant(
        vad=get_vad(),
        stt=openai.STT(), # Using Whisper for reliability
        llm=get_llm(),    # Our custom Cerebras implementation
        tts=get_tts(),    # Cartesia for natural voice
        chat_ctx=openai.ChatContext().append(
            role="system", 
            text=BASE_AGENT_PROMPT
        )
    )

    # Event handlers for observability
    @assistant.on("user_transcript")
    def on_user_transcript(transcript: str):
        logger.info(f"User: {transcript}")

    @assistant.on("agent_transcript")
    def on_agent_transcript(transcript: str):
        logger.info(f"Agent: {transcript}")

    # Start the assistant
    assistant.start(ctx.room)
    
    # Perform initial greeting
    await assistant.say("Hello context, how can I help you scale today?", allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
