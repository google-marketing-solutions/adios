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


class AuthConfigResponse(BaseModel):
    client_id: str = Field(..., description="Google Login OAuth Client ID")


class UserProfileResponse(BaseModel):
    email: str = Field(..., description="Verified user email address")
    name: str = Field(..., description="User full display name")
    picture: str = Field(..., description="User profile picture URL")


class AuthCallbackRequest(BaseModel):
    code: str = Field(..., description="Authorization Code received from Google")
    redirect_uri: str = Field(..., description="Redirect URI used during authorization request")


class AuthCallbackResponse(BaseModel):
    access_token: str = Field(..., description="Google OAuth2 Access Token")
    refresh_token: str = Field(..., description="Google OAuth2 Refresh Token for offline access")
    id_token: str = Field(..., description="Google OAuth2 ID Token JWT")


app = FastAPI(
    title="Adios 2.0 Advanced API",
    description="Enterprise-grade PMax campaign and Google Merchant Center automation engine.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

from src.campaign.bulk_assign_controller import router as campaign_router
from src.campaign.jobs_router import router as jobs_router
app.include_router(campaign_router)
app.include_router(jobs_router)


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


@app.get(
    "/v1/auth/config",
    response_model=AuthConfigResponse,
    status_code=status.HTTP_200_OK,
    tags=["Authentication"],
    summary="Get Public OAuth Client ID Config",
)
async def get_auth_config() -> AuthConfigResponse:
    """Returns the Google OAuth Client ID loaded from environment/config.txt."""
    import os

    client_id = os.getenv("GOOGLE_LOGIN_CLIENT_ID", "")
    return AuthConfigResponse(client_id=client_id)


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


@app.post(
    "/v1/auth/callback",
    response_model=AuthCallbackResponse,
    status_code=status.HTTP_200_OK,
    tags=["Authentication"],
    summary="Exchange Authorization Code for Access & Refresh Tokens",
)
async def auth_callback(payload: AuthCallbackRequest) -> AuthCallbackResponse:
    """
    Exchanges the Google OAuth2 Authorization Code for short-lived access token,
    long-lived offline refresh token, and user identity ID token.
    """
    import httpx
    from fastapi import HTTPException
    from src.core.auth_provider import default_auth_provider

    creds = default_auth_provider.get_google_ads_credentials()
    if not creds.client_id or not creds.client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth Client ID or Client Secret is not configured in the backend."
        )

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": payload.code,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "redirect_uri": payload.redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)

    if response.status_code != 200:
        logger.warning(f"Google OAuth Code Exchange failed: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to exchange Authorization Code: {response.text}"
        )

    token_data = response.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    id_token = token_data.get("id_token")

    if not access_token or not refresh_token or not id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return all required tokens. Did you configure access_type=offline and prompt=consent?"
        )

    return AuthCallbackResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        id_token=id_token,
    )


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Adios 2.0 Advanced FastAPI server via Uvicorn...")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
