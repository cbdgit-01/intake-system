# ============ Stage 1: Build React Frontend ============
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install dependencies first (cache layer)
COPY react-intake/package.json react-intake/package-lock.json* ./
RUN npm install

# Copy source and build
COPY react-intake/ ./
ENV VITE_API_URL=""
RUN npm run build

# ============ Stage 2: Python Runtime ============
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV/numpy (needed by ultralytics)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy React build output to static/
COPY --from=frontend-build /app/frontend/dist ./static/

# Expose port (Railway sets PORT env var)
EXPOSE 8000

# Start the server — Railway provides PORT, default to 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
