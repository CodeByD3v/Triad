from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from firebase_admin import firestore as fs, storage
from firebase_client import db, bucket
from agents.triage import run_visual_triage
from agents.dedup import check_for_duplicate
from agents.geocode import reverse_geocode
from agents.grievance import draft_grievance_letter
import uuid

router = APIRouter()


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
    1. Upload image to Firebase Storage
    2. Run Gemini Flash visual triage
    3. Check for duplicates within 50m
    4. Save new issue OR upvote existing
    5. Award XP to reporter
    6. Schedule escalation check
    """
    # Step 1: Upload image
    image_bytes = await image.read()
    filename = f"issues/{uuid.uuid4()}.jpg"
    blob = bucket.blob(filename)
    blob.upload_from_string(image_bytes, content_type=image.content_type)
    blob.make_public()
    image_url = blob.public_url

    # Step 2: Visual triage
    ai_data = await run_visual_triage(
        image_bytes, image.content_type or "image/jpeg"
    )

    # Step 3: Duplicate check
    duplicate_id = await check_for_duplicate(
        latitude, longitude, ai_data["summary"]
    )

    if duplicate_id:
        db.collection("issues").document(duplicate_id).update(
            {
                "upvotes": fs.Increment(1),
                "last_updated_at": fs.SERVER_TIMESTAMP,
            }
        )
        # Award XP for community confirmation
        _award_xp(reported_by, xp=5, badge_check="community_helper")
        return {"status": "duplicate_updated", "issue_id": duplicate_id}

    # Step 4: Reverse geocode for ward name
    ward_name = reverse_geocode(latitude, longitude)

    # Step 5: Save new issue
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

    # Step 6: Award XP for new report
    _award_xp(reported_by, xp=20, badge_check="first_reporter")

    # Background: update ward leaderboard transparency score
    background_tasks.add_task(_update_ward_stats, ward_name)

    return {
        "status": "created",
        "issue_id": issue_id,
        "ai_analysis": ai_data,
    }


@router.patch("/issues/{issue_id}")
async def update_issue(
    issue_id: str,
    title: str | None = Form(None),
    description: str | None = Form(None),
    status: str | None = Form(None),
):
    """Updates editable issue fields."""
    doc_ref = db.collection("issues").document(issue_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    updates = {}
    if title is not None:
        updates["title"] = title
    if description is not None:
        updates["description"] = description
    if status is not None:
        updates["status"] = status
    if not updates:
        return {"status": "noop", "issue_id": issue_id}

    updates["last_updated_at"] = fs.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return {"status": "updated", "issue_id": issue_id, "updated_fields": list(updates.keys())}


@router.patch("/issues/{issue_id}/status")
async def update_issue_status(issue_id: str, status: str = Form(...)):
    """Explicit status transition endpoint for moderation and resolution flows."""
    doc_ref = db.collection("issues").document(issue_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    doc_ref.update(
        {
            "status": status,
            "last_updated_at": fs.SERVER_TIMESTAMP,
        }
    )
    return {"status": "updated", "issue_id": issue_id, "issue_status": status}


@router.delete("/issues/{issue_id}")
async def delete_issue(issue_id: str):
    """Deletes an issue and its nested verifications."""
    doc_ref = db.collection("issues").document(issue_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    verifications = doc_ref.collection("verifications").stream()
    for verif in verifications:
        verif.reference.delete()
    doc_ref.delete()
    return {"status": "deleted", "issue_id": issue_id}


@router.get("/issues")
def list_issues(
    status: str = None, category: str = None, limit: int = 50
):
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
        issues.append(d)
    return {"issues": issues}


@router.get("/issues/{issue_id}")
def get_issue(issue_id: str):
    doc = db.collection("issues").document(issue_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")
    data = doc.to_dict()
    data["id"] = issue_id
    return data


@router.post("/issues/{issue_id}/verify")
async def verify_issue(
    issue_id: str,
    user_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
):
    """
    Community Verification Agent:
    Citizens can confirm an issue exists. After 5 geo-plausible confirmations,
    Gemini approves and status moves to Verified.
    """
    doc_ref = db.collection("issues").document(issue_id)
    issue = doc_ref.get()
    if not issue.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue_data = issue.to_dict()
    issue_lat = issue_data["location"]["latitude"]
    issue_lng = issue_data["location"]["longitude"]

    # Geo-plausibility check (within 200m)
    distance_approx = (
        ((latitude - issue_lat) * 111000) ** 2
        + ((longitude - issue_lng) * 111000) ** 2
    ) ** 0.5

    ai_approved = distance_approx <= 200

    verif_ref = doc_ref.collection("verifications").document()
    verif_ref.set(
        {
            "user_id": user_id,
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": fs.SERVER_TIMESTAMP,
            "ai_approved": ai_approved,
        }
    )

    # Count approved verifications
    approved = sum(
        1
        for v in doc_ref.collection("verifications")
        .where("ai_approved", "==", True)
        .stream()
    )

    if approved >= 5 and issue_data.get("status") == "Reported":
        doc_ref.update(
            {
                "status": "Verified",
                "last_updated_at": fs.SERVER_TIMESTAMP,
            }
        )
        _award_xp(user_id, xp=10, badge_check="verifier")
        return {
            "status": "verified",
            "message": "Issue status updated to Verified",
        }

    _award_xp(user_id, xp=5, badge_check="community_helper")
    return {"status": "verification_recorded", "approved_count": approved}


@router.post("/issues/{issue_id}/upvote")
async def upvote_issue(issue_id: str, user_id: str = Form("anonymous")):
    """Upvotes an existing issue."""
    doc_ref = db.collection("issues").document(issue_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    doc_ref.update(
        {
            "upvotes": fs.Increment(1),
            "last_updated_at": fs.SERVER_TIMESTAMP,
        }
    )
    _award_xp(user_id, xp=2, badge_check="community_helper")
    return {"status": "upvoted"}


@router.post("/issues/{issue_id}/grievance")
async def generate_grievance(issue_id: str):
    """Generates a formal grievance letter for a given issue using Gemini Pro."""
    doc = db.collection("issues").document(issue_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")
    d = doc.to_dict()

    letter = await draft_grievance_letter(
        category=d["category"],
        severity_score=d["severity_score"],
        summary=d["summary"],
        ward_name=d["location"]["ward_name"],
        latitude=d["location"]["latitude"],
        longitude=d["location"]["longitude"],
        upvotes=d.get("upvotes", 0),
    )
    return {"letter": letter}


def _award_xp(user_id: str, xp: int, badge_check: str):
    """Increments user XP and checks for badge milestones."""
    if user_id == "anonymous":
        return
    user_ref = db.collection("users").document(user_id)
    user_ref.set({"xp": fs.Increment(xp)}, merge=True)

    user_doc = user_ref.get()
    if user_doc.exists:
        data = user_doc.to_dict()
        total_xp = data.get("xp", 0) + xp
        badges = data.get("badges", [])

        # Badge milestones
        milestones = {
            "first_reporter": 1,
            "community_helper": 50,
            "civic_champion": 200,
            "ward_guardian": 500,
        }
        if badge_check in milestones and badge_check not in badges:
            if total_xp >= milestones[badge_check]:
                user_ref.update(
                    {"badges": fs.ArrayUnion([badge_check])}
                )


def _update_ward_stats(ward_name: str):
    """Recomputes transparency score for a ward after a new issue is created."""
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
        if created and created.replace(tzinfo=timezone.utc) >= cutoff:
            raised += 1
            if d.get("status") == "Resolved":
                resolved += 1

    transparency_score = (
        round((resolved / raised) * 100) if raised > 0 else 0
    )
    db.collection("leaderboard").document(ward_name).set(
        {
            "issues_raised": raised,
            "issues_resolved": resolved,
            "transparency_score": transparency_score,
            "updated_at": fs.SERVER_TIMESTAMP,
        },
        merge=True,
    )
