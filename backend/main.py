import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv("../.env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")

from auth.router import router as auth_router
from auth.dependencies import get_current_user
from models.user import User
from api.ingestion import router as ingestion_router
from api.reads import router as reads_router
from api.websocket import router as websocket_router
from api.risks import router as risks_router
from api.sync import router as sync_router
from database.session import SessionLocal
from ml.model_loader import initialize_model_registry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        loaded, failed = initialize_model_registry(db)
        if failed:
            logger.warning(
                "Starting up with %s of %s ML models unavailable: %s. "
                "Ingestion will continue with rule-engine-only risk evaluation for those models.",
                len(failed), len(loaded) + len(failed), list(failed.keys()),
            )
    finally:
        db.close()
    yield


app = FastAPI(title="mine-subsidence-system", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(ingestion_router)
app.include_router(reads_router)
app.include_router(websocket_router)
app.include_router(risks_router)
app.include_router(sync_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/auth/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
    }
