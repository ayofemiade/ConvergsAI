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
    from livekit.agents import job
    try:
        # Optimize worker for restricted environments
        server.update_options(
            num_idle_processes=1,  # Keep 1 warm process to save memory
            initialize_process_timeout=60, # Allow more time for initialization
            job_executor_type=job.JobExecutorType.PROCESS, # Ensure process isolation
        )
        
        # Run the agent server programmatically within the existing loop
        await server.run()
    except asyncio.CancelledError:
        logger.info("LiveKit Worker shutdown requested")
    except Exception as e:
        logger.error(f"LiveKit Worker error: {e}", exc_info=True)


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

    # Run GC to clear import overhead before entering wait
    import gc
    gc.collect()
    
    # Use ALL_COMPLETED so that if the text API fails, the Voice Agent keeps running independently
    done, pending = await asyncio.wait(
        tasks, 
        return_when=asyncio.ALL_COMPLETED
    )
    
    # Check if tasks failed (they shouldn't normally finish unless crashed or killed)
    for task in done:
        if task.exception():
            logger.error(f"A service failed: {task.exception()}", exc_info=True)
        else:
            logger.warning(f"A service finished unexpectedly.")
            
    logger.warning("All services stopped.")
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
