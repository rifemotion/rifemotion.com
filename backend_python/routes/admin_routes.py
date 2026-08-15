import sys
import platform
from datetime import datetime
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.config import TEMPLATES_DIR
from app.database import get_db
from app.models import AdminUser, AuditLog
from app.auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

@router.get("", response_class=HTMLResponse)
@router.get("/", response_class=HTMLResponse)
@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(
    request: Request,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(8).all()

    server_info = {
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "database": "SQLite (Active)",
        "current_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    }

    return templates.TemplateResponse(
        request=request,
        name="admin/dashboard.html",
        context={
            "admin": current_admin,
            "server_info": server_info,
            "recent_logs": recent_logs,
        }
    )
