# Stage 1: Build Frontend
FROM node:22-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build --configuration production

# Stage 2: Final Image
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/

# Copy the compiled Angular frontend from the builder stage
COPY --from=frontend-builder /frontend/dist/adios-frontend/browser ./frontend/dist/adios-frontend/browser

ENV PORT=8080
EXPOSE 8080

CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT}
