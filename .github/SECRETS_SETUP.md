# GitHub Secrets Setup Guide

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**
and add each of the following:

## Render secrets (for backend)

| Secret name | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API key |
| `RENDER_API_KEY` | Render Dashboard → Account Settings → API Keys (if needed for deployment) |

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
| `VITE_API_BASE` | Your Render service URL (e.g. `https://community-hero-api-xxx.onrender.com`) |
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps → SDK config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same as above |
| `VITE_FIREBASE_PROJECT_ID` | Same as above |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same as above |
| `VITE_FIREBASE_APP_ID` | Same as above |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project Settings → Service accounts → Generate new private key → paste JSON |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |

## First deploy

The first time, deploy your backend to Render so you get the Render URL for `VITE_API_BASE`.
Then configure your GitHub Secrets.

```bash
# 1. Deploy backend to Render manually or via Render Dashboard.

# 2. Copy the URL shown on Render, set it as VITE_API_BASE secret in GitHub

# 3. Deploy frontend
cd frontend && npm run build
firebase deploy --only hosting

# After that, every git push to main auto-deploys the frontend via GitHub Actions.
```
