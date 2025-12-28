"""
Production-Ready AI Sales Agent

This agent follows strict sales conversation rules:
- Ask one question at a time
- Qualify leads systematically
- Guide toward clear CTAs
- Maintain professional, conversational tone
- Track session-based conversation memory
"""

import os
import json
from typing import Dict, List, Optional
from datetime import datetime
import asyncio


class ConversationSession:
    """Manages a single conversation session with memory"""
    
    def __init__(self, session_id: str, custom_prompt: Optional[str] = None):
        self.session_id = session_id
        self.custom_prompt = custom_prompt
        self.created_at = datetime.utcnow()
        self.messages: List[Dict[str, str]] = []
        self.qualification_data = {
            "business_type": None,
            "goal": None,
            "urgency": None,
            "budget_readiness": None,
        }
        self.current_stage = "greeting"  # greeting, qualifying, cta, closed
    
    def add_message(self, role: str, content: str):
        """Add message to conversation history"""
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_conversation_history(self) -> str:
        """Get formatted conversation history"""
        history = []
        for msg in self.messages[-10:]:  # Last 10 messages for context
            history.append(f"{msg['role']}: {msg['content']}")
        return "\n".join(history)
    
    def update_qualification(self, key: str, value: str):
        """Update qualification data"""
        if key in self.qualification_data:
            self.qualification_data[key] = value
    
    def get_qualification_status(self) -> Dict[str, bool]:
        """Check which qualification fields are complete"""
        return {
            key: value is not None 
            for key, value in self.qualification_data.items()
        }


class SalesAgent:
    """
    Production AI Sales Agent powered by Cerebras LLM
    
    Features:
    - Session-based memory
    - Lead qualification
    - One question at a time
    - CTA guidance
    - Professional conversational tone
    """
    
    # Core system prompt that defines agent behavior
    SYSTEM_PROMPT = """You are Emma, a professional AI sales agent for a high-growth SaaS company.

YOUR PERSONALITY:
- Confident but friendly
- Professional but conversational
- Direct and concise
- Goal-oriented

YOUR STRICT RULES:
1. Ask ONE question at a time - never multiple questions
2. Keep responses SHORT (2-3 sentences max)
3. Always move the conversation forward
4. Never dump information - be strategic
5. Qualify before pitching

YOUR QUALIFICATION PROCESS:
1. Understand their business type
2. Identify their main goal/need
3. Assess urgency (timeline)
4. Gauge budget readiness (softly)

YOUR CTAs (use when qualified):
- "Book a demo" - for serious prospects
- "View pricing" - for budget-conscious leads
- "Contact sales" - for complex needs

CONVERSATION FLOW:
- Start warm: acknowledge them
- Qualify systematically: one question at a time
- Build urgency: understand timeline
- Guide to CTA: match their readiness

RESPONSE STYLE EXAMPLES:
❌ Bad: "Hi! I'm Emma. What's your business about? What are your goals? Do you have a budget?"
✅ Good: "Hi! I'm Emma. I help businesses like yours grow faster. To start—what kind of business are you running?"

❌ Bad: "We have many features including X, Y, Z, and we can help you with A, B, C..."
✅ Good: "Got it. And what's the biggest challenge you're facing right now?"

Remember: You're NOT a chatbot. You're a SALES AGENT. Your job is to qualify and convert.
"""
    
    def __init__(self, cerebras_api_key: str):
        """Initialize the Sales Agent"""
        self.api_key = cerebras_api_key
        self.sessions: Dict[str, ConversationSession] = {}
        
        # Initialize Cerebras client (OpenAI-compatible)
        try:
            from openai import OpenAI
            self.client = OpenAI(
                api_key=cerebras_api_key,
                base_url="https://api.cerebras.ai/v1"
            )
        except ImportError:
            raise ImportError(
                "OpenAI package required. Install with: pip install openai"
            )
    
    def create_session(self, session_id: str, custom_prompt: Optional[str] = None) -> ConversationSession:
        """Explicitly create a new session"""
        self.sessions[session_id] = ConversationSession(session_id, custom_prompt)
        return self.sessions[session_id]

    def _get_or_create_session(self, session_id: str) -> ConversationSession:
        """Get existing session or create new one"""
        if session_id not in self.sessions:
            self.sessions[session_id] = ConversationSession(session_id)
        return self.sessions[session_id]
    
    def _build_context_prompt(self, session: ConversationSession) -> str:
        """Build context-aware prompt for the LLM"""
        
        # Qualification status
        qual_status = session.get_qualification_status()
        qualified_fields = [k for k, v in qual_status.items() if v]
        missing_fields = [k for k, v in qual_status.items() if not v]
        
        context = f"""
CURRENT CONVERSATION STAGE: {session.current_stage}

QUALIFICATION STATUS:
- Completed: {', '.join(qualified_fields) if qualified_fields else 'None yet'}
- Still needed: {', '.join(missing_fields) if missing_fields else 'All done!'}

CONVERSATION HISTORY:
{session.get_conversation_history()}

YOUR NEXT RESPONSE SHOULD:
"""
        
        if session.current_stage == "greeting":
            context += "- Welcome them warmly\n- Ask about their business type\n- Keep it to ONE clear question"
        
        elif session.current_stage == "qualifying":
            if not qual_status["business_type"]:
                context += "- Ask about their business type"
            elif not qual_status["goal"]:
                context += "- Ask about their main goal or challenge"
            elif not qual_status["urgency"]:
                context += "- Ask about their timeline (softly gauge urgency)"
            elif not qual_status["budget_readiness"]:
                context += "- Gauge budget readiness (e.g., 'Are you looking to invest in a solution soon?')"
            else:
                context += "- Move to CTA stage\n- Recommend the best next step"
                session.current_stage = "cta"
        
        elif session.current_stage == "cta":
            context += "- Present a clear CTA (Book demo / View pricing / Contact sales)\n- Create urgency\n- Be confident"
        
        return context
    
    async def generate(self, text: str, session_id: str) -> Dict[str, any]:
        """
        Generate AI response for user input
        
        Args:
            text: User's message
            session_id: Unique session identifier
        
        Returns:
            Dict with response, session info, and qualification status
        """
        
        # Get or create session
        session = self._get_or_create_session(session_id)
        
        # Add user message to history
        session.add_message("user", text)
        
        # Build context-aware prompt
        context_prompt = self._build_context_prompt(session)
        
        # Determine system prompt
        system_prompt = session.custom_prompt if session.custom_prompt else self.SYSTEM_PROMPT

        # Prepare messages for LLM
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": context_prompt},
            {"role": "user", "content": text}
        ]
        
        try:
            # Call Cerebras LLM via OpenAI-compatible API
            response = self.client.chat.completions.create(
                model="llama3.1-70b",  # Cerebras model
                messages=messages,
                temperature=0.7,
                max_tokens=150,  # Keep responses short
                stream=False
            )
            
            # Extract response
            agent_response = response.choices[0].message.content.strip()
            
            # Add agent response to history
            session.add_message("assistant", agent_response)
            
            # Extract qualification data from conversation (simple keyword matching)
            self._extract_qualification_data(session, text, agent_response)
            
            # Prepare response
            return {
                "success": True,
                "response": agent_response,
                "session_id": session_id,
                "stage": session.current_stage,
                "qualification": session.qualification_data,
                "qualification_complete": all(session.get_qualification_status().values()),
                "message_count": len(session.messages)
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": "I apologize, but I'm having trouble processing that. Could you rephrase?",
                "session_id": session_id
            }
    
    def _extract_qualification_data(
        self, 
        session: ConversationSession, 
        user_text: str, 
        agent_response: str
    ):
        """
        Extract and update qualification data from conversation
        This is a simple implementation - can be enhanced with NER/NLP
        """
        
        user_lower = user_text.lower()
        
        # Update stage based on conversation flow
        if session.current_stage == "greeting" and len(session.messages) > 2:
            session.current_stage = "qualifying"
        
        # Extract business type
        if not session.qualification_data["business_type"]:
            business_keywords = ["saas", "e-commerce", "ecommerce", "agency", 
                               "startup", "retail", "b2b", "b2c", "consulting"]
            for keyword in business_keywords:
                if keyword in user_lower:
                    session.update_qualification("business_type", keyword)
                    break
            # Also catch general business mentions
            if "business" in user_lower or "company" in user_lower:
                session.update_qualification("business_type", "general_business")
        
        # Extract goal
        if not session.qualification_data["goal"]:
            goal_keywords = ["grow", "scale", "increase", "improve", "automate", 
                           "sales", "leads", "customers", "revenue"]
            for keyword in goal_keywords:
                if keyword in user_lower:
                    session.update_qualification("goal", keyword)
                    break
        
        # Extract urgency
        if not session.qualification_data["urgency"]:
            urgency_keywords = {
                "urgent": "high",
                "asap": "high",
                "soon": "medium",
                "month": "medium",
                "week": "high",
                "eventually": "low",
                "exploring": "low"
            }
            for keyword, level in urgency_keywords.items():
                if keyword in user_lower:
                    session.update_qualification("urgency", level)
                    break
        
        # Extract budget readiness
        if not session.qualification_data["budget_readiness"]:
            if any(word in user_lower for word in ["budget", "invest", "spend", "price", "cost"]):
                if any(word in user_lower for word in ["yes", "ready", "approved", "allocated"]):
                    session.update_qualification("budget_readiness", "ready")
                elif any(word in user_lower for word in ["no", "not yet", "tight", "limited"]):
                    session.update_qualification("budget_readiness", "limited")
                else:
                    session.update_qualification("budget_readiness", "exploring")
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get session information"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            return {
                "session_id": session_id,
                "created_at": session.created_at.isoformat(),
                "message_count": len(session.messages),
                "stage": session.current_stage,
                "qualification": session.qualification_data,
                "qualification_complete": all(session.get_qualification_status().values())
            }
        return None
    
    def clear_session(self, session_id: str) -> bool:
        """Clear a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False


# Factory function for easy initialization
def create_sales_agent(cerebras_api_key: str = None) -> SalesAgent:
    """
    Create and return a SalesAgent instance
    
    Args:
        cerebras_api_key: Cerebras API key (will use env var if not provided)
    
    Returns:
        Configured SalesAgent instance
    """
    if not cerebras_api_key:
        cerebras_api_key = os.getenv("CEREBRAS_API_KEY")
    
    if not cerebras_api_key:
        raise ValueError(
            "CEREBRAS_API_KEY must be provided or set in environment variables"
        )
    
    return SalesAgent(cerebras_api_key)
