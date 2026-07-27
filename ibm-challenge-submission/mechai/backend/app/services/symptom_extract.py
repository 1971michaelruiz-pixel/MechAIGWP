"""LLM-based symptom tag extraction from mechanic transcripts."""

# Uses GPT-4o to parse free-form presented-symptoms and inspection-findings
# speech and return a JSON array of short snake_case tag strings such as
# ["brake_squeal", "left_front_vibration", "fluid_leak"].

import json

from openai import OpenAI

from app.config import settings

# Lazily instantiated so tests can patch settings before import
_openai_client: OpenAI | None = None


def _get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=settings.openai_api_key)
    return _openai_client


_SYSTEM_PROMPT = (
    "You are a precise data-extraction assistant working inside an automotive shop platform. "
    "Given a mechanic's presented-symptoms description and their inspection findings, extract "
    "a concise list of symptom/finding tags. "
    "Each tag must be a short snake_case string (e.g. 'brake_squeal', 'fluid_leak', "
    "'left_front_vibration', 'engine_misfire'). "
    "Return ONLY a raw JSON array of strings — no markdown fences, no explanation. "
    "If no meaningful symptoms are present, return an empty array: []"
)


def extract_symptom_tags(presented_symptoms: str, inspection_findings: str) -> list[str]:
    """Parse symptom tags from mechanic transcripts using GPT-4o.

    Combines both voice-capture phases into a single prompt and asks the model
    to return a raw JSON array of short snake_case tag strings.

    Args:
        presented_symptoms: Free-form transcript from phase 1 (customer description).
        inspection_findings: Free-form transcript from phase 2 (mechanic findings).

    Returns:
        A list of snake_case tag strings (e.g. ``["brake_squeal", "fluid_leak"]``).
        Returns an empty list if extraction fails or the model returns no tags.
    """
    client = _get_openai_client()

    user_content = (
        f"Presented symptoms: {presented_symptoms}\n\n"
        f"Inspection findings: {inspection_findings}"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=256,
            temperature=0,
        )

        raw = (response.choices[0].message.content or "").strip()
        tags = json.loads(raw)
        if isinstance(tags, list):
            return [str(t) for t in tags]
        return []
    except Exception:
        return []
