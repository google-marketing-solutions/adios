import logging
from typing import Any
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("adios.api")

# Pydantic v2 Models for Health and Error Structured Responses
class HealthResponse(BaseModel):
    status_code: str = Field(default="healthy", description="Current operational status of the service")
    service: str = Field(default="Adios 2.0 Advanced API", description="Service name")
    architecture: str = Field(
        default="Python 3 / FastAPI / Pydantic v2 / Uvicorn",
        description="Backend technology stack and validation engine"
    )
    api_version: str = Field(default="v1", description="API version")


class ErrorDetail(BaseModel):
    domain: str = Field(..., description="Domain or component where the error occurred")
    reason: str = Field(..., description="Canonical error reason code")
    message: str = Field(..., description="Human-readable error description")


class StructuredErrorResponse(BaseModel):
    error_code: int = Field(..., description="HTTP status code")
    status: str = Field(..., description="Canonical status identifier (e.g., INVALID_ARGUMENT, INTERNAL)")
    message: str = Field(..., description="Summary error message")
    details: list[ErrorDetail] = Field(default_factory=list, description="Granular error details")


app = FastAPI(
    title="Adios 2.0 Advanced API",
    description="Enterprise-grade PMax campaign and Google Merchant Center automation engine.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler ensuring all unhandled exceptions return structured JSON errors."""
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    error_payload = StructuredErrorResponse(
        error_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        status="INTERNAL_SERVER_ERROR",
        message="An unexpected internal server error occurred while processing the request.",
        details=[
            ErrorDetail(
                domain="adios.core",
                reason="INTERNAL_ERROR",
                message=str(exc) if str(exc) else "Unknown internal exception",
            )
        ],
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_payload.model_dump(),
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    tags=["Health"],
    summary="Service Health Check Endpoint",
)
async def health_check() -> HealthResponse:
    """Returns the health status and architectural metadata of the Adios 2.0 Advanced backend service."""
    return HealthResponse(
        status_code="healthy",
        service="Adios 2.0 Advanced API",
        architecture="Python 3 / FastAPI / Pydantic v2 / Uvicorn",
        api_version="v1",
    )


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Adios 2.0 Advanced FastAPI server via Uvicorn...")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
