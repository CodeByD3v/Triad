from fastapi import APIRouter
from firebase_client import db

router = APIRouter()


@router.get("/leaderboard")
def get_leaderboard(ward: str = None, limit: int = 10):
    query = (
        db.collection("users")
        .order_by("xp", direction="DESCENDING")
        .limit(limit)
    )
    users = []
    for doc in query.stream():
        d = doc.to_dict()
        d["uid"] = doc.id
        users.append(d)
    return {"leaderboard": users}


@router.get("/users/{uid}")
def get_user_profile(uid: str):
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return {"uid": uid, "xp": 0, "badges": [], "report_count": 0}
    d = doc.to_dict()
    d["uid"] = uid
    return d
