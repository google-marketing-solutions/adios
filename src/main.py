import logging
from typing import Any
from fastapi import FastAPI, Request, status, HTTPException
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


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., description="Google ID Token JWT received on the client-side")


class UserProfileResponse(BaseModel):
    email: str = Field(..., description="Verified user email address")
    name: str = Field(..., description="User full display name")
    picture: str = Field(..., description="User profile picture URL")


app = FastAPI(
    title="Adios 2.0 Advanced API",
    description="Enterprise-grade PMax campaign and Google Merchant Center automation engine.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

from src.campaign.bulk_assign_controller import router as campaign_router
app.include_router(campaign_router)


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


@app.post(
    "/v1/auth/google",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    tags=["Authentication"],
    summary="Verify Google Sign-In ID Token",
)
async def verify_google_token(payload: GoogleAuthRequest) -> UserProfileResponse:
    try:
        import os

        client_id = os.getenv("GOOGLE_LOGIN_CLIENT_ID")
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GOOGLE_LOGIN_CLIENT_ID environment variable is not set in config.txt",
            )
        
        from google.auth.transport import requests
        from google.oauth2 import id_token
        
        id_info = id_token.verify_oauth2_token(
            payload.id_token, 
            requests.Request(), 
            audience=client_id
        )
        
        # Verify issuer
        if id_info["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong token issuer.")

        email = id_info.get("email")
        name = id_info.get("name", email.split("@")[0] if email else "User")
        picture = id_info.get("picture", "")

        return UserProfileResponse(
            email=email,
            name=name,
            picture=picture
        )
    except ValueError as val_err:
        logger.warning(f"Google ID Token validation rejected: {val_err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID Token credentials."
        ) from val_err
    except Exception as err:
        logger.error(f"Unexpected error validating Google ID Token: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while validating Google session."
        ) from err


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Adios 2.0 Advanced FastAPI server via Uvicorn...")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
