FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variable for port
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Use gunicorn with eventlet worker for WebSocket support
CMD exec gunicorn --worker-class eventlet -w 1 --bind :$PORT --timeout 120 app:app