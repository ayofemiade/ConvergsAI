import asyncio
import uvicorn
import logging
import os
import sys
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("unified-service")


async def run_livekit_worker():
    """Run the LiveKit Agent Worker"""
    from app.worker import server
    
    logger.info("Starting LiveKit Agent Worker...")
    try:
        # Run the agent server programmatically within the existing loop
        await server.run()
    except Exception as e:
        logger.error(f"LiveKit Worker error: {e}")


async def run_fastapi_server():
    """Run the FastAPI Control API"""
    from app.main import app
    
    # Render provides the port in the PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    
    logger.info(f"Starting FastAPI Control API on 0.0.0.0:{port}...")
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        # Important for Render: faster startup detection
        loop="asyncio"
    )
    server = uvicorn.Server(config)
    await server.serve()


async def main():
    """Main entry point - runs both services concurrently"""
    logger.info("🚀 Starting ConvergsAI Unified Service")
    
    # Use FIRST_EXCEPTION so that if either task dies, the process exits
    # This allows Render to see the failure and restart the service
    tasks = [
        asyncio.create_task(run_fastapi_server()),
        asyncio.create_task(run_livekit_worker())
    ]
    
    done, pending = await asyncio.wait(
        tasks, 
        return_when=asyncio.FIRST_EXCEPTION
    )
    
    # Check if any task failed
    for task in done:
        if task.exception():
            logger.error(f"A critical service failed: {task.exception()}")
            # Re-raise to ensure the process exits with non-zero code
            raise task.exception()
            
    # If we get here, one of the tasks finished unexpectedly
    logger.warning("One of the unified services stopped unexpectedly.")
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
