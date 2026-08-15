from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.config import STATIC_DIR
from app.database import init_db
from app.routes import public, auth_routes, admin_routes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    yield

app = FastAPI(
    title="RifeMotion Server",
    description="Python Backend for rifemotion.com with 2FA Admin Panel",
    version="1.0.0",
    lifespan=lifespan
)

# Mount static files (CSS, videos, icons)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Include Routers
app.include_router(public.router)
app.include_router(auth_routes.router)
app.include_router(admin_routes.router)
