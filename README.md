# Community Hero — Hyperlocal Problem Solver

A civic tech platform enabling citizens to identify, report, validate, track,
and resolve community infrastructure issues through AI-powered automation.

---

## How the Gemini Agents Work

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
municipal authority automatically.

### 4. Predictive Hotspot Agent (Gemini 2.5 Pro)
The `/api/analytics/hotspots` endpoint feeds the last 100 issues (coordinates
+ categories) to Gemini Pro, which identifies spatial clusters indicating
imminent infrastructure risk. Results appear as a heatmap overlay on the map.

### 5. Grievance Letter Agent (Gemini 2.5 Pro)
Generates formal, professional grievance letters addressed to the Municipal
Corporation based on issue details, severity, and community engagement metrics.

---

## Features

- 📸 **AI-Powered Reporting** — Take a photo, AI categorizes and scores severity instantly
- 🔍 **Smart Duplicate Detection** — Prevents duplicate reports within 50m radius using Gemini
- 🗺️ **Interactive Map** — Severity color-coded markers (Red = High, Amber = Medium, Green = Low)
- 🔥 **Predictive Hotspots** — AI-identified risk zones overlaid on the map
- 📄 **Grievance Letter Generator** — Formal letters drafted by Gemini Pro in one click
- 🚨 **Auto-Escalation** — High-demand issues automatically escalated to authorities via email
- 🏆 **Gamification** — XP system, badges, and per-ward leaderboard
- 📊 **Civic Transparency Score** — Per-ward resolution rate tracked publicly
- 📡 **Offline PWA** — Works offline with IndexedDB queue, syncs when back online
- 📱 **Responsive Design** — Mobile-first UI

---

## Google Technologies Used

- **Gemini 2.5 Flash** — visual triage + duplicate detection
- **Gemini 2.5 Pro** — grievance drafting, escalation notices, hotspot prediction
- **Firebase Auth** — citizen authentication (Google + Anonymous)
- **Cloud Firestore** — all issue data, users, leaderboard
- **Cloud Run** — FastAPI backend hosting
- **Firebase Hosting** — React frontend hosting

---

## Architecture

```
┌──────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   React PWA  │────▶│   FastAPI Backend     │────▶│  Cloud Firestore│
│  (Firebase   │     │   (Cloud Run)         │     └─────────────────┘
│   Hosting)   │     │                       │     ┌─────────────────┐
└──────────────┘     │  ┌─────────────────┐  │────▶│   AWS S3        │
                     │  │ 1. Triage Agent  │  │     │  (Image Store)  │
                     │  │ 2. Dedup Agent   │  │     └─────────────────┘
                     │  │ 3. Escalation    │  │     ┌─────────────────┐
                     │  │ 4. Hotspot       │  │────▶│  Gemini 2.5     │
                     │  │ 5. Grievance     │  │     │  Flash + Pro    │
                     │  └─────────────────┘  │     └─────────────────┘
                     │                       │     ┌─────────────────┐
                     └──────────────────────┘     │  Nominatim      │
                                                   │  (Geocoding)    │
                                                   └─────────────────┘
```

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt

# Place serviceAccountKey.json in backend/
# Copy .env.example to .env and fill in your values

uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local   # then fill in VITE_ variables
npm run dev
```

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Google AI Studio API key (free at aistudio.google.com) |
| `AWS_ACCESS_KEY_ID` | Backend | AWS IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | Backend | AWS IAM user secret key |
| `AWS_REGION` | Backend | S3 bucket region (e.g. ap-south-1) |
| `AWS_S3_BUCKET` | Backend | S3 bucket name |
| `SMTP_HOST` | Backend | SMTP server (smtp.gmail.com) |
| `SMTP_PORT` | Backend | 587 |
| `SMTP_USER` | Backend | Sender Gmail address |
| `SMTP_PASS` | Backend | Gmail app password (16 chars) |
| `AUTHORITY_EMAIL` | Backend | Municipal authority recipient email |
| `VITE_API_BASE` | Frontend | Backend URL (localhost or Cloud Run) |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase project ID |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Frontend | Firebase app ID |

> Geocoding uses **Nominatim** (OpenStreetMap) — completely free, no API key needed.
> Image storage uses **AWS S3** — public read via bucket policy, no ACL required.
> Firestore credentials via `serviceAccountKey.json` — never commit this file.

---

## Deployment

### Backend → Google Cloud Run

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/community-hero-api backend/
gcloud run deploy community-hero-api \
  --image gcr.io/YOUR_PROJECT/community-hero-api \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=...,AWS_ACCESS_KEY_ID=...,AWS_SECRET_ACCESS_KEY=...,AWS_S3_BUCKET=...,AWS_REGION=ap-south-1,SMTP_USER=...,SMTP_PASS=...,AUTHORITY_EMAIL=...
```

### Frontend → Firebase Hosting

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

---

## Demo Video Flow

1. **Report** → Take photo of pothole → AI triage fires → map marker appears color-coded
2. **Duplicate** → Submit same issue nearby → agent detects duplicate → upvotes instead
3. **Grievance** → Open issue detail → click "Generate Grievance Letter" → Gemini Pro output
4. **Escalation** → Issue with 10+ upvotes after 48h → status auto-updates to Escalated
5. **Hotspots** → Toggle predictive heatmap overlay for AI-identified risk zones
6. **Gamification** → Leaderboard with XP, badges, and Civic Transparency Score per ward

---

## Firestore Index Required

The duplicate detection query requires a composite index. On first run it will
error with a direct link to create it automatically — click the link and wait
~2 minutes for the index to build.

Or create it manually in Firebase Console → Firestore → Indexes → Composite:
- Collection: `issues`
- Fields: `location.latitude` (Ascending), `created_at` (Descending)
