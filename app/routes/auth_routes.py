from datetime import datetime
from fastapi import APIRouter, Request, Form, Depends, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.config import (
    TEMPLATES_DIR,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    TOTP_PENDING_COOKIE_NAME,
)
from app.database import get_db
from app.models import AdminUser
from app.auth import (
    verify_password,
    generate_totp_secret,
    get_totp_uri,
    generate_qr_code_base64,
    verify_totp_code,
    create_token,
    read_token,
    log_audit,
)

router = APIRouter(prefix="/admin", tags=["auth"])
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, db: Session = Depends(get_db)):
    session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if session_cookie:
        data = read_token(session_cookie, salt="admin_session")
        if data and data.get("2fa_verified"):
            return RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_302_FOUND)

    return templates.TemplateResponse(
        request=request,
        name="admin/login.html",
        context={"error": None}
    )

@router.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    username_clean = username.strip().lower()
    user = db.query(AdminUser).filter(AdminUser.username == username_clean).first()

    if not user or not verify_password(password, user.password_hash, user.salt):
        log_audit(db, request, action="LOGIN_ATTEMPT", status_val="FAILED", username=username_clean, details="Invalid credentials")
        return templates.TemplateResponse(
            request=request,
            name="admin/login.html",
            context={"error": "Неверное имя пользователя или пароль", "username": username},
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # Credentials valid -> Check 2FA
    if not user.is_2fa_enabled or not user.totp_secret:
        # User needs to setup 2FA first
        pending_token = create_token({"user_id": user.id, "stage": "setup"}, salt="pending_2fa")
        response = RedirectResponse(url="/admin/setup-2fa", status_code=status.HTTP_302_FOUND)
        response.set_cookie(
            key=TOTP_PENDING_COOKIE_NAME,
            value=pending_token,
            max_age=600,
            httponly=True,
            samesite="lax"
        )
        return response

    # 2FA is enabled -> redirect to 2FA verification code input
    pending_token = create_token({"user_id": user.id, "stage": "verify"}, salt="pending_2fa")
    response = RedirectResponse(url="/admin/2fa", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=TOTP_PENDING_COOKIE_NAME,
        value=pending_token,
        max_age=600,
        httponly=True,
        samesite="lax"
    )
    return response

@router.get("/setup-2fa", response_class=HTMLResponse)
async def setup_2fa_page(request: Request, db: Session = Depends(get_db)):
    pending_cookie = request.cookies.get(TOTP_PENDING_COOKIE_NAME)
    if not pending_cookie:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    data = read_token(pending_cookie, max_age=600, salt="pending_2fa")
    if not data or data.get("stage") != "setup":
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    user = db.query(AdminUser).filter(AdminUser.id == data["user_id"]).first()
    if not user:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    secret = generate_totp_secret()
    totp_uri = get_totp_uri(secret, user.username)
    qr_code_b64 = generate_qr_code_base64(totp_uri)

    return templates.TemplateResponse(
        request=request,
        name="admin/2fa_setup.html",
        context={
            "username": user.username,
            "secret": secret,
            "qr_code": qr_code_b64,
            "error": None
        }
    )

@router.post("/setup-2fa", response_class=HTMLResponse)
async def setup_2fa_submit(
    request: Request,
    secret: str = Form(...),
    totp_code: str = Form(...),
    db: Session = Depends(get_db)
):
    pending_cookie = request.cookies.get(TOTP_PENDING_COOKIE_NAME)
    if not pending_cookie:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    data = read_token(pending_cookie, max_age=600, salt="pending_2fa")
    if not data or data.get("stage") != "setup":
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    user = db.query(AdminUser).filter(AdminUser.id == data["user_id"]).first()
    if not user:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    if not verify_totp_code(secret, totp_code):
        totp_uri = get_totp_uri(secret, user.username)
        qr_code_b64 = generate_qr_code_base64(totp_uri)
        return templates.TemplateResponse(
            request=request,
            name="admin/2fa_setup.html",
            context={
                "username": user.username,
                "secret": secret,
                "qr_code": qr_code_b64,
                "error": "Неверный код 2FA. Проверьте правильность ввода 6 цифр из приложения."
            },
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # 2FA successfully configured!
    user.totp_secret = secret
    user.is_2fa_enabled = True
    user.last_login = datetime.utcnow()
    db.commit()

    log_audit(db, request, action="2FA_SETUP", status_val="SUCCESS", username=user.username, details="2FA enabled successfully")

    session_token = create_token(
        {"user_id": user.id, "username": user.username, "2fa_verified": True},
        salt="admin_session"
    )
    response = RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax"
    )
    response.delete_cookie(TOTP_PENDING_COOKIE_NAME)
    return response

@router.get("/2fa", response_class=HTMLResponse)
async def verify_2fa_page(request: Request, db: Session = Depends(get_db)):
    pending_cookie = request.cookies.get(TOTP_PENDING_COOKIE_NAME)
    if not pending_cookie:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    data = read_token(pending_cookie, max_age=600, salt="pending_2fa")
    if not data or data.get("stage") != "verify":
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    user = db.query(AdminUser).filter(AdminUser.id == data["user_id"]).first()
    if not user:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    return templates.TemplateResponse(
        request=request,
        name="admin/2fa_verify.html",
        context={"username": user.username, "error": None}
    )

@router.post("/2fa", response_class=HTMLResponse)
async def verify_2fa_submit(
    request: Request,
    totp_code: str = Form(...),
    db: Session = Depends(get_db)
):
    pending_cookie = request.cookies.get(TOTP_PENDING_COOKIE_NAME)
    if not pending_cookie:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    data = read_token(pending_cookie, max_age=600, salt="pending_2fa")
    if not data or data.get("stage") != "verify":
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    user = db.query(AdminUser).filter(AdminUser.id == data["user_id"]).first()
    if not user or not user.totp_secret:
        return RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)

    if not verify_totp_code(user.totp_secret, totp_code):
        log_audit(db, request, action="2FA_VERIFY", status_val="FAILED", username=user.username, details="Invalid 2FA code")
        return templates.TemplateResponse(
            request=request,
            name="admin/2fa_verify.html",
            context={
                "username": user.username,
                "error": "Неверный код 2FA. Убедитесь, что время на устройстве синхронизировано."
            },
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # 2FA code is valid!
    user.last_login = datetime.utcnow()
    db.commit()

    log_audit(db, request, action="LOGIN_2FA", status_val="SUCCESS", username=user.username, details="Successful 2FA login")

    session_token = create_token(
        {"user_id": user.id, "username": user.username, "2fa_verified": True},
        salt="admin_session"
    )
    response = RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax"
    )
    response.delete_cookie(TOTP_PENDING_COOKIE_NAME)
    return response

@router.get("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if session_cookie:
        data = read_token(session_cookie, salt="admin_session")
        if data and "username" in data:
            log_audit(db, request, action="LOGOUT", status_val="SUCCESS", username=data["username"])

    response = RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(SESSION_COOKIE_NAME)
    response.delete_cookie(TOTP_PENDING_COOKIE_NAME)
    return response
