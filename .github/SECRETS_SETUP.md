# GitHub Secrets Setup Guide

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**
and add each of the following:

## Google Cloud secrets (for Cloud Run backend)

| Secret name | Where to get it |
|---|---|
| `GCP_SA_KEY` | GCP Console → IAM → Service Accounts → your SA → Keys → Add Key → JSON. Paste the entire JSON content. |
| `GCP_PROJECT` | Your GCP project ID (e.g. `community-hero-123`) |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API key |

## AWS secrets (for S3 image storage)

| Secret name | Where to get it |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS Console → IAM → Users → your user → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | Same as above (shown only once on creation) |
| `AWS_REGION` | e.g. `ap-south-1` |
| `AWS_S3_BUCKET` | Your bucket name e.g. `triad-civic` |

## Email secrets (for escalation agent)

| Secret name | Value |
|---|---|
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | 16-char Gmail App Password (Google Account → Security → App Passwords) |
| `AUTHORITY_EMAIL` | Email where escalation notices are sent |

## Firebase secrets (for frontend hosting)

| Secret name | Where to get it |
|---|---|
| `VITE_API_BASE` | Your Cloud Run service URL after first deploy (e.g. `https://community-hero-api-xxx.run.app`) |
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps → SDK config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same as above |
| `VITE_FIREBASE_PROJECT_ID` | Same as above |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same as above |
| `VITE_FIREBASE_APP_ID` | Same as above |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project Settings → Service accounts → Generate new private key → paste JSON |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |

## GCP Service Account permissions required

The service account used for `GCP_SA_KEY` needs these IAM roles:
- `Cloud Run Admin`
- `Cloud Build Editor`
- `Storage Admin`
- `Service Account User`

## First deploy

The first time, deploy manually so you get the Cloud Run URL for `VITE_API_BASE`:

```bash
# 1. Deploy backend manually
gcloud builds submit backend/ --tag gcr.io/YOUR_PROJECT/community-hero-api
gcloud run deploy community-hero-api \
  --image gcr.io/YOUR_PROJECT/community-hero-api \
  --platform managed --region asia-south1 --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=...,AWS_ACCESS_KEY_ID=...

# 2. Copy the URL shown, set it as VITE_API_BASE secret

# 3. Deploy frontend
cd frontend && npm run build
firebase deploy --only hosting

# After that, every git push to main auto-deploys both.
```
