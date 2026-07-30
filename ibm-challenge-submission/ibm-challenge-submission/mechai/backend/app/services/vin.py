"""VIN extraction and NHTSA vPIC decoding utilities."""

# VIN character set: A-H, J-N, P-Z, 0-9 (I, O, Q are excluded by the standard)
# NHTSA vPIC: https://vpic.nhtsa.dot.gov/api/

import re

import httpx

_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b")

NHTSA_DECODE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"

# Mapping from NHTSA ``Variable`` names to clean output keys
_VARIABLE_MAP: dict[str, str] = {
    "Make": "make",
    "Model": "model",
    "Model Year": "year",
    "Trim": "trim",
    "Body Class": "body_style",
}

# Engine fields that are combined into a single "engine" string
_ENGINE_VARS = ("Displacement (L)", "Engine Model")


def extract_vin(text: str) -> str | None:
    """Return the first 17-character VIN found in *text*, or ``None``.

    VINs use the character set A-H, J-N, P-Z, 0-9 (I, O, Q are forbidden by
    the ISO 3779 standard).  The regex requires a word-boundary on both sides so
    that partial matches inside longer tokens are ignored.

    Args:
        text: Free-form text, typically a Whisper transcript.

    Returns:
        The matched VIN string (upper-cased) or ``None`` if none was found.
    """
    match = _VIN_RE.search(text.upper())
    return match.group(1) if match else None


def _parse_nhtsa_results(results: list[dict]) -> dict:
    """Convert the flat NHTSA ``Results`` list into a structured vehicle dict.

    Args:
        results: The ``Results`` array from the NHTSA vPIC JSON response.  Each
            element has ``Variable``, ``Value``, and ``ValueId`` keys.

    Returns:
        A dict with keys ``make``, ``model``, ``year``, ``trim``, ``engine``,
        ``body_style``.  Any field with no NHTSA value is ``None``.
    """
    lookup: dict[str, str | None] = {
        item["Variable"]: item.get("Value") or None for item in results
    }

    parsed: dict[str, str | int | None] = {}

    for nhtsa_key, clean_key in _VARIABLE_MAP.items():
        raw = lookup.get(nhtsa_key)
        if clean_key == "year" and raw:
            try:
                parsed[clean_key] = int(raw)
            except ValueError:
                parsed[clean_key] = None
        else:
            parsed[clean_key] = raw or None

    # Build engine string from displacement + model (e.g. "2.0L — GTDI")
    engine_parts = [lookup.get(v) for v in _ENGINE_VARS if lookup.get(v)]
    parsed["engine"] = " — ".join(engine_parts) if engine_parts else None

    return parsed


def decode_vin(vin: str) -> dict:
    """Decode a 17-character VIN via the NHTSA vPIC API.

    Makes a synchronous HTTP GET request to the NHTSA vPIC public endpoint (no
    API key required) and parses the ``Results`` list into a clean vehicle dict.

    Args:
        vin: A 17-character VIN string (will be upper-cased before the call).

    Returns:
        A dict with keys: ``vin``, ``make``, ``model``, ``year``, ``trim``,
        ``engine``, ``body_style``, ``_raw`` (the full NHTSA Results list).

    Raises:
        ValueError: If NHTSA returns an error code or the make field is empty
            (which indicates an unrecognised / invalid VIN).
        httpx.HTTPError: If the HTTP request itself fails (caller should wrap in
            a 502 response).
    """
    vin = vin.upper().strip()
    url = NHTSA_DECODE_URL.format(vin=vin)

    response = httpx.get(url, timeout=10.0)
    response.raise_for_status()

    payload = response.json()
    results: list[dict] = payload.get("Results", [])

    # NHTSA signals an unrecognised VIN via ErrorCode != "0"
    error_code = next(
        (r.get("Value") for r in results if r.get("Variable") == "Error Code"), None
    )
    if error_code and error_code != "0":
        error_text = next(
            (r.get("Value") for r in results if r.get("Variable") == "Additional Error Text"),
            "Unknown NHTSA error",
        )
        raise ValueError(f"NHTSA rejected VIN '{vin}': {error_text}")

    vehicle = _parse_nhtsa_results(results)

    if not vehicle.get("make"):
        raise ValueError(
            f"NHTSA returned no make for VIN '{vin}' — the VIN may be invalid or not in "
            "the NHTSA database."
        )

    return {
        "vin": vin,
        **vehicle,
        "_raw": results,
    }
