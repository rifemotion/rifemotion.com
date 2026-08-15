from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from app.config import TEMPLATES_DIR, STATIC_DIR

router = APIRouter(tags=["public"])
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

@router.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )

@router.get("/favicon.ico")
async def favicon():
    fav_file = STATIC_DIR / "icones" / "favicon.png"
    if fav_file.exists():
        return FileResponse(fav_file)
    return HTMLResponse(status_code=404)
