import io
import base64
import hashlib
import hmac
import secrets
from datetime import datetime
from typing import Optional

import pyotp
import qrcode
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from fastapi import Request, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import (
    SECRET_KEY,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    TOTP_PENDING_COOKIE_NAME,
    TOTP_ISSUER_NAME,
)
from app.database import get_db
from app.models import AdminUser, AuditLog

serializer = URLSafeTimedSerializer(SECRET_KEY)

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100_000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    calc_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(calc_hash, stored_hash)

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def get_totp_uri(secret: str, username: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=TOTP_ISSUER_NAME)

def generate_qr_code_base64(totp_uri: str) -> str:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(totp_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{b64}"

def verify_totp_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    # Clean whitespace or dashes
    cleaned_code = code.replace(" ", "").replace("-", "").strip()
    totp = pyotp.TOTP(secret)
    # valid_window=1 allows +-30 seconds clock drift
    return bool(totp.verify(cleaned_code, valid_window=1))

def create_token(payload: dict, salt: str = "session") -> str:
    return serializer.dumps(payload, salt=salt)

def read_token(token: str, max_age: int = SESSION_MAX_AGE_SECONDS, salt: str = "session") -> Optional[dict]:
    try:
        data = serializer.loads(token, salt=salt, max_age=max_age)
        return data
    except (BadSignature, SignatureExpired):
        return None

def log_audit(db: Session, request: Request, action: str, status_val: str, username: Optional[str] = None, details: Optional[str] = None):
    try:
        client_ip = request.client.host if request.client else "unknown"
        # Check X-Forwarded-For if behind reverse proxy
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        log_entry = AuditLog(
            timestamp=datetime.utcnow(),
            username=username,
            ip_address=client_ip,
            action=action,
            status=status_val,
            details=details
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        print(f"Error saving audit log: {e}")

def get_current_admin(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_cookie:
        raise HTTPException(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": "/admin/login"}
        )

    data = read_token(session_cookie, max_age=SESSION_MAX_AGE_SECONDS, salt="admin_session")
    if not data or "user_id" not in data or not data.get("2fa_verified", False):
        raise HTTPException(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": "/admin/login"}
        )

    user = db.query(AdminUser).filter(AdminUser.id == data["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": "/admin/login"}
        )

    return user
