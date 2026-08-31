import os
import httpx

RESEND_API_URL = "https://api.resend.com/emails"
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")


async def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    if not RESEND_API_KEY:
        return False

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": "Reset your password - Mine Subsidence System",
        "html": f"""
            <p>You requested a password reset for your Mine Subsidence System account.</p>
            <p><a href="{reset_link}">Click here to reset your password</a></p>
            <p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>
        """,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(RESEND_API_URL, json=payload, headers=headers)
        return response.status_code == 200
