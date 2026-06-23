from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import issues, analytics, gamification

app = FastAPI(title="Triad API")

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
