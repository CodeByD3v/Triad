from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from contextlib import asynccontextmanager
from routers import issues, analytics, gamification
from agents.escalation import run_escalation_check
import logging

logger = logging.getLogger(__name__)

# ── APScheduler setup ────────────────────────────────────────────────────────
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the escalation cron on startup, shut it down cleanly on exit."""
    scheduler.add_job(
        run_escalation_check,
        trigger=IntervalTrigger(hours=1),
        id="escalation_check",
        name="Auto-escalate high-upvote stale issues",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] Escalation agent scheduled — runs every hour")
    yield
    scheduler.shutdown(wait=False)
    logger.info("[Scheduler] Shutdown complete")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Triad API", lifespan=lifespan)

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
    return {
        "status": "ok",
        "scheduler_running": scheduler.running,
        "scheduled_jobs": [j.id for j in scheduler.get_jobs()],
    }
