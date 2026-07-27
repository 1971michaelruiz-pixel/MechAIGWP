"""LLM-based customer name extraction from mechanic transcripts."""

# Uses GPT-4o to parse phrases like "assign to John Smith" or
# "this is for Mary Johnson" and return a clean name string.

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
    "Extract only the customer's full name from the mechanic's spoken transcript. "
    "The name is typically introduced with phrases like 'assign to', 'this is for', "
    "'vehicle belongs to', or 'customer is'. "
    "Return ONLY the extracted name — nothing else. "
    "If no customer name is present, return the single word: NONE."
)


def extract_customer_name(transcript: str) -> str | None:
    """Parse a customer name from a mechanic transcript using GPT-4o.

    Looks for patterns like "assign to John Smith" or "this is for Mary Johnson"
    and returns the extracted name string.

    Args:
        transcript: Free-form mechanic speech transcript.

    Returns:
        The extracted customer name string (e.g. ``"John Smith"``), or ``None``
        if no name was found or the model returned ``"NONE"``.
    """
    client = _get_openai_client()

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
        max_tokens=32,
        temperature=0,
    )

    raw = (response.choices[0].message.content or "").strip()
    if not raw or raw.upper() == "NONE":
        return None
    return raw
