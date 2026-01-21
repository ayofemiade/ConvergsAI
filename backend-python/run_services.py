#!/usr/bin/env python3
"""
Unified Service Runner for ConvergsAI
Runs both FastAPI Control API and LiveKit Agent Worker in a single process.
"""
import asyncio
import uvicorn
import logging
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("unified-service")


async def run_livekit_worker():
    """Run the LiveKit Agent Worker"""
    from livekit.agents import cli
    from app.worker import server
    
    logger.info("Starting LiveKit Agent Worker...")
    try:
        # Run the agent server in the background
        await cli.run_app(server)
    except Exception as e:
        logger.error(f"LiveKit Worker error: {e}")


async def run_fastapi_server():
    """Run the FastAPI Control API"""
    from app.main import app
    
    logger.info("Starting FastAPI Control API on port 8000...")
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
    server = uvicorn.Server(config)
    await server.serve()


async def main():
    """Main entry point - runs both services concurrently"""
    logger.info("🚀 Starting ConvergsAI Unified Service")
    logger.info("   - FastAPI Control API")
    logger.info("   - LiveKit Agent Worker")
    
    # Run both services concurrently
    await asyncio.gather(
        run_fastapi_server(),
        run_livekit_worker(),
    )


if __name__ == "__main__":
    asyncio.run(main())
