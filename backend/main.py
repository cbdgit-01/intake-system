"""
CBD Intake System API
Handles authentication, form management, object detection, and email sending.
Serves the React frontend as static files in production.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
from PIL import Image
from pydantic import BaseModel
import numpy as np
import io
import base64
import requests as http_requests

from db.connection import init_db, close_db
from routers import auth, users, forms, consigners
from models.schemas import EmailAttachment, EmailRequest

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model instance
model: Optional[YOLO] = None


def get_model() -> YOLO:
    """Load and cache the YOLO model"""
    global model
    if model is None:
        logger.info("Loading YOLO model...")
        model = YOLO("yolov8m.pt")
        logger.info("YOLO model loaded successfully")
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # Startup
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {e}")

    try:
        get_model()
    except Exception as e:
        logger.error(f"Failed to load YOLO model on startup: {e}")

    yield

    # Shutdown
    await close_db()


app = FastAPI(
    title="CBD Intake System API",
    description="Consignment intake system with detection, email, and form management",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEFAULT_ORIGINS + CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.(up\.railway\.app|netlify\.app|onrender\.com|ngrok-free\.app|ngrok\.io)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Register API Routers ============
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(forms.router)
app.include_router(consigners.router)


# ============ Health Check ============

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy" if model is not None else "degraded",
        "model_loaded": model is not None,
    }


# ============ Detection API ============

@app.post("/detect")
async def detect_items(
    file: UploadFile = File(...),
    confidence: float = 0.15,
):
    """Detect items in an uploaded image using YOLO."""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        if image.mode != "RGB":
            image = image.convert("RGB")

        img_array = np.array(image)
        detection_model = get_model()
        results = detection_model(img_array, conf=confidence)[0]

        boxes = results.boxes.xyxy if results.boxes else []
        boxes_list = [list(map(int, box.tolist())) for box in boxes]

        cropped_items = []
        for i, box in enumerate(boxes_list):
            x1, y1, x2, y2 = box
            padding = 10
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(image.width, x2 + padding)
            y2 = min(image.height, y2 + padding)

            cropped = image.crop((x1, y1, x2, y2))
            buffer = io.BytesIO()
            cropped.save(buffer, format="PNG")
            img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

            cropped_items.append({
                "index": i,
                "box": [x1, y1, x2, y2],
                "image": f"data:image/png;base64,{img_base64}",
            })

        if len(cropped_items) == 0:
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            cropped_items.append({
                "index": 0,
                "box": [0, 0, image.width, image.height],
                "image": f"data:image/png;base64,{img_base64}",
            })

        logger.info(f"Detected {len(boxes_list)} items in image")
        return JSONResponse({
            "success": True,
            "detected_count": len(boxes_list),
            "items": cropped_items,
            "message": f"Detected {len(boxes_list)} item(s)" if len(boxes_list) > 0 else "No distinct items detected. Image added as single item.",
        })

    except Exception as e:
        logger.error(f"Detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Email API (Brevo) ============

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


@app.post("/send-email")
async def send_email(request: EmailRequest):
    """Send an email via Brevo API. Supports attachments (base64 encoded)."""
    try:
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": request.api_key,
        }

        payload = {
            "sender": {"name": request.from_name, "email": request.from_email},
            "to": [{"email": request.to_email, "name": request.to_name or request.to_email}],
            "subject": request.subject,
            "textContent": request.message,
            "htmlContent": f"<div style='font-family: Arial, sans-serif; line-height: 1.6;'>{request.message.replace(chr(10), '<br>')}</div>",
        }

        if request.attachments:
            payload["attachment"] = [
                {"name": att.filename, "content": att.content}
                for att in request.attachments
            ]

        response = http_requests.post(BREVO_API_URL, json=payload, headers=headers)

        if response.status_code in [200, 201]:
            result = response.json()
            logger.info(f"Email sent to {request.to_email}, id: {result.get('messageId', 'unknown')}")
            return JSONResponse({"success": True, "message": "Email sent successfully", "id": result.get("messageId")})
        else:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("message", f"HTTP {response.status_code}")
            logger.error(f"Brevo API error: {error_msg}")
            return JSONResponse(status_code=400, content={"success": False, "error": error_msg})

    except Exception as e:
        logger.error(f"Email error: {str(e)}")
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


# ============ Static File Serving (React Frontend) ============

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(STATIC_DIR):
    # Serve static assets (JS, CSS, images)
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA - static files or fallback to index.html."""
        # Don't intercept API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)

        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # SPA fallback
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404)
else:
    @app.get("/")
    async def root():
        return {"status": "ok", "service": "CBD Intake System API", "note": "No static files found - API only mode"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
