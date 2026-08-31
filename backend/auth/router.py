import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from database.session import get_db
from models.user import User
from models.password_reset_token import PasswordResetToken
from auth.google_oauth import get_google_login_url, exchange_code_for_token, get_google_user_info
from auth.jwt_handler import create_access_token
from auth.password_utils import hash_password, verify_password
from schemas.auth_schemas import RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest
from services.email_service import send_password_reset_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
RESET_TOKEN_EXPIRE_MINUTES = 30

logger = logging.getLogger("auth")


@router.get("/google/login")
def google_login():
    state = secrets.token_urlsafe(16)
    login_url = get_google_login_url(state)
    return RedirectResponse(login_url)


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    token_data = await exchange_code_for_token(code)
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="Google token exchange failed")

    user_info = await get_google_user_info(access_token)
    google_id = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name")
    picture_url = user_info.get("picture")

    existing_user = db.execute(select(User).where(User.google_id == google_id)).scalar_one_or_none()

    if existing_user:
        existing_user.last_login_at = datetime.now(timezone.utc)
        existing_user.name = name
        existing_user.picture_url = picture_url
        db.commit()
        db.refresh(existing_user)
        user = existing_user
    else:
        user = User(
            google_id=google_id,
            auth_provider="google",
            email=email,
            name=name,
            picture_url=picture_url,
            role="viewer",
            is_active=True,
            last_login_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    session_token = create_access_token(user_id=user.id, email=user.email, role=user.role)

    redirect_url = f"{FRONTEND_URL}/auth/success?token={session_token}"
    return RedirectResponse(redirect_url)


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()

    if existing_user:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        auth_provider="password",
        role="viewer",
        is_active=True,
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    session_token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"token": session_token}


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    session_token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"token": session_token}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()

    if user:
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)

        token_record = PasswordResetToken(
            user_id=user.id,
            token=reset_token,
            expires_at=expires_at,
        )
        db.add(token_record)
        db.commit()

        reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
        logger.info(f"Password reset link for {user.email}: {reset_link}")

        email_sent = await send_password_reset_email(user.email, reset_link)
        if not email_sent:
            logger.warning(f"Failed to send reset email to {user.email}, link is available in logs above")

    return {"message": "If an account exists with this email, a reset link has been generated."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_record = db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == payload.token)
    ).scalar_one_or_none()

    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if token_record.used:
        raise HTTPException(status_code=400, detail="This reset link has already been used")

    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset link has expired")

    user = db.execute(select(User).where(User.id == token_record.user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user.password_hash = hash_password(payload.new_password)
    token_record.used = True
    db.commit()

    return {"message": "Password has been reset successfully"}


@router.post("/logout")
def logout():
    return {"status": "logged_out"}
