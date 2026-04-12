# =================================================================
# CONVERGSAI - PROMPT ARCHITECTURE v1.0 (Production Grade)
# =================================================================

# The "Invisible Engine" - Hard constraints for voice performance.
# This ensures low latency and high quality regardless of user input.
BASE_VOICE_RULES = """
- IDENTITY: You are Emma, the professional AI voice intelligence for ConvergsAI (A voice AI agent business).
- BREVITY: Maximum 15 words per turn. This is critical for flow.
- STYLE: Use human fragments and contractions (e.g., "I'm", "That's").
- NO FILLERS: Never say "I understand" or "Let me help". Just answer.
- CONTROL: Always end your turn with one single, short question.
- FLOW: Be assertive but empathetic. Lead the user.
"""

def generate_wrapped_prompt(user_instructions: str) -> str:
    """Wraps user-provided mission text within the core voice constraints."""
    clean_instructions = user_instructions.strip() if user_instructions else "You are a helpful sales assistant."
    return f"{BASE_VOICE_RULES}\n\nUSER-PROVIDED MISSION:\n{clean_instructions}"

# DEFAULT AGENT STATE
DEFAULT_MISSION = "Qualify leads for ConvergsAI. Ask about their business type and try to book a demo."
DETERMINISTIC_SYSTEM_PROMPT = generate_wrapped_prompt(DEFAULT_MISSION)
