# Use Python 3.11 slim as the base
FROM python:3.11-slim

# Install system dependencies (ffmpeg is required for audio processing)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Pre-download models for turn detection
RUN python -m app.worker download-files

# Default port for FastAPI (if running as web)
EXPOSE 8000

# Run unified service (FastAPI + LiveKit Worker)
CMD ["python", "run_services.py"]
