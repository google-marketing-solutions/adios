# Use Python 3.11 slim image
FROM python:3.11-slim

WORKDIR /app

# Copy dependency files
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Default port for Cloud Run is 8080
ENV PORT=8080
EXPOSE 8080

# Run Uvicorn ASGI server
CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT}
