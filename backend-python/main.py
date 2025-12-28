"""
FastAPI Server for AI Sales Agent

Production-ready API with:
- CORS configuration
- Error handling
- Request validation
- Session management
- Health checks
"""

import os
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import uvicorn

from agents.sales_agent import create_sales_agent, SalesAgent

# Load environment variables
load_dotenv()


# Global agent instance
sales_agent: Optional[SalesAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    global sales_agent
    
    # Startup
    print("🚀 Initializing AI Sales Agent...")
    cerebras_api_key = os.getenv("CEREBRAS_API_KEY")
    
    if not cerebras_api_key:
        print("❌ ERROR: CEREBRAS_API_KEY not found in environment variables")
        raise ValueError("CEREBRAS_API_KEY is required")
    
    try:
        sales_agent = create_sales_agent(cerebras_api_key)
        print("✅ Sales Agent initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize Sales Agent: {e}")
        raise
    
    yield
    
    # Shutdown
    print("👋 Shutting down AI Sales Agent...")
    sales_agent = None


# Initialize FastAPI app
app = FastAPI(
    title="AI Sales Agent API",
    description="Production-ready AI Sales Agent powered by Cerebras",
    version="1.0.0",
    lifespan=lifespan
)


# CORS Configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:4000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class MessageRequest(BaseModel):
    """Request model for chat messages"""
    text: str = Field(..., min_length=1, max_length=1000, description="User message")
    session_id: str = Field(..., min_length=1, max_length=100, description="Session identifier")


class MessageResponse(BaseModel):
    """Response model for chat messages"""
    success: bool
    response: str
    session_id: str
    stage: Optional[str] = None
    qualification: Optional[dict] = None
    qualification_complete: Optional[bool] = None
    message_count: Optional[int] = None
    error: Optional[str] = None


class SessionInfoResponse(BaseModel):
    """Response model for session information"""
    session_id: str
    created_at: str
    message_count: int
    stage: str
    qualification: dict
    qualification_complete: bool


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    version: str
    agent_initialized: bool


# API Endpoints

@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    return {
        "service": "AI Sales Agent API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "agent_initialized": sales_agent is not None
    }


@app.post("/message", response_model=MessageResponse)
async def send_message(request: MessageRequest):
    """
    Send a message to the AI Sales Agent
    
    Args:
        request: MessageRequest containing text and session_id
    
    Returns:
        MessageResponse with agent's reply and session info
    """
    if not sales_agent:
        raise HTTPException(
            status_code=503,
            detail="Sales Agent not initialized"
        )
    
    try:
        # Generate response
        result = await sales_agent.generate(
            text=request.text,
            session_id=request.session_id
        )
        
        return MessageResponse(**result)
    
    except Exception as e:
        print(f"Error processing message: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )


@app.get("/session/{session_id}", response_model=SessionInfoResponse)
async def get_session(session_id: str):
    """
    Get information about a conversation session
    
    Args:
        session_id: Session identifier
    
    Returns:
        SessionInfoResponse with session details
    """
    if not sales_agent:
        raise HTTPException(
            status_code=503,
            detail="Sales Agent not initialized"
        )
    
    session_info = sales_agent.get_session_info(session_id)
    
    if not session_info:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found"
        )
    
    return SessionInfoResponse(**session_info)


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a conversation session
    
    Args:
        session_id: Session identifier
    
    Returns:
        Success message
    """
    if not sales_agent:
        raise HTTPException(
            status_code=503,
            detail="Sales Agent not initialized"
        )
    
    success = sales_agent.clear_session(session_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found"
        )
    
    return {"success": True, "message": f"Session {session_id} deleted"}


class CreateSessionRequest(BaseModel):
    """Request model for creating a new session"""
    custom_prompt: Optional[str] = None


@app.post("/session/new")
async def create_session(request: Optional[CreateSessionRequest] = None):
    """
    Create a new conversation session
    
    Args:
        request: Optional CreateSessionRequest with custom_prompt
    
    Returns:
        New session ID
    """
    import uuid
    session_id = str(uuid.uuid4())
    custom_prompt = request.custom_prompt if request else None
    
    if sales_agent:
        sales_agent.create_session(session_id, custom_prompt)
    
    return {
        "success": True,
        "session_id": session_id,
        "message": "New session created"
    }


# Error handlers

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    print(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if os.getenv("DEBUG") == "true" else "An error occurred"
        }
    )


# Run server
if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "true").lower() == "true"
    
    print(f"""
    ╔═══════════════════════════════════════╗
    ║   AI Sales Agent - Python Backend    ║
    ║                                       ║
    ║   🚀 Server starting...               ║
    ║   📍 http://{host}:{port}           ║
    ║   📚 Docs: http://{host}:{port}/docs ║
    ╚═══════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )
