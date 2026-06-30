from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from firebase_admin import firestore as fs
from firebase_client import db
from storage import upload_image
from agents.triage import run_visual_triage
from agents.dedup import check_for_duplicate
from agents.geocode import reverse_geocode
from agents.grievance import draft_grievance_letter
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES    = 10 * 1024 * 1024  # 10 MB


@router.post("/issues")
async def create_issue(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: str = Form(""),
    reported_by: str = Form("anonymous"),
):
    """
    Full agentic pipeline:
    1. Validate image (type + size)
    2. Upload image to AWS S3
    3. Run Gemini Flash visual triage (with fallback)
    4. Check for duplicates within 50m
    5. Save new issue OR upvote existing
    6. Award XP to reporter
    7. Update ward transparency score in background
    """
    # Step 1: Validate image type and size BEFORE hitting S3 or Gemini
    content_type = image.content_type or "image/jpeg"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Please upload a JPG, PNG, or WEBP image."
        )

    image_bytes = await image.read()

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large ({len(image_bytes) // (1024*1024)}MB). Maximum allowed size is 10MB."
        )

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Step 2: Upload image to S3
    try:
        image_url = upload_image(image_bytes, content_type)
    except Exception as e:
        logger.error(f"[Issues] S3 upload failed: {e}")
        raise HTTPException(status_code=503, detail="Image upload failed. Please try again.")

    # Step 3: Visual triage via Gemini Flash (never crashes — has fallback)
    ai_data = await run_visual_triage(image_bytes, content_type)

    # Step 4: Duplicate detection within 50m radius
    try:
        duplicate_id = await check_for_duplicate(
            latitude, longitude, ai_data["summary"]
        )
    except Exception as e:
        logger.warning(f"[Issues] Dedup check failed (skipping): {e}")
        duplicate_id = None

    if duplicate_id:
        db.collection("issues").document(duplicate_id).update({
            "upvotes": fs.Increment(1),
            "last_updated_at": fs.SERVER_TIMESTAMP,
        })
        _award_xp(reported_by, xp=5, badge_check="community_helper")
        return {"status": "duplicate_updated", "issue_id": duplicate_id}

    # Step 5: Reverse geocode coordinates → ward name
    try:
        ward_name = reverse_geocode(latitude, longitude)
    except Exception:
        ward_name = f"{latitude:.4f}, {longitude:.4f}"

    # Step 6: Save new issue to Firestore
    issue_id = str(uuid.uuid4())
    issue_data = {
        "title": f"{ai_data['category']} — {ward_name}",
        "description": description,
        "image_url": image_url,
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "ward_name": ward_name,
        },
        "category": ai_data["category"],
        "severity_score": ai_data["severity_score"],
        "summary": ai_data["summary"],
        "tags": ai_data["tags"],
        "status": "Reported",
        "upvotes": 1,
        "reported_by": reported_by,
        "created_at": fs.SERVER_TIMESTAMP,
        "last_updated_at": fs.SERVER_TIMESTAMP,
        "ai_analysis": ai_data,
        "escalated_at": None,
        "escalation_reason": None,
    }

    db.collection("issues").document(issue_id).set(issue_data)

    # Step 7: Award XP + update ward stats in background
    _award_xp(reported_by, xp=20, badge_check="first_reporter")
    background_tasks.add_task(_update_ward_stats, ward_name)

    return {"status": "created", "issue_id": issue_id, "ai_analysis": ai_data}


@router.get("/issues")
def list_issues(status: str = None, category: str = None, limit: int = 50):
    query = db.collection("issues")
    if status:
        query = query.where("status", "==", status)
    if category:
        query = query.where("category", "==", category)
    query = query.order_by("created_at", direction="DESCENDING").limit(limit)

    issues = []
    for doc in query.stream():
        d = doc.to_dict()
        d["id"] = doc.id
        for field in ["created_at", "last_updated_at", "escalated_at"]:
            if d.get(field) and hasattr(d[field], "isoformat"):
                d[field] = d[field].isoformat()
        issues.append(d)
    return {"issues": issues}


@router.get("/issues/{issue_id}")
def get_issue(issue_id: str):
    doc = db.collection("issues").document(issue_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")
    data = doc.to_dict()
    data["id"] = issue_id
    for field in ["created_at", "last_updated_at", "escalated_at"]:
        if data.get(field) and hasattr(data[field], "isoformat"):
            data[field] = data[field].isoformat()
    return data


@router.patch("/issues/{issue_id}/status")
def update_issue_status(issue_id: str, status: str = Form(...)):
    valid = ["Reported", "Verified", "In-Progress", "Escalated", "Resolved"]
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
    db.collection("issues").document(issue_id).update({
        "status": status,
        "last_updated_at": fs.SERVER_TIMESTAMP,
    })
    return {"status": "updated", "new_status": status}


@router.post("/issues/{issue_id}/upvote")
def upvote_issue(issue_id: str, user_id: str = Form("anonymous")):
    db.collection("issues").document(issue_id).update({
        "upvotes": fs.Increment(1),
        "last_updated_at": fs.SERVER_TIMESTAMP,
    })
    _award_xp(user_id, xp=2, badge_check="community_helper")
    return {"status": "upvoted"}


@router.post("/issues/{issue_id}/verify")
async def verify_issue(
    issue_id: str,
    user_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
):
    """Community Verification: 5 geo-plausible confirmations → Verified."""
    doc_ref = db.collection("issues").document(issue_id)
    issue = doc_ref.get()
    if not issue.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue_data = issue.to_dict()
    issue_lat = issue_data["location"]["latitude"]
    issue_lng = issue_data["location"]["longitude"]

    distance_approx = (
        ((latitude - issue_lat) * 111000) ** 2 +
        ((longitude - issue_lng) * 111000) ** 2
    ) ** 0.5
    ai_approved = distance_approx <= 200

    verif_ref = doc_ref.collection("verifications").document()
    verif_ref.set({
        "user_id": user_id,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": fs.SERVER_TIMESTAMP,
        "ai_approved": ai_approved,
    })

    approved = sum(
        1 for _ in doc_ref.collection("verifications")
        .where("ai_approved", "==", True).stream()
    )

    if approved >= 5 and issue_data.get("status") == "Reported":
        doc_ref.update({
            "status": "Verified",
            "last_updated_at": fs.SERVER_TIMESTAMP,
        })
        _award_xp(user_id, xp=10, badge_check="verifier")
        return {"status": "verified", "message": "Issue moved to Verified"}

    _award_xp(user_id, xp=5, badge_check="community_helper")
    return {"status": "verification_recorded", "approved_count": approved}


@router.post("/issues/{issue_id}/grievance")
async def generate_grievance(issue_id: str):
    """Generates a formal grievance letter using Gemini Pro."""
    doc = db.collection("issues").document(issue_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")
    d = doc.to_dict()

    try:
        letter = await draft_grievance_letter(
            category=d["category"],
            severity_score=d["severity_score"],
            summary=d["summary"],
            ward_name=d["location"]["ward_name"],
            latitude=d["location"]["latitude"],
            longitude=d["location"]["longitude"],
            upvotes=d.get("upvotes", 0),
        )
    except Exception as e:
        logger.error(f"[Grievance] Gemini Pro failed: {e}")
        raise HTTPException(status_code=503, detail="Letter generation failed. Please try again.")

    return {"letter": letter}


# ── Demo-only endpoint: force-escalate for video recording ───────────────────
@router.post("/issues/{issue_id}/demo-escalate")
def demo_escalate(issue_id: str, upvotes: int = Form(15)):
    """
    DEV/DEMO ONLY: sets upvotes to a high number so the escalation agent
    picks it up immediately. Remove or protect before production.
    """
    db.collection("issues").document(issue_id).update({
        "upvotes": upvotes,
        "last_updated_at": fs.SERVER_TIMESTAMP,
    })
    return {"status": "demo_escalation_set", "upvotes": upvotes}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _award_xp(user_id: str, xp: int, badge_check: str):
    """Increments user XP and checks badge milestones."""
    if user_id == "anonymous":
        return
    try:
        user_ref = db.collection("users").document(user_id)
        user_ref.set({"xp": fs.Increment(xp)}, merge=True)

        user_doc = user_ref.get()
        if not user_doc.exists:
            return

        data = user_doc.to_dict()
        total_xp = data.get("xp", 0)
        badges = data.get("badges", [])

        milestones = {
            "first_reporter":   20,
            "community_helper": 50,
            "civic_champion":   200,
            "ward_guardian":    500,
        }
        if badge_check in milestones and badge_check not in badges:
            if total_xp >= milestones[badge_check]:
                user_ref.update({"badges": fs.ArrayUnion([badge_check])})
    except Exception as e:
        logger.warning(f"[XP] Award failed for {user_id}: {e}")


def _update_ward_stats(ward_name: str):
    """Recomputes Civic Transparency Score for a ward."""
    try:
        from datetime import datetime, timezone, timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

        ward_issues = (
            db.collection("issues")
            .where("location.ward_name", "==", ward_name)
            .stream()
        )

        raised = resolved = 0
        for doc in ward_issues:
            d = doc.to_dict()
            created = d.get("created_at")
            if created and hasattr(created, "replace"):
                if created.replace(tzinfo=timezone.utc) >= cutoff:
                    raised += 1
                    if d.get("status") == "Resolved":
                        resolved += 1

        transparency_score = round((resolved / raised) * 100) if raised > 0 else 0
        db.collection("leaderboard").document(ward_name).set({
            "issues_raised": raised,
            "issues_resolved": resolved,
            "transparency_score": transparency_score,
            "updated_at": fs.SERVER_TIMESTAMP,
        }, merge=True)
    except Exception as e:
        logger.warning(f"[Ward stats] Update failed for {ward_name}: {e}")
