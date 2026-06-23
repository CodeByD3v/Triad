# Community Hero — Hyperlocal Problem Solver

A civic tech platform enabling citizens to identify, report, validate, track, and resolve community infrastructure issues through AI-powered automation.

## How the Gemini Agents Work

### 1. Visual Triage Agent (Gemini 2.5 Flash)
On every issue submission, the image is sent to Gemini 2.5 Flash with a structured output schema. It returns category, severity score (1–10), a one-sentence summary, and 3 tags — all in a single API call.

### 2. Duplicate Detection Agent (Gemini 2.5 Flash)
Before creating a new issue, the backend queries Firestore for unresolved issues within a 50-meter bounding box. If nearby issues exist, Gemini compares summaries and decides if it's the same physical problem. If yes, the existing issue is upvoted instead of creating a duplicate.

### 3. Status Escalation Agent (Gemini 2.5 Pro)
A scheduled job scans for issues with 10+ upvotes that have sat at "Reported" for 48+ hours. Gemini Pro drafts a formal escalation notice, the issue status is updated to "Escalated", and the notice is emailed to the configured municipal authority.

### 4. Predictive Hotspot Agent (Gemini 2.5 Pro)
The `/api/analytics/hotspots` endpoint feeds the last 100 issues (coordinates + categories) to Gemini Pro, which identifies spatial clusters indicating imminent infrastructure risk. Results appear as a heatmap overlay on the map.

### 5. Grievance Letter Agent (Gemini 2.5 Pro)
Generates formal, professional grievance letters addressed to the Municipal Corporation based on issue details, severity, and community engagement metrics.

## Google Technologies Used
- **Gemini 2.5 Flash** — visual triage + duplicate detection
- **Gemini 2.5 Pro** — grievance drafting, escalation, hotspot prediction
- **Firebase Auth** — citizen authentication (Google + Anonymous)
- **Cloud Firestore** — issue database
- **Firebase Storage** — image hosting
- **Firebase Cloud Messaging** — push notifications on status change
- **Google Geocoding API** — ward name from GPS coordinates
- **Cloud Run** — backend hosting
- **Firebase Hosting** — frontend hosting

## Features
- 📸 **AI-Powered Reporting** — Take a photo, AI categorizes and scores severity
- 🔍 **Smart Duplicate Detection** — Prevents duplicate reports within 50m radius
- 🗺️ **Interactive Map** — Severity color-coded markers with dark theme
- 🔥 **Predictive Hotspots** — AI-identified risk zones overlay on map
- 📄 **Grievance Letter Generator** — Formal letters drafted by Gemini Pro
- 🚨 **Auto-Escalation** — High-demand issues escalated to authorities
- 🏆 **Gamification** — XP, badges, leaderboard for community engagement
- 📊 **Civic Transparency Score** — Per-ward resolution tracking
- 📡 **Offline PWA** — Works offline with IndexedDB queue
- 📱 **Responsive Design** — Mobile-first glassmorphism dark UI

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Set environment variables
export GEMINI_API_KEY=your_key_here
export FIREBASE_STORAGE_BUCKET=your-project.appspot.com
export GOOGLE_MAPS_API_KEY=your_maps_key

# Place serviceAccountKey.json in backend/
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
echo "VITE_API_BASE=http://localhost:8000" > .env.local
npm run dev
```

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Google AI Studio API key |
| `FIREBASE_STORAGE_BUCKET` | Backend | `your-project.appspot.com` |
| `GOOGLE_MAPS_API_KEY` | Backend | Geocoding API key |
| `SMTP_HOST` | Backend | SMTP server (default: smtp.gmail.com) |
| `SMTP_PORT` | Backend | SMTP port (default: 587) |
| `SMTP_USER` | Backend | Sender email for escalation notices |
| `SMTP_PASS` | Backend | App password |
| `AUTHORITY_EMAIL` | Backend | Municipal authority recipient |
| `VITE_API_BASE` | Frontend | Backend URL (Cloud Run or localhost) |

## Demo Video Flow
1. **Report** → Take photo of pothole → AI triage fires → map marker appears color-coded
2. **Duplicate** → Submit same issue nearby → agent detects duplicate → upvotes instead
3. **Grievance** → Click "Generate Grievance Letter" → Gemini Pro output displayed
4. **Escalation** → Issue with 10+ upvotes → status = Escalated
5. **Hotspots** → Show predictive heatmap overlay for high-risk zones
6. **Gamification** → Leaderboard + XP awarded + badges unlocked

## Deployment

### Backend → Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/community-hero-api
gcloud run deploy community-hero-api \
  --image gcr.io/YOUR_PROJECT/community-hero-api \
  --platform managed --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=...,FIREBASE_STORAGE_BUCKET=...
```

### Frontend → Firebase Hosting
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React PWA  │────▶│  FastAPI Backend  │────▶│  Cloud Firestore│
│  (Firebase   │     │  (Cloud Run)      │     │  + Storage      │
│   Hosting)   │     │                   │     └─────────────────┘
└──────────────┘     │  ┌─────────────┐  │
                     │  │ Triage Agent│  │     ┌─────────────────┐
                     │  │ Dedup Agent │  │────▶│  Gemini 2.5     │
                     │  │ Escalation  │  │     │  Flash + Pro    │
                     │  │ Hotspot     │  │     └─────────────────┘
                     │  │ Grievance   │  │
                     │  └─────────────┘  │     ┌─────────────────┐
                     │                   │────▶│  Google Maps    │
                     └──────────────────┘     │  Geocoding API  │
                                              └─────────────────┘
```
