from math import cos, radians
import google.generativeai as genai
from firebase_client import db
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def get_bounding_box(lat: float, lng: float, radius_m: float = 50) -> dict:
    """Computes a lat/lng bounding box for a given radius in meters."""
    lat_delta = radius_m / 111000.0
    lng_delta = radius_m / (111000.0 * cos(radians(lat)))
    return {
        "lat_min": lat - lat_delta,
        "lat_max": lat + lat_delta,
        "lng_min": lng - lng_delta,
        "lng_max": lng + lng_delta,
    }


async def check_for_duplicate(
    lat: float, lng: float, new_summary: str
) -> str | None:
    """
    Queries Firestore for issues within 50m, then asks Gemini Flash
    whether the new report describes the same physical problem.
    Returns the matching issue_id, or None if unique.
    """
    box = get_bounding_box(lat, lng, radius_m=50)

    # Firestore: filter by latitude, then filter longitude in memory
    # (Firestore doesn't support dual-range inequality on different fields)
    query = (
        db.collection("issues")
        .where("location.latitude", ">=", box["lat_min"])
        .where("location.latitude", "<=", box["lat_max"])
        .stream()
    )

    existing = []
    for doc in query:
        data = doc.to_dict()
        lng_val = data["location"]["longitude"]
        if box["lng_min"] <= lng_val <= box["lng_max"] and data.get(
            "status"
        ) != "Resolved":
            existing.append(
                {
                    "id": doc.id,
                    "category": data["ai_analysis"]["category"],
                    "summary": data["ai_analysis"]["summary"],
                }
            )

    if not existing:
        return None

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=(
            "You compare civic issue reports. Be precise. "
            "Output ONLY the matching issue ID, or the word UNIQUE."
        ),
    )

    prompt = (
        f'A citizen just reported: "{new_summary}"\n\n'
        f"Existing unresolved issues within 50 meters:\n{existing}\n\n"
        "Does the new report describe the EXACT SAME physical failure as one of these? "
        "If yes, output only the matching issue ID. If it is a different problem, output UNIQUE."
    )

    response = model.generate_content(prompt)
    result = response.text.strip()
    valid_ids = [e["id"] for e in existing]
    return result if (result != "UNIQUE" and result in valid_ids) else None
