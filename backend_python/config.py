import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "rifemotion_super_secret_session_key_change_in_production_2026")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'rifemotion.db'}")

SESSION_COOKIE_NAME = "rifemotion_admin_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # 7 days
TOTP_PENDING_COOKIE_NAME = "rifemotion_2fa_pending"
TOTP_ISSUER_NAME = "RifeMotion"

# Paths
STATIC_DIR = BASE_DIR / "app" / "static"
TEMPLATES_DIR = BASE_DIR / "app" / "templates"
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(parents=True, exist_ok=True)
