"""
Authentication & Credential Provider Engine.

Manages OAuth 2.0 refresh tokens and Service Account credentials for
Google Ads API, Content API for Shopping, and Google Cloud APIs.
"""

import os
import logging
from pathlib import Path
from typing import Any, Dict
from pydantic import BaseModel, Field

logger = logging.getLogger("adios.core.auth_provider")


def _load_config_txt_env() -> None:
    """Auto-loads environment variables from config.txt in workspace root if not already set."""
    root_dir = Path(__file__).resolve().parent.parent.parent
    config_file = root_dir / "config.txt"
    if config_file.is_file():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val
        except Exception as e:
            logger.warning(f"Could not load {config_file}: {e}")


_load_config_txt_env()


class GoogleAdsCredentials(BaseModel):
    """Pydantic model representing Google Ads API authorization settings."""

    developer_token: str = Field(..., description="Google Ads API Developer Token")
    client_id: str = Field(..., description="OAuth 2.0 Client ID")
    client_secret: str = Field(..., description="OAuth 2.0 Client Secret")
    refresh_token: str = Field(..., description="OAuth 2.0 Refresh Token")
    login_customer_id: str | None = Field(default=None, description="Manager (MCC) Customer ID")
    use_proto_plus: bool = Field(default=True, description="Enable proto-plus message wrappers")


class AuthTokenProvider:
    """Provides authenticated credentials for Google Ads API and Google Cloud services."""

    def __init__(self, gcp_config: Any = None) -> None:
        from src.core.gcp_config import default_gcp_config
        self.gcp_config = gcp_config or default_gcp_config

    def get_google_ads_credentials(self) -> GoogleAdsCredentials:
        """Loads Google Ads API credentials from environment variables or Secret Manager.

        Returns:
            GoogleAdsCredentials object with validation.
        """
        developer_token = os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN", "")
        client_id = (
            os.getenv("GOOGLE_ADS_CLIENT_ID")
            or os.getenv("GOOGLE_LOGIN_CLIENT_ID")
            or ""
        )
        client_secret = (
            os.getenv("GOOGLE_ADS_CLIENT_SECRET")
            or os.getenv("GOOGLE_LOGIN_CLIENT_SECRET")
            or ""
        )
        refresh_token = os.getenv("GOOGLE_ADS_REFRESH_TOKEN", "")
        login_customer_id = (
            os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
            or os.getenv("GOOGLE_ADS_MCC_CUSTOMER_ID")
            or os.getenv("GOOGLE_ADS_CUSTOMER_ID")
        )
        if login_customer_id:
            login_customer_id = login_customer_id.replace("-", "").strip()

        return GoogleAdsCredentials(
            developer_token=developer_token,
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token,
            login_customer_id=login_customer_id,
        )

    def get_google_ads_client_config(self) -> Dict[str, Any]:
        """Returns Google Ads API dict config suitable for GoogleAdsClient.load_from_dict.

        Returns:
            Dictionary payload matching Google Ads client config structure.
        """
        creds = self.get_google_ads_credentials()
        config = {
            "developer_token": creds.developer_token,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "refresh_token": creds.refresh_token,
            "use_proto_plus": creds.use_proto_plus,
        }
        if creds.login_customer_id:
            config["login_customer_id"] = creds.login_customer_id
        return config

    def get_google_ads_client(
        self,
        user_access_token: str | None = None,
        include_login_customer_id: bool = True,
        login_customer_id_override: str | None = None,
    ) -> Any:
        """Instantiates a GoogleAdsClient using either user OAuth access token or environment refresh token.

        Args:
            user_access_token: Optional OAuth 2.0 Bearer access_token from the logged-in user session.
            include_login_customer_id: Whether to set login_customer_id header (must be False for list_accessible_customers).
            login_customer_id_override: Optional specific login_customer_id string to override default MCC ID.

        Returns:
            GoogleAdsClient object initialized with appropriate credentials.
        """
        from google.ads.googleads.client import GoogleAdsClient

        creds = self.get_google_ads_credentials()
        effective_login_id = login_customer_id_override or creds.login_customer_id

        if user_access_token:
            from google.oauth2.credentials import Credentials

            oauth_credentials = Credentials(token=user_access_token)
            kwargs: Dict[str, Any] = {
                "credentials": oauth_credentials,
                "developer_token": creds.developer_token,
                "use_proto_plus": creds.use_proto_plus,
            }
            if include_login_customer_id and effective_login_id:
                kwargs["login_customer_id"] = effective_login_id
            return GoogleAdsClient(**kwargs)
        elif creds.refresh_token and creds.refresh_token != "mock_refresh_token":
            client_config: Dict[str, Any] = {
                "developer_token": creds.developer_token,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "refresh_token": creds.refresh_token,
                "use_proto_plus": creds.use_proto_plus,
            }
            if include_login_customer_id and effective_login_id:
                client_config["login_customer_id"] = effective_login_id
            return GoogleAdsClient.load_from_dict(client_config)
        else:
            raise ValueError("No active user OAuth session or refresh token. Please sign in with Google.")


# Singleton auth provider instance
default_auth_provider = AuthTokenProvider()
