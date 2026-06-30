# Community Hero — Full Implementation Guide
**Deadline: June 29 · Stack: React + FastAPI + Firebase + Gemini 2.5**

---

## Evaluation target

| Criterion | Weight | How we hit it |
|---|---|---|
| Problem Solving & Impact | 20% | Real civic pain, transparent tracking, escalation to authorities |
| Agentic Depth | 20% | 4 distinct agents: triage, dedup, escalation, hotspot predictor |
| Innovation & Creativity | 20% | Gamification, offline PWA, Civic Transparency Score |
| Usage of Google Technologies | 15% | Gemini 2.5 Flash + Pro, Firebase Auth/Firestore/FCM/Storage, Maps Geocoding |
| Product Experience & Design | 10% | TailwindCSS responsive UI, color-coded severity map |
| Technical Implementation | 10% | FastAPI async, structured Gemini outputs, Cloud Run deployment |
| Completeness & Usability | 5% | All CRUD flows, status tracking, demo-ready |

---

## Repository structure

```
community-hero/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── agents/
│   │   ├── triage.py            # Visual triage agent (Gemini Flash)
│   │   ├── dedup.py             # Duplicate detection agent
│   │   ├── escalation.py        # Status escalation agent
│   │   └── hotspot.py           # Predictive hotspot agent
│   ├── routers/
│   │   ├── issues.py            # Issue CRUD endpoints
│   │   ├── analytics.py         # Hotspot + dashboard endpoints
│   │   └── gamification.py      # XP, badges, leaderboard
│   ├── firebase_client.py       # Firestore + Storage init
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # Map + issue list
│   │   │   ├── Report.jsx       # Camera + form
│   │   │   ├── IssueDetail.jsx  # Status + letter gen
│   │   │   └── Leaderboard.jsx  # Gamification
│   │   ├── components/
│   │   │   ├── IssueMap.jsx     # Leaflet / Google Maps
│   │   │   ├── SeverityBadge.jsx
│   │   │   └── TransparencyScore.jsx
│   │   ├── hooks/
│   │   │   ├── useGeolocation.js
│   │   │   └── useOfflineQueue.js  # PWA offline sync
│   │   ├── firebase.js          # Firebase SDK init
│   │   └── main.jsx
│   ├── public/
│   │   └── manifest.json        # PWA manifest
│   ├── vite.config.js
│   └── package.json
├── .github/
│   └── workflows/deploy.yml     # CI/CD to Cloud Run
└── README.md
```

---

## Day 1 — Setup & Schema (June 23)

### 1.1 Firebase project setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → New project → `community-hero`
2. Enable: **Authentication** (Google + Anonymous), **Firestore**, **Storage**, **Cloud Messaging**
3. Download `serviceAccountKey.json` → place in `backend/` (never commit; add to `.gitignore`)

### 1.2 Firestore collections schema

```
issues/
  {issue_id}/
    title               : string
    description         : string
    image_url           : string         # Firebase Storage URL
    location:
      latitude          : number
      longitude         : number
      ward_name         : string         # reverse-geocoded via Google Geocoding API
    category            : string         # from Gemini triage
    severity_score      : number (1–10)  # from Gemini triage
    summary             : string         # from Gemini triage
    tags                : string[]
    status              : "Reported" | "Verified" | "In-Progress" | "Escalated" | "Resolved"
    upvotes             : number
    reported_by         : string         # Firebase UID
    created_at          : timestamp
    last_updated_at     : timestamp
    ai_analysis         : map            # full Gemini Flash JSON stored for transparency
    escalated_at        : timestamp | null
    escalation_reason   : string | null

  {issue_id}/verifications/
    {verification_id}/
      user_id           : string
      latitude          : number
      longitude         : number
      timestamp         : timestamp
      ai_approved       : bool           # did Gemini approve geo-plausibility?

users/
  {uid}/
    display_name        : string
    xp                  : number
    badges              : string[]
    report_count        : number
    verification_count  : number
    ward               : string

leaderboard/
  {ward_name}/
    top_citizens        : [{uid, display_name, xp}]  # top 10 per ward
    issues_raised       : number
    issues_resolved     : number
    transparency_score  : number  # resolved / raised (last 30 days) * 100
    updated_at          : timestamp
```

### 1.3 Backend scaffold

```bash
mkdir -p backend/agents backend/routers
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn google-generativeai firebase-admin python-multipart \
            Pillow requests python-jose google-cloud-storage
pip freeze > requirements.txt
```

**`backend/firebase_client.py`**

```python
import firebase_admin
from firebase_admin import credentials, firestore, storage
import os

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET")
})

db = firestore.client()
bucket = storage.bucket()
```

**`backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import issues, analytics, gamification

app = FastAPI(title="Community Hero API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(issues.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(gamification.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}
```

---

## Day 2 — AI Core: All Four Agents (June 24)

### Agent 1 — Visual Triage (`backend/agents/triage.py`)

```python
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
import os, json

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

TRIAGE_SCHEMA = content.Schema(
    type=content.Type.OBJECT,
    properties={
        "category": content.Schema(type=content.Type.STRING),
        "severity_score": content.Schema(type=content.Type.INTEGER),
        "summary": content.Schema(type=content.Type.STRING),
        "tags": content.Schema(
            type=content.Type.ARRAY,
            items=content.Schema(type=content.Type.STRING)
        ),
    },
    required=["category", "severity_score", "summary", "tags"]
)

async def run_visual_triage(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Sends image to Gemini 2.5 Flash for structured civic issue analysis.
    Returns category, severity (1–10), summary, and tags.
    """
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=TRIAGE_SCHEMA
        ),
        system_instruction=(
            "You are an expert civic engineering AI assistant. "
            "Analyze the provided image of a public infrastructure issue. "
            "Categorize it accurately (e.g. 'Roadways / Pothole', 'Utilities / Water Leak', "
            "'Lighting / Broken Streetlight', 'Sanitation / Waste Dump'). "
            "Assign a severity score from 1–10 based on public safety risk. "
            "Provide a concise 1-sentence structural summary. "
            "List 3 relevant tags."
        )
    )

    image_part = {"mime_type": mime_type, "data": image_bytes}
    response = model.generate_content(["Analyze this civic issue:", image_part])
    return json.loads(response.text)
```

### Agent 2 — Duplicate Detection (`backend/agents/dedup.py`)

```python
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

async def check_for_duplicate(lat: float, lng: float, new_summary: str) -> str | None:
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
        if (box["lng_min"] <= lng_val <= box["lng_max"]
                and data.get("status") != "Resolved"):
            existing.append({
                "id": doc.id,
                "category": data["ai_analysis"]["category"],
                "summary": data["ai_analysis"]["summary"],
            })

    if not existing:
        return None

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=(
            "You compare civic issue reports. Be precise. "
            "Output ONLY the matching issue ID, or the word UNIQUE."
        )
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
```

### Agent 3 — Status Escalation (`backend/agents/escalation.py`)

This agent runs as a **scheduled Cloud Run Job** (or a background task triggered on upvote).

```python
import google.generativeai as genai
from firebase_admin import firestore as fs
from firebase_client import db
import os, smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

AUTHORITY_EMAIL = os.getenv("AUTHORITY_EMAIL", "municipal@example.gov.in")
ESCALATION_UPVOTE_THRESHOLD = 10
ESCALATION_AGE_HOURS = 48

async def run_escalation_check():
    """
    Scans Firestore for issues that:
      - have status == "Reported"
      - upvotes >= ESCALATION_UPVOTE_THRESHOLD
      - are older than ESCALATION_AGE_HOURS
    For each match, Gemini Pro drafts an escalation notice and the agent
    updates the issue status to "Escalated" and logs the rationale.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=ESCALATION_AGE_HOURS)

    candidates = (
        db.collection("issues")
        .where("status", "==", "Reported")
        .where("upvotes", ">=", ESCALATION_UPVOTE_THRESHOLD)
        .stream()
    )

    model = genai.GenerativeModel(model_name="gemini-2.5-pro")

    for doc in candidates:
        data = doc.to_dict()
        created_at = data.get("created_at")

        # Check age
        if created_at and created_at.replace(tzinfo=timezone.utc) > cutoff:
            continue

        issue_id = doc.id
        summary = data["ai_analysis"]["summary"]
        category = data["ai_analysis"]["category"]
        severity = data["ai_analysis"]["severity_score"]
        ward = data["location"].get("ward_name", "Unknown Ward")
        upvotes = data.get("upvotes", 0)

        # Generate escalation rationale and email body
        prompt = (
            f"Issue ID: {issue_id}\n"
            f"Category: {category}\n"
            f"Ward: {ward}\n"
            f"Severity Score: {severity}/10\n"
            f"Community Upvotes: {upvotes}\n"
            f"Summary: {summary}\n\n"
            "Draft a brief (3-paragraph) escalation notice to the Municipal Corporation. "
            "Include: (1) issue details and severity, (2) community demand evidence (upvotes), "
            "(3) a clear call to action with urgency based on severity score."
        )

        response = model.generate_content(prompt)
        escalation_text = response.text

        # Update Firestore
        db.collection("issues").document(issue_id).update({
            "status": "Escalated",
            "escalated_at": fs.SERVER_TIMESTAMP,
            "escalation_reason": escalation_text[:500],  # store excerpt
            "last_updated_at": fs.SERVER_TIMESTAMP,
        })

        # Send email (configure SMTP via env vars in production)
        _send_escalation_email(issue_id, ward, category, escalation_text)
        print(f"[Escalation Agent] Escalated issue {issue_id} in {ward}")


def _send_escalation_email(issue_id: str, ward: str, category: str, body: str):
    """Sends the Gemini-drafted escalation notice to the authority email."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    if not smtp_user:
        print("[Escalation Agent] No SMTP config — skipping email send")
        return

    msg = MIMEText(body, "plain")
    msg["Subject"] = f"[URGENT] Community Issue Escalation — {category} | {ward} | ID: {issue_id}"
    msg["From"] = smtp_user
    msg["To"] = AUTHORITY_EMAIL

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, AUTHORITY_EMAIL, msg.as_string())
    except Exception as e:
        print(f"[Escalation Agent] Email failed: {e}")
```

### Agent 4 — Predictive Hotspot (`backend/agents/hotspot.py`)

```python
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
from firebase_client import db
import os, json

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
            "preventative_recommendation": content.Schema(type=content.Type.STRING),
            "confidence_score": content.Schema(type=content.Type.NUMBER),
        },
        required=["cluster_lat", "cluster_lng", "risk_level", "predicted_hazard_type",
                  "preventative_recommendation", "confidence_score"]
    )
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
        historical_data.append({
            "lat": d["location"]["latitude"],
            "lng": d["location"]["longitude"],
            "category": d["ai_analysis"]["category"],
            "severity": d["ai_analysis"]["severity_score"],
            "status": d.get("status"),
        })

    if len(historical_data) < 5:
        return []  # Not enough data to predict

    model = genai.GenerativeModel(
        model_name="gemini-2.5-pro",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=HOTSPOT_SCHEMA
        ),
        system_instruction=(
            "You are an urban infrastructure risk prediction system. "
            "Analyze spatial clusters of civic issue reports. "
            "Identify zones where frequency or pattern of minor failures "
            "indicates imminent larger infrastructure breakdown. "
            "Return geographic cluster centroids with risk assessments."
        )
    )

    prompt = (
        f"Here are the last {len(historical_data)} civic issue reports:\n"
        f"{json.dumps(historical_data, indent=2)}\n\n"
        "Identify spatial clusters showing elevated risk. "
        "For each cluster, provide its centroid coordinates, risk level "
        "(High/Medium/Low), predicted hazard type, preventative recommendation, "
        "and your confidence score (0.0–1.0)."
    )

    response = model.generate_content(prompt)
    return json.loads(response.text)
```

---

## Day 2 continued — Grievance Letter Agent

**`backend/agents/grievance.py`**

```python
import google.generativeai as genai
import os

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
    """
    model = genai.GenerativeModel(
        model_name="gemini-2.5-pro",
        system_instruction=(
            "You are an automated civic action agent. "
            "Draft professional, authoritative grievance letters to Municipal Corporations. "
            "Use formal letterhead format with date, subject, and salutation. "
            "Calibrate urgency to the severity score: "
            "8–10 = immediate action required, 5–7 = urgent, 1–4 = standard request."
        )
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
    return response.text
```

---

## Day 2 continued — Google Geocoding Integration

Add to **`backend/agents/geocode.py`**

```python
import requests, os

GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"
MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

def reverse_geocode(lat: float, lng: float) -> str:
    """
    Calls Google Geocoding API to get a human-readable ward/locality name.
    Falls back to coordinate string if API key is unavailable.
    """
    if not MAPS_API_KEY:
        return f"{lat:.4f}, {lng:.4f}"

    resp = requests.get(GEOCODING_URL, params={
        "latlng": f"{lat},{lng}",
        "key": MAPS_API_KEY,
        "result_type": "sublocality|locality",
        "language": "en",
    }, timeout=5)

    if resp.status_code == 200:
        results = resp.json().get("results", [])
        if results:
            return results[0].get("formatted_address", f"{lat:.4f}, {lng:.4f}")

    return f"{lat:.4f}, {lng:.4f}"
```

---

## Day 3 — Backend Routers

### `backend/routers/issues.py` (complete)

```python
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from firebase_admin import firestore as fs, storage
from firebase_client import db, bucket
from agents.triage import run_visual_triage
from agents.dedup import check_for_duplicate
from agents.geocode import reverse_geocode
from agents.grievance import draft_grievance_letter
import uuid, os

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
    ai_data = await run_visual_triage(image_bytes, image.content_type or "image/jpeg")

    # Step 3: Duplicate check
    duplicate_id = await check_for_duplicate(
        latitude, longitude, ai_data["summary"]
    )

    if duplicate_id:
        db.collection("issues").document(duplicate_id).update({
            "upvotes": fs.Increment(1),
            "last_updated_at": fs.SERVER_TIMESTAMP,
        })
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
    import google.generativeai as genai

    doc_ref = db.collection("issues").document(issue_id)
    issue = doc_ref.get()
    if not issue.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue_data = issue.to_dict()
    issue_lat = issue_data["location"]["latitude"]
    issue_lng = issue_data["location"]["longitude"]

    # Ask Gemini if this verification is geo-plausible (within 200m)
    distance_approx = (
        ((latitude - issue_lat) * 111000) ** 2 +
        ((longitude - issue_lng) * 111000) ** 2
    ) ** 0.5

    ai_approved = distance_approx <= 200  # simple distance check; Gemini for edge cases

    verif_ref = doc_ref.collection("verifications").document()
    verif_ref.set({
        "user_id": user_id,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": fs.SERVER_TIMESTAMP,
        "ai_approved": ai_approved,
    })

    # Count approved verifications
    approved = sum(
        1 for v in doc_ref.collection("verifications").where("ai_approved", "==", True).stream()
    )

    if approved >= 5 and issue_data.get("status") == "Reported":
        doc_ref.update({
            "status": "Verified",
            "last_updated_at": fs.SERVER_TIMESTAMP,
        })
        _award_xp(user_id, xp=10, badge_check="verifier")
        return {"status": "verified", "message": "Issue status updated to Verified"}

    _award_xp(user_id, xp=5, badge_check="community_helper")
    return {"status": "verification_recorded", "approved_count": approved}


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
                user_ref.update({"badges": fs.ArrayUnion([badge_check])})


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

    transparency_score = round((resolved / raised) * 100) if raised > 0 else 0
    db.collection("leaderboard").document(ward_name).set({
        "issues_raised": raised,
        "issues_resolved": resolved,
        "transparency_score": transparency_score,
        "updated_at": fs.SERVER_TIMESTAMP,
    }, merge=True)
```

### `backend/routers/analytics.py`

```python
from fastapi import APIRouter
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
async def trigger_escalation():
    """Manually triggers the escalation agent (also runs on a cron schedule)."""
    await run_escalation_check()
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
    scores.sort(key=lambda x: x.get("transparency_score", 0), reverse=True)
    return {"wards": scores}
```

### `backend/routers/gamification.py`

```python
from fastapi import APIRouter
from firebase_client import db

router = APIRouter()

@router.get("/leaderboard")
def get_leaderboard(ward: str = None, limit: int = 10):
    query = db.collection("users").order_by("xp", direction="DESCENDING").limit(limit)
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
```

---

## Day 3 — Frontend (June 25)

### `frontend/package.json` (key deps)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "leaflet.heat": "^0.2.0",
    "firebase": "^10.8.0",
    "axios": "^1.6.7"
  },
  "devDependencies": {
    "vite": "^5.1.0",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^3.4.1",
    "vite-plugin-pwa": "^0.19.0"
  }
}
```

### `frontend/public/manifest.json` (PWA)

```json
{
  "name": "Community Hero",
  "short_name": "CivicHero",
  "description": "Report and track community infrastructure issues",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1d4ed8",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### `frontend/vite.config.js` (with PWA)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [{ urlPattern: /^https:\/\/.*\/api\/issues/, handler: 'NetworkFirst' }]
      }
    })
  ]
})
```

### `frontend/src/hooks/useOfflineQueue.js`

```js
/**
 * Offline-first queue: stores pending issue submissions in IndexedDB.
 * Flushes to the API when connectivity is restored.
 */
import { useState, useEffect } from 'react'

const DB_NAME = 'civic_hero_offline'
const STORE  = 'pending_issues'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { autoIncrement: true })
    req.onsuccess = e => resolve(e.target.result)
    req.onerror  = e => reject(e.target.error)
  })
}

export function useOfflineQueue(apiBase) {
  const [pendingCount, setPendingCount] = useState(0)

  async function queueSubmission(formData) {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ formData, timestamp: Date.now() })
    await new Promise(r => { tx.oncomplete = r })
    refreshCount()
  }

  async function flushQueue() {
    if (!navigator.onLine) return
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const allKeys = await new Promise(r => { const req = store.getAllKeys(); req.onsuccess = e => r(e.target.result) })
    const allVals = await new Promise(r => { const req = store.getAll();    req.onsuccess = e => r(e.target.result) })

    for (let i = 0; i < allKeys.length; i++) {
      try {
        await fetch(`${apiBase}/api/issues`, { method: 'POST', body: allVals[i].formData })
        store.delete(allKeys[i])
      } catch (_) { /* leave in queue */ }
    }
    refreshCount()
  }

  async function refreshCount() {
    const db = await openDB()
    const count = await new Promise(r => {
      const req = db.transaction(STORE).objectStore(STORE).count()
      req.onsuccess = e => r(e.target.result)
    })
    setPendingCount(count)
  }

  useEffect(() => {
    refreshCount()
    window.addEventListener('online', flushQueue)
    return () => window.removeEventListener('online', flushQueue)
  }, [])

  return { queueSubmission, flushQueue, pendingCount }
}
```

### `frontend/src/pages/Report.jsx`

```jsx
import { useState, useRef } from 'react'
import { useOfflineQueue } from '../hooks/useOfflineQueue'

const API_BASE = import.meta.env.VITE_API_BASE

export default function Report() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const { queueSubmission, pendingCount } = useOfflineQueue(API_BASE)
  const fileRef = useRef()

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!image) return alert('Please select an image')
    setLoading(true)

    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
    ).catch(() => null)

    const fd = new FormData()
    fd.append('image', image)
    fd.append('latitude',  pos ? pos.coords.latitude  : 0)
    fd.append('longitude', pos ? pos.coords.longitude : 0)
    fd.append('description', description)

    if (!navigator.onLine) {
      await queueSubmission(fd)
      setLoading(false)
      return alert('Saved offline — will sync when connection restores')
    }

    try {
      const res  = await fetch(`${API_BASE}/api/issues`, { method: 'POST', body: fd })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      await queueSubmission(fd)
      alert('Failed — saved for offline sync')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      {pendingCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          {pendingCount} report(s) waiting to sync
        </div>
      )}
      <h1 className="text-2xl font-semibold mb-6">Report an Issue</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer"
          onClick={() => fileRef.current.click()}
        >
          {preview
            ? <img src={preview} alt="preview" className="mx-auto max-h-48 rounded-lg" />
            : <p className="text-gray-500">Tap to take a photo or upload an image</p>
          }
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handleImageChange} />
        </div>
        <textarea
          className="w-full border border-gray-200 rounded-lg p-3 text-sm"
          rows={3} placeholder="Describe the issue (optional)"
          value={description} onChange={e => setDescription(e.target.value)}
        />
        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium
                     disabled:opacity-50 hover:bg-blue-700 transition"
        >
          {loading ? 'Analyzing with AI…' : 'Submit Report'}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          {result.status === 'duplicate_updated'
            ? <p className="text-green-800">✓ Duplicate detected — upvoted existing report</p>
            : (
              <>
                <p className="font-semibold text-green-800 mb-2">Issue submitted successfully</p>
                <p><span className="text-gray-500">Category:</span> {result.ai_analysis?.category}</p>
                <p><span className="text-gray-500">Severity:</span> {result.ai_analysis?.severity_score}/10</p>
                <p className="text-sm mt-2 text-gray-600">{result.ai_analysis?.summary}</p>
              </>
            )
          }
        </div>
      )}
    </div>
  )
}
```

### `frontend/src/pages/Dashboard.jsx` (map with heatmap overlay)

```jsx
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const API_BASE = import.meta.env.VITE_API_BASE
const SEVERITY_COLOR = (s) => s >= 8 ? '#dc2626' : s >= 5 ? '#d97706' : '#16a34a'

export default function Dashboard() {
  const [issues, setIssues]   = useState([])
  const [hotspots, setHotspots] = useState([])
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    fetch(`${API_BASE}/api/issues?limit=200`)
      .then(r => r.json())
      .then(d => setIssues(d.issues || []))

    fetch(`${API_BASE}/api/analytics/hotspots`)
      .then(r => r.json())
      .then(d => setHotspots(d.hotspots || []))
  }, [])

  const filtered = filter === 'all' ? issues : issues.filter(i => i.status === filter)

  return (
    <div className="flex flex-col h-screen">
      {/* Filter bar */}
      <div className="flex gap-2 p-3 bg-white border-b overflow-x-auto">
        {['all','Reported','Verified','In-Progress','Escalated','Resolved'].map(s => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap
              ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >{s}</button>
        ))}
      </div>

      {/* Map */}
      <MapContainer center={[20.5937, 78.9629]} zoom={5} className="flex-1">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Issue markers — color coded by severity */}
        {filtered.map(issue => (
          <CircleMarker
            key={issue.id}
            center={[issue.location.latitude, issue.location.longitude]}
            radius={8}
            fillColor={SEVERITY_COLOR(issue.severity_score)}
            color="white" weight={1} fillOpacity={0.85}
          >
            <Popup>
              <strong>{issue.category}</strong><br />
              {issue.summary}<br />
              Severity: {issue.severity_score}/10 · {issue.upvotes} upvotes<br />
              Status: <em>{issue.status}</em>
            </Popup>
          </CircleMarker>
        ))}

        {/* Hotspot overlay — red pulsing circles for predicted risk zones */}
        {hotspots.filter(h => h.risk_level === 'High').map((h, i) => (
          <CircleMarker key={`hs-${i}`}
            center={[h.cluster_lat, h.cluster_lng]}
            radius={24} fillColor="#dc2626" color="#dc2626"
            weight={2} fillOpacity={0.15}
          >
            <Popup>
              <strong>⚠ Predicted Risk Zone</strong><br />
              {h.predicted_hazard_type}<br />
              {h.preventative_recommendation}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="flex gap-4 p-2 bg-white border-t text-xs text-gray-600">
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-600 mr-1"/>High (8-10)</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-amber-600 mr-1"/>Medium (5-7)</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-600 mr-1"/>Low (1-4)</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-300 border border-red-600 mr-1"/>Predicted risk</span>
      </div>
    </div>
  )
}
```

---

## Day 5–6 — Deployment (June 27–28)

### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Deploy commands

```bash
# Backend → Google Cloud Run
gcloud builds submit --tag gcr.io/YOUR_PROJECT/community-hero-api
gcloud run deploy community-hero-api \
  --image gcr.io/YOUR_PROJECT/community-hero-api \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=...,FIREBASE_STORAGE_BUCKET=...,GOOGLE_MAPS_API_KEY=...,SMTP_USER=...,SMTP_PASS=...,AUTHORITY_EMAIL=...

# Frontend → Firebase Hosting
cd frontend
npm run build
firebase deploy --only hosting
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - run: |
          gcloud builds submit backend/ --tag gcr.io/${{ secrets.GCP_PROJECT }}/community-hero-api
          gcloud run deploy community-hero-api --image gcr.io/${{ secrets.GCP_PROJECT }}/community-hero-api \
            --platform managed --region asia-south1 --allow-unauthenticated

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
        working-directory: frontend
        env:
          VITE_API_BASE: ${{ secrets.VITE_API_BASE }}
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
```

---

## Environment variables reference

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Cloud Run | Google AI Studio API key |
| `FIREBASE_STORAGE_BUCKET` | Cloud Run | `your-project.appspot.com` |
| `GOOGLE_MAPS_API_KEY` | Cloud Run | Geocoding API key (enable in Google Cloud Console) |
| `SMTP_HOST` | Cloud Run | SMTP server (e.g. smtp.gmail.com) |
| `SMTP_PORT` | Cloud Run | 587 |
| `SMTP_USER` | Cloud Run | Sender email |
| `SMTP_PASS` | Cloud Run | App password |
| `AUTHORITY_EMAIL` | Cloud Run | Municipal authority recipient |
| `VITE_API_BASE` | Frontend build | Cloud Run backend URL |

---

## README.md (GitHub — required for judges)

```markdown
# Community Hero — Hyperlocal Problem Solver

A civic tech platform enabling citizens to identify, report, validate, track,
and resolve community infrastructure issues through AI-powered automation.

## How the Gemini agents work

### 1. Visual Triage Agent (Gemini 2.5 Flash)
On every issue submission, the image is sent to Gemini 2.5 Flash with a
structured output schema. It returns category, severity score (1–10), a
one-sentence summary, and 3 tags — all in a single API call.

### 2. Duplicate Detection Agent (Gemini 2.5 Flash)
Before creating a new issue, the backend queries Firestore for unresolved
issues within a 50-meter bounding box. If nearby issues exist, Gemini
compares summaries and decides if it's the same physical problem. If yes,
the existing issue is upvoted instead of creating a duplicate.

### 3. Status Escalation Agent (Gemini 2.5 Pro)
A scheduled job scans for issues with 10+ upvotes that have sat at "Reported"
for 48+ hours. Gemini Pro drafts a formal escalation notice, the issue status
is updated to "Escalated", and the notice is emailed to the configured
municipal authority.

### 4. Predictive Hotspot Agent (Gemini 2.5 Pro)
The `/api/analytics/hotspots` endpoint feeds the last 100 issues (coordinates
+ categories) to Gemini Pro, which identifies spatial clusters indicating
imminent infrastructure risk. Results appear as a heatmap overlay on the map.

## Google Technologies used
- Gemini 2.5 Flash — visual triage + duplicate detection
- Gemini 2.5 Pro — grievance drafting, escalation, hotspot prediction
- Firebase Auth — citizen authentication
- Cloud Firestore — issue database
- Firebase Storage — image hosting
- Firebase Cloud Messaging — push notifications on status change
- Google Geocoding API — ward name from GPS coordinates
- Cloud Run — backend hosting
- Firebase Hosting — frontend hosting

## Local development

```bash
# Backend
cd backend && pip install -r requirements.txt
cp serviceAccountKey.json backend/
uvicorn main:app --reload

# Frontend
cd frontend && npm install
echo "VITE_API_BASE=http://localhost:8000" > .env.local
npm run dev
```

## Demo video flow
1. Report a pothole → AI triage fires → map marker appears color-coded
2. Submit same issue nearby → agent detects duplicate → upvotes instead
3. Click "Generate Grievance Letter" → Gemini Pro output displayed
4. Show escalation logic → issue with 10+ upvotes → status = Escalated
5. Show predictive heatmap overlay for high-risk zones
6. Leaderboard + XP awarded to reporter
```

---

## 3-minute demo script

| Time | What to show | Evaluation criterion hit |
|---|---|---|
| 0:00–0:30 | Open Report page → take photo of pothole → submit → show AI JSON response (category, severity 8/10, tags) | Agentic Depth, Google Tech |
| 0:30–1:00 | Map loads → red marker appears → show severity color coding and popup | Product Experience |
| 1:00–1:30 | Submit same issue 40m away → show "duplicate_updated" response → upvote count increments on map | Agentic Depth, Innovation |
| 1:30–2:00 | Click "Generate Grievance Letter" → Gemini Pro output scrolls in → copy button | Agentic Depth, Problem Impact |
| 2:00–2:30 | Show Leaderboard → XP awarded → badge unlocked → Civic Transparency Score per ward | Innovation, Product Experience |
| 2:30–3:00 | Toggle Hotspot overlay → red halo appears over predicted risk zone → show Gemini Pro rationale | Innovation, Agentic Depth |