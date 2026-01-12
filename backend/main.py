"""
YOLO Object Detection API for CBD Intake
This backend service handles image processing and object detection.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from PIL import Image
import numpy as np
import io
import base64
from typing import List, Optional
import logging

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
    allow_origin_regex=r"https://.*\.up\.railway\.app",  # Allow all Railway subdomains
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

