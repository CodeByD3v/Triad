import google.generativeai as genai
import os
import logging

logger = logging.getLogger(__name__)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


async def draft_grievance_letter(
    category: str,
    severity_score: int,
    summary: str,
    ward_name: str,
    latitude: float,
    longitude: float,
    upvotes: int,
) -> str:
    """
    Uses Gemini 2.5 Pro to draft a formal grievance letter
    addressed to the Municipal Corporation.
    Raises ValueError on failure so the router can return a clean 503.
    """
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-pro",
            system_instruction=(
                "You are an automated civic action agent. "
                "Draft professional, authoritative grievance letters to Municipal Corporations. "
                "Use formal letterhead format with date, subject, and salutation. "
                "Calibrate urgency to the severity score: "
                "8-10 = immediate action required, 5-7 = urgent, 1-4 = standard request."
            ),
        )

        prompt = (
            f"Issue Category: {category}\n"
            f"Severity Score: {severity_score}/10\n"
            f"Ward: {ward_name}\n"
            f"GPS Coordinates: {latitude:.6f}, {longitude:.6f}\n"
            f"Community Upvotes: {upvotes}\n"
            f"AI Summary: {summary}\n\n"
            "Draft a complete formal grievance letter to the Municipal Corporation. "
            "Include: date, subject line, formal salutation, 3 body paragraphs "
            "(issue description, community impact, call-to-action with deadline), "
            "and a formal closing."
        )

        response = model.generate_content(prompt)

        if not response.text:
            raise ValueError("Gemini Pro returned empty response")

        return response.text

    except Exception as e:
        logger.error(f"[Grievance] Gemini Pro failed: {e}")
        raise ValueError(f"Letter generation failed: {e}") from e
