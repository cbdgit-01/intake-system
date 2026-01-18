"""
YOLO Object Detection API for CBD Intake
This backend service handles image processing and object detection,
and email sending via Resend API.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from PIL import Image
from pydantic import BaseModel
import numpy as np
import io
import base64
from typing import List, Optional
import logging
import resend

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CBD Intake Detection API",
    description="YOLO-based object detection for consignment item intake",
    version="1.0.0"
)

# CORS - allow React frontend
# Get allowed origins from environment or use defaults
import os
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174", 
    "http://localhost:5175",
    "http://localhost:3000",
]
# Allow any Railway domain
RAILWAY_PATTERN_ORIGINS = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEFAULT_ORIGINS + CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.(up\.railway\.app|netlify\.app|onrender\.com)",  # Allow Railway, Netlify, Render
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.on_event("startup")
async def startup_event():
    """Pre-load the model on startup"""
    try:
        get_model()
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "CBD Intake Detection API"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    model_loaded = model is not None
    return {
        "status": "healthy" if model_loaded else "degraded",
        "model_loaded": model_loaded
    }

@app.post("/detect")
async def detect_items(
    file: UploadFile = File(...),
    confidence: float = 0.15
):
    """
    Detect items in an uploaded image.
    
    Returns bounding boxes and cropped images for each detected item.
    """
    try:
        # Read and validate image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        img_array = np.array(image)
        
        # Run detection
        detection_model = get_model()
        results = detection_model(img_array, conf=confidence)[0]
        
        # Extract bounding boxes
        boxes = results.boxes.xyxy if results.boxes else []
        boxes_list = [list(map(int, box.tolist())) for box in boxes]
        
        # Crop detected items
        cropped_items = []
        for i, box in enumerate(boxes_list):
            x1, y1, x2, y2 = box
            # Add padding
            padding = 10
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(image.width, x2 + padding)
            y2 = min(image.height, y2 + padding)
            
            # Crop the item
            cropped = image.crop((x1, y1, x2, y2))
            
            # Convert to base64
            buffer = io.BytesIO()
            cropped.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            cropped_items.append({
                "index": i,
                "box": [x1, y1, x2, y2],
                "image": f"data:image/png;base64,{img_base64}"
            })
        
        # If no items detected, return the full image as a single item
        if len(cropped_items) == 0:
            buffer = io.BytesIO()
            image.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            cropped_items.append({
                "index": 0,
                "box": [0, 0, image.width, image.height],
                "image": f"data:image/png;base64,{img_base64}"
            })
        
        logger.info(f"Detected {len(boxes_list)} items in image")
        
        return JSONResponse({
            "success": True,
            "detected_count": len(boxes_list),
            "items": cropped_items,
            "message": f"Detected {len(boxes_list)} item(s)" if len(boxes_list) > 0 else "No distinct items detected. Image added as single item."
        })
        
    except Exception as e:
        logger.error(f"Detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ Email API ============

class EmailAttachment(BaseModel):
    filename: str
    content: str  # Base64 encoded content

class EmailRequest(BaseModel):
    to_email: str
    to_name: Optional[str] = None
    from_email: str
    from_name: Optional[str] = "Consigned By Design"
    subject: str
    message: str
    attachments: Optional[List[EmailAttachment]] = None
    api_key: str

@app.post("/send-email")
async def send_email(request: EmailRequest):
    """
    Send an email via Resend API.
    Supports attachments (base64 encoded).
    """
    try:
        # Set API key from request
        resend.api_key = request.api_key

        # Build email params
        email_params = {
            "from": f"{request.from_name} <{request.from_email}>",
            "to": [request.to_email],
            "subject": request.subject,
            "text": request.message,
            "html": f"<div style='font-family: Arial, sans-serif; line-height: 1.6;'>{request.message.replace(chr(10), '<br>')}</div>",
        }

        # Add attachments if provided
        if request.attachments:
            email_params["attachments"] = [
                {
                    "filename": att.filename,
                    "content": att.content,
                }
                for att in request.attachments
            ]

        # Send email
        result = resend.Emails.send(email_params)

        logger.info(f"Email sent successfully to {request.to_email}, id: {result.get('id', 'unknown')}")

        return JSONResponse({
            "success": True,
            "message": "Email sent successfully",
            "id": result.get("id")
        })

    except Exception as e:
        logger.error(f"Email error: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": str(e)
            }
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

