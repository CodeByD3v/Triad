import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
import os
import json
import logging

logger = logging.getLogger(__name__)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

TRIAGE_SCHEMA = content.Schema(
    type=content.Type.OBJECT,
    properties={
        "category": content.Schema(type=content.Type.STRING),
        "severity_score": content.Schema(type=content.Type.INTEGER),
        "summary": content.Schema(type=content.Type.STRING),
        "tags": content.Schema(
            type=content.Type.ARRAY,
            items=content.Schema(type=content.Type.STRING),
        ),
    },
    required=["category", "severity_score", "summary", "tags"],
)

# Fallback used when Gemini fails — ensures issue submission never crashes
TRIAGE_FALLBACK = {
    "category": "General / Infrastructure",
    "severity_score": 5,
    "summary": "Infrastructure issue reported by citizen — manual review required.",
    "tags": ["infrastructure", "review-needed", "citizen-report"],
}


async def run_visual_triage(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> dict:
    """
    Sends image to Gemini 2.5 Flash for structured civic issue analysis.
    Returns category, severity (1-10), summary, and tags.
    Falls back to TRIAGE_FALLBACK if Gemini fails or returns malformed JSON
    so that issue submission is never blocked by an AI failure.
    """
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=TRIAGE_SCHEMA,
            ),
            system_instruction=(
                "You are an expert civic engineering AI assistant. "
                "Analyze the provided image of a public infrastructure issue. "
                "Categorize it accurately (e.g. 'Roadways / Pothole', 'Utilities / Water Leak', "
                "'Lighting / Broken Streetlight', 'Sanitation / Waste Dump'). "
                "Assign a severity score from 1-10 based on public safety risk. "
                "Provide a concise 1-sentence structural summary. "
                "List 3 relevant tags."
            ),
        )

        image_part = {"mime_type": mime_type, "data": image_bytes}
        response = model.generate_content(["Analyze this civic issue:", image_part])

        parsed = json.loads(response.text)

        # Validate required fields are present and types are correct
        if not all(k in parsed for k in ("category", "severity_score", "summary", "tags")):
            raise ValueError("Gemini response missing required fields")
        parsed["severity_score"] = max(1, min(10, int(parsed["severity_score"])))

        return parsed

    except json.JSONDecodeError as e:
        logger.warning(f"[Triage] Gemini returned malformed JSON: {e} — using fallback")
        return TRIAGE_FALLBACK
    except Exception as e:
        logger.warning(f"[Triage] Gemini call failed: {e} — using fallback")
        return TRIAGE_FALLBACK
