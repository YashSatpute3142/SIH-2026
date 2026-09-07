import os
import logging
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]

_firebase_app = None
_firestore_client = None


def _resolve_credentials_path() -> Path:
    raw_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if not raw_path:
        raise RuntimeError("FIREBASE_CREDENTIALS_PATH is not set in .env")

    path = Path(raw_path)
    if not path.is_absolute():
        path = PROJECT_ROOT / path

    if not path.exists():
        raise FileNotFoundError(f"Firebase service account file not found at {path}")

    return path


def initialize_firebase():
    global _firebase_app, _firestore_client

    if _firebase_app is not None:
        return _firestore_client

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID is not set in .env")

    cred_path = _resolve_credentials_path()
    cred = credentials.Certificate(str(cred_path))

    _firebase_app = firebase_admin.initialize_app(cred, {"projectId": project_id})
    _firestore_client = firestore.client()

    logger.info("Firebase Admin SDK initialized for project_id=%s", project_id)
    return _firestore_client


def get_firestore_client():
    if _firestore_client is None:
        return initialize_firebase()
    return _firestore_client
