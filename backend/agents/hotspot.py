import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
from firebase_client import db
import os
import json

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

HOTSPOT_SCHEMA = content.Schema(
    type=content.Type.ARRAY,
    items=content.Schema(
        type=content.Type.OBJECT,
        properties={
            "cluster_lat": content.Schema(type=content.Type.NUMBER),
            "cluster_lng": content.Schema(type=content.Type.NUMBER),
            "risk_level": content.Schema(type=content.Type.STRING),
            "predicted_hazard_type": content.Schema(type=content.Type.STRING),
            "preventative_recommendation": content.Schema(
                type=content.Type.STRING
            ),
            "confidence_score": content.Schema(type=content.Type.NUMBER),
        },
        required=[
            "cluster_lat",
            "cluster_lng",
            "risk_level",
            "predicted_hazard_type",
            "preventative_recommendation",
            "confidence_score",
        ],
    ),
)


async def run_hotspot_analysis() -> list[dict]:
    """
    Pulls last 100 issues from Firestore, feeds coordinate clusters and
    categories to Gemini 2.5 Pro, and returns predicted risk zones as
    structured JSON suitable for a Leaflet heatmap overlay.
    """
    docs = (
        db.collection("issues")
        .order_by("created_at", direction="DESCENDING")
        .limit(100)
        .stream()
    )

    historical_data = []
    for doc in docs:
        d = doc.to_dict()
        historical_data.append(
            {
                "lat": d["location"]["latitude"],
                "lng": d["location"]["longitude"],
                "category": d["ai_analysis"]["category"],
                "severity": d["ai_analysis"]["severity_score"],
                "status": d.get("status"),
            }
        )

    if len(historical_data) < 5:
        return []  # Not enough data to predict

    model = genai.GenerativeModel(
        model_name="gemini-2.5-pro",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=HOTSPOT_SCHEMA,
        ),
        system_instruction=(
            "You are an urban infrastructure risk prediction system. "
            "Analyze spatial clusters of civic issue reports. "
            "Identify zones where frequency or pattern of minor failures "
            "indicates imminent larger infrastructure breakdown. "
            "Return geographic cluster centroids with risk assessments."
        ),
    )

    prompt = (
        f"Here are the last {len(historical_data)} civic issue reports:\n"
        f"{json.dumps(historical_data, indent=2)}\n\n"
        "Identify spatial clusters showing elevated risk. "
        "For each cluster, provide its centroid coordinates, risk level "
        "(High/Medium/Low), predicted hazard type, preventative recommendation, "
        "and your confidence score (0.0-1.0)."
    )

    response = model.generate_content(prompt)
    return json.loads(response.text)
