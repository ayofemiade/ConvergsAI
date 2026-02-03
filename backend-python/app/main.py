import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import uuid4
import logging

from app.agent.sales_agent import sales_agent
import app.agent.memory as memory
from app.agent.intelligence import PRICING_GATE_METADATA_KEY, SESSION_END_KEY

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api-server")

app = FastAPI(title="ConvergsAI Control API")

class SessionRequest(BaseModel):
    custom_prompt: Optional[str] = None
    user_id: Optional[str] = None

class MessageRequest(BaseModel):
    text: str
    session_id: str

@app.get("/health")
async def health_check():
    return {"ok": True}

@app.post("/session/new")
async def create_session(request: SessionRequest = None):
    session_id = str(uuid4())
    # Initialize session in memory
    memory.session_memory._ensure_defaults(session_id)
    if request and request.custom_prompt:
        # We could store custom prompt in metadata if needed
        memory.session_memory.set_metadata(session_id, "custom_prompt", request.custom_prompt)
    
    logger.info(f"Created new session: {session_id}")
    return {
        "success": True,
        "session_id": session_id,
        "message": "New session created"
    }

@app.post("/message")
async def handle_message(request: MessageRequest):
    try:
        session_id = request.session_id
        text = request.text
        
        # Generate response using SalesAgent
        response = await sales_agent.generate_response(text, session_id)
        
        # Gather metadata for the response
        stage = memory.session_memory.get_metadata(session_id, "stage")
        qualification = {
            "business_type": memory.session_memory.get_metadata(session_id, "business_type"),
            "goal": memory.session_memory.get_metadata(session_id, "goal"),
            "urgency": memory.session_memory.get_metadata(session_id, "urgency"),
            "budget_readiness": memory.session_memory.get_metadata(session_id, "budget_readiness"),
        }
        qualification_complete = memory.session_memory.get_metadata(session_id, PRICING_GATE_METADATA_KEY) or False
        
        return {
            "success": True,
            "response": response,
            "session_id": session_id,
            "stage": stage.value if hasattr(stage, "value") else str(stage),
            "qualification": qualification,
            "qualification_complete": qualification_complete
        }
    except Exception as e:
        logger.error(f"Error handling message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/session/{session_id}")
async def get_session(session_id: str):
    history = memory.session_memory.get_history(session_id)
    if not history and session_id not in memory.session_memory._metadata:
        raise HTTPException(status_code=404, detail="Session not found")
        
    stage = memory.session_memory.get_metadata(session_id, "stage")
    return {
        "session_id": session_id,
        "stage": stage.value if hasattr(stage, "value") else str(stage),
        "message_count": len(history),
        "qualification": {
            "business_type": memory.session_memory.get_metadata(session_id, "business_type"),
            "goal": memory.session_memory.get_metadata(session_id, "goal"),
            "urgency": memory.session_memory.get_metadata(session_id, "urgency"),
            "budget_readiness": memory.session_memory.get_metadata(session_id, "budget_readiness"),
        },
        "qualification_complete": memory.session_memory.get_metadata(session_id, PRICING_GATE_METADATA_KEY) or False
    }

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    memory.session_memory.clear_session(session_id)
    return {"success": True, "message": f"Session {session_id} deleted"}

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
