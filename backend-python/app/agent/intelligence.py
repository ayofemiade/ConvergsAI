from typing import List, Dict, Set
from app.agent.stages import SalesStage

# Required information to move OUT of a stage
EXIT_CONDITIONS: Dict[SalesStage, List[str]] = {
    SalesStage.GREETING: [],
    SalesStage.QUALIFICATION: ["role", "company"],
    SalesStage.PROBLEM: ["pain_points"],
    SalesStage.SOLUTION: ["value_accepted"], # Logic: Explicit confirmation needed
    SalesStage.OBJECTION: ["concerns_addressed"],
    SalesStage.CLOSING: ["meeting_locked"],
}

# Intents allowed to trigger an advance PER stage
ALLOWED_ADVANCE_INTENTS: Dict[SalesStage, Set[str]] = {
    SalesStage.GREETING: {"greeting", "information_request", "affirmation", "pricing_query", "sharing_pain", "other"},
    SalesStage.QUALIFICATION: {"providing_info", "affirmation"},
    SalesStage.PROBLEM: {"sharing_pain", "affirmation"},
    SalesStage.SOLUTION: {"interest", "affirmation"}, # "interest" here means they liked the value
    SalesStage.OBJECTION: {"acceptance", "affirmation"},
}

# Metadata keys
PRICING_GATE_METADATA_KEY = "value_presented"
SESSION_END_KEY = "session_locked"
VALUE_ACCEPTED_KEY = "value_accepted"
