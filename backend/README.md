# CBD Intake - YOLO Detection Backend

This is the object detection backend service for CBD Intake, using YOLOv8 for item detection.

## Setup

### Prerequisites
- Python 3.9+
- pip

### Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

The first time the server starts, it will download the YOLOv8 model (~50MB).

### Running the Server

```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`.

## API Endpoints

### `GET /`
Health check - returns service status.

### `GET /health`
Detailed health check including model status.

### `POST /detect`
Detect items in an uploaded image.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (image file - JPEG or PNG)
- Optional: `confidence` (float, default 0.15)

**Response:**
```json
{
  "success": true,
  "detected_count": 3,
  "items": [
    {
      "index": 0,
      "box": [100, 50, 300, 250],
      "image": "data:image/png;base64,..."
    }
  ],
  "message": "Detected 3 item(s)"
}
```

## Configuration

The React frontend expects the backend at `http://localhost:8000` by default.
To change this, set `VITE_DETECTION_API_URL` in the frontend `.env` file.

## Production Deployment

For production, consider:
1. Running behind a reverse proxy (nginx)
2. Using gunicorn with uvicorn workers
3. Enabling HTTPS
4. Setting appropriate CORS origins in `main.py`

Example production command:
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```


