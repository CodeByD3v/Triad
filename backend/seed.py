"""
Seed script — run once locally to populate Firestore with demo data.
Usage: cd backend && python seed.py

Make sure serviceAccountKey.json is in backend/ and .env is loaded.
"""
from dotenv import load_dotenv
load_dotenv()

from firebase_client import db
from firebase_admin import firestore as fs
import uuid

ISSUES = [
    {
        "category": "Roadways / Pothole",
        "severity_score": 9,
        "summary": "Massive crater pothole on main arterial road causing vehicle damage and accidents.",
        "tags": ["pothole", "traffic-hazard", "immediate-repair"],
        "location": {"latitude": 11.2588, "longitude": 75.7804, "ward_name": "Kozhikode"},
        "status": "Escalated",
        "upvotes": 23,
        "image_url": "https://placehold.co/600x400/1a1a2e/ef4444?text=Pothole+%F0%9F%9A%A7",
    },
    {
        "category": "Utilities / Water Leak",
        "severity_score": 8,
        "summary": "Major water main burst flooding the footpath and causing road subsidence.",
        "tags": ["water-leak", "flood-risk", "urgent"],
        "location": {"latitude": 11.2620, "longitude": 75.7850, "ward_name": "Kozhikode"},
        "status": "In-Progress",
        "upvotes": 18,
        "image_url": "https://placehold.co/600x400/1a1a2e/3b82f6?text=Water+Leak+%F0%9F%92%A7",
    },
    {
        "category": "Sanitation / Waste Dump",
        "severity_score": 7,
        "summary": "Illegal waste dumping near residential area causing health hazards.",
        "tags": ["waste", "sanitation", "health-risk"],
        "location": {"latitude": 11.2550, "longitude": 75.7780, "ward_name": "Kozhikode"},
        "status": "Verified",
        "upvotes": 14,
        "image_url": "https://placehold.co/600x400/1a1a2e/f59e0b?text=Waste+Dump+%F0%9F%97%91%EF%B8%8F",
    },
    {
        "category": "Lighting / Broken Streetlight",
        "severity_score": 6,
        "summary": "Three consecutive streetlights out near school zone creating safety risk at night.",
        "tags": ["lighting", "school-zone", "safety"],
        "location": {"latitude": 11.2600, "longitude": 75.7900, "ward_name": "Kozhikode"},
        "status": "Reported",
        "upvotes": 9,
        "image_url": "https://placehold.co/600x400/1a1a2e/6366f1?text=Streetlight+%F0%9F%92%A1",
    },
    {
        "category": "Roadways / Pothole",
        "severity_score": 5,
        "summary": "Multiple shallow potholes on residential street affecting daily commuters.",
        "tags": ["pothole", "residential", "repair-needed"],
        "location": {"latitude": 11.2500, "longitude": 75.7700, "ward_name": "Calicut Beach"},
        "status": "Reported",
        "upvotes": 6,
        "image_url": "https://placehold.co/600x400/1a1a2e/f59e0b?text=Potholes+%F0%9F%9B%A3%EF%B8%8F",
    },
    {
        "category": "Infrastructure / Damaged Bridge",
        "severity_score": 9,
        "summary": "Visible cracks in bridge railing — immediate structural assessment required.",
        "tags": ["bridge", "structural", "critical"],
        "location": {"latitude": 11.2650, "longitude": 75.7750, "ward_name": "Palayam"},
        "status": "Escalated",
        "upvotes": 31,
        "image_url": "https://placehold.co/600x400/1a1a2e/ef4444?text=Bridge+Damage+%F0%9F%8C%89",
    },
    {
        "category": "Sanitation / Blocked Drain",
        "severity_score": 7,
        "summary": "Severely blocked storm drain causing water logging during light rain.",
        "tags": ["drain", "flooding", "monsoon-risk"],
        "location": {"latitude": 11.2480, "longitude": 75.7820, "ward_name": "Palayam"},
        "status": "Verified",
        "upvotes": 11,
        "image_url": "https://placehold.co/600x400/1a1a2e/f59e0b?text=Blocked+Drain+%F0%9F%8C%8A",
    },
    {
        "category": "Roadways / Pothole",
        "severity_score": 4,
        "summary": "Minor pothole near bus stop — low severity but frequently reported.",
        "tags": ["pothole", "minor", "bus-stop"],
        "location": {"latitude": 11.2530, "longitude": 75.7860, "ward_name": "Calicut Beach"},
        "status": "Resolved",
        "upvotes": 3,
        "image_url": "https://placehold.co/600x400/1a1a2e/22c55e?text=Resolved+%E2%9C%85",
    },
    {
        "category": "Utilities / Power Outage",
        "severity_score": 6,
        "summary": "Recurring power cuts in sector affecting hospital and residential buildings.",
        "tags": ["power", "hospital-nearby", "recurring"],
        "location": {"latitude": 11.2700, "longitude": 75.7930, "ward_name": "Medical College"},
        "status": "In-Progress",
        "upvotes": 16,
        "image_url": "https://placehold.co/600x400/1a1a2e/6366f1?text=Power+Outage+%E2%9A%A1",
    },
    {
        "category": "Public Property / Damaged Footpath",
        "severity_score": 5,
        "summary": "Badly broken footpath tiles causing tripping hazard for pedestrians.",
        "tags": ["footpath", "pedestrian", "accessibility"],
        "location": {"latitude": 11.2560, "longitude": 75.7810, "ward_name": "Medical College"},
        "status": "Reported",
        "upvotes": 7,
        "image_url": "https://placehold.co/600x400/1a1a2e/f59e0b?text=Footpath+%F0%9F%9A%B6",
    },
]


def seed():
    print("🌱 Seeding Firestore with demo issues...")
    for issue in ISSUES:
        issue_id = str(uuid.uuid4())
        doc = {
            "title": f"{issue['category']} — {issue['location']['ward_name']}",
            "description": "",
            "image_url": issue["image_url"],
            "location": issue["location"],
            "category": issue["category"],
            "severity_score": issue["severity_score"],
            "summary": issue["summary"],
            "tags": issue["tags"],
            "status": issue["status"],
            "upvotes": issue["upvotes"],
            "reported_by": "seed-script",
            "created_at": fs.SERVER_TIMESTAMP,
            "last_updated_at": fs.SERVER_TIMESTAMP,
            "ai_analysis": {
                "category": issue["category"],
                "severity_score": issue["severity_score"],
                "summary": issue["summary"],
                "tags": issue["tags"],
            },
            "escalated_at": None,
            "escalation_reason": (
                "Auto-escalated due to high community demand and extended unresolved status."
                if issue["status"] == "Escalated" else None
            ),
        }
        db.collection("issues").document(issue_id).set(doc)
        print(f"  ✅ [{issue['status']:12}] {issue['category']} — {issue['location']['ward_name']}")

    # Seed leaderboard transparency scores
    wards = {
        "Kozhikode":     {"issues_raised": 8, "issues_resolved": 2, "transparency_score": 25},
        "Calicut Beach": {"issues_raised": 4, "issues_resolved": 1, "transparency_score": 25},
        "Palayam":       {"issues_raised": 3, "issues_resolved": 0, "transparency_score": 0},
        "Medical College": {"issues_raised": 2, "issues_resolved": 0, "transparency_score": 0},
    }
    for ward_name, data in wards.items():
        db.collection("leaderboard").document(ward_name).set({
            **data,
            "updated_at": fs.SERVER_TIMESTAMP,
        })
        print(f"  📊 Ward: {ward_name} — transparency {data['transparency_score']}%")

    print(f"\n✅ Seeded {len(ISSUES)} issues and {len(wards)} wards successfully!")
    print("   Run: uvicorn main:app --reload  and open the dashboard")


if __name__ == "__main__":
    seed()
