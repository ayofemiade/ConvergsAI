import json
from typing import Dict, Any, Optional
from app.services.cerebras import cerebras_service
from app.agent.stages import SalesStage
from app.agent.intelligence import EXIT_CONDITIONS

ANALYSIS_PROMPT = """You are a Conversation Analyzer for a formal sales process.
Your job is to analyze the latest User message and the history to provide structured feedback.

Stages:
- GREETING: Initial hello.
- QUALIFICATION: Determining role, company, and fit.
- PROBLEM: Identifying pain points and business challenges.
- SOLUTION: Presenting product value.
- OBJECTION: Handling pricing or trust issues.
- CLOSING: Next steps / meeting booking.

Output strictly valid JSON:
{{
  "intent": "string (one of: greeting, providing_info, sharing_pain, interest, affirmation, objection, clarification, pricing_query, curiosity, evasion, other)",
  "intent_definitions": {{
    "interest": "User explicitly likes the solution or wants to move forward (e.g., 'sounds good', 'I like that').",
    "curiosity": "User asks a 'how it works' or product feature question without clear acceptance yet.",
    "affirmation": "Simple 'yes', 'okay', 'correct'.",
    "clarification": "User asks about the sales process or repeats a question for understanding."
  }},
  "extracted_info": {{
    "role": "string or null",
    "company": "string or null",
    "pain_points": "string or null",
    "value_accepted": "boolean (Set to true ONLY if user explicitly says yes/sounds good to the solution)",
    "concerns_addressed": "boolean or null",
    "meeting_intent": "boolean or null",
    "meeting_locked": "boolean or null"
  }},
  "is_vague": "boolean",
  "recommended_action": "stay or advance"
}}

Current Stage: {current_stage}
History:
{history}

Latest User Message: {user_text}
"""

class ConversationAnalyzer:
    async def analyze(self, user_text: str, history: list, current_stage: SalesStage) -> Dict[str, Any]:
        prompt = ANALYSIS_PROMPT.format(
            current_stage=current_stage.value,
            history=history[-5:], # Last 5 for context
            user_text=user_text
        )
        
        messages = [{"role": "system", "content": prompt}]
        response_text = await cerebras_service.chat_completion(messages, temperature=0.1)
        
        try:
            # Simple cleanup in case LLM adds markdown wrappers
            data = response_text.strip()
            if data.startswith("```json"):
                data = data[7:-3]
            elif data.startswith("```"):
                data = data[3:-3]
            return json.loads(data)
        except Exception:
            return {
                "intent": "other",
                "extracted_info": {},
                "is_vague": True,
                "recommended_action": "stay"
            }

analyzer = ConversationAnalyzer()