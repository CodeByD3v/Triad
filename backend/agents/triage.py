import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
import os
import json

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


async def run_visual_triage(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> dict:
    """
    Sends image to Gemini 2.5 Flash for structured civic issue analysis.
    Returns category, severity (1-10), summary, and tags.
    """
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
    return json.loads(response.text)
