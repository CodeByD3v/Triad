from fastapi import APIRouter, BackgroundTasks
from agents.hotspot import run_hotspot_analysis
from agents.escalation import run_escalation_check
from firebase_client import db

router = APIRouter()


@router.get("/analytics/hotspots")
async def get_hotspots():
    """Runs predictive hotspot analysis and returns cluster data for map overlay."""
    predictions = await run_hotspot_analysis()
    return {"status": "success", "hotspots": predictions}


@router.post("/analytics/run-escalation")
async def trigger_escalation(background_tasks: BackgroundTasks):
    """Manually triggers the escalation agent (also runs on a cron schedule)."""
    background_tasks.add_task(run_escalation_check)
    return {"status": "escalation_check_complete"}


@router.get("/analytics/transparency")
def get_transparency_scores():
    """Returns per-ward Civic Transparency Scores for the dashboard."""
    docs = db.collection("leaderboard").stream()
    scores = []
    for doc in docs:
        d = doc.to_dict()
        d["ward_name"] = doc.id
        scores.append(d)
    scores.sort(
        key=lambda x: x.get("transparency_score", 0), reverse=True
    )
    return {"wards": scores}
