import google.generativeai as genai
from firebase_admin import firestore as fs
from firebase_client import db
import os
import smtplib
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
        db.collection("issues").document(issue_id).update(
            {
                "status": "Escalated",
                "escalated_at": fs.SERVER_TIMESTAMP,
                "escalation_reason": escalation_text[:500],  # store excerpt
                "last_updated_at": fs.SERVER_TIMESTAMP,
            }
        )

        # Send email (configure SMTP via env vars in production)
        _send_escalation_email(issue_id, ward, category, escalation_text)
        print(f"[Escalation Agent] Escalated issue {issue_id} in {ward}")


def _send_escalation_email(
    issue_id: str, ward: str, category: str, body: str
):
    """Sends the Gemini-drafted escalation notice to the authority email."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    if not smtp_user:
        print("[Escalation Agent] No SMTP config — skipping email send")
        return

    msg = MIMEText(body, "plain")
    msg["Subject"] = (
        f"[URGENT] Community Issue Escalation — {category} | {ward} | ID: {issue_id}"
    )
    msg["From"] = smtp_user
    msg["To"] = AUTHORITY_EMAIL

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, AUTHORITY_EMAIL, msg.as_string())
    except Exception as e:
        print(f"[Escalation Agent] Email failed: {e}")
