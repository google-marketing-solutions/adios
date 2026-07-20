"""Unit tests for Auth Token Provider engine."""

from src.core.auth_provider import AuthTokenProvider, GoogleAdsCredentials


def test_auth_token_provider_credentials() -> None:
    provider = AuthTokenProvider()
    creds = provider.get_google_ads_credentials()
    assert isinstance(creds, GoogleAdsCredentials)
    assert creds.developer_token is not None
    assert creds.client_id is not None


def test_auth_token_provider_config_dict() -> None:
    provider = AuthTokenProvider()
    config_dict = provider.get_google_ads_client_config()
    assert isinstance(config_dict, dict)
    assert "developer_token" in config_dict
    assert "client_id" in config_dict
    assert "client_secret" in config_dict
    assert "refresh_token" in config_dict


def test_auth_token_provider_get_client(monkeypatch) -> None:
    from unittest.mock import MagicMock
    import sys
    import pytest

    mock_googleads_client = MagicMock()
    mock_module = MagicMock()
    mock_module.GoogleAdsClient = mock_googleads_client
    monkeypatch.setitem(sys.modules, "google.ads.googleads.client", mock_module)

    mock_oauth_creds = MagicMock()
    mock_oauth_module = MagicMock()
    mock_oauth_module.Credentials = mock_oauth_creds
    monkeypatch.setitem(sys.modules, "google.oauth2.credentials", mock_oauth_module)

    provider = AuthTokenProvider()
    
    # Test without user token and without valid refresh token raises ValueError
    monkeypatch.delenv("GOOGLE_ADS_REFRESH_TOKEN", raising=False)
    with pytest.raises(ValueError, match="No active user OAuth session"):
        provider.get_google_ads_client()

    # Test with custom refresh token
    monkeypatch.setenv("GOOGLE_ADS_REFRESH_TOKEN", "1//04_real_refresh_token")
    provider.get_google_ads_client()
    assert mock_googleads_client.load_from_dict.called

    # Test with user token
    provider.get_google_ads_client(user_access_token="ya29.test_token_123")
    mock_oauth_creds.assert_called_with(token="ya29.test_token_123")
    assert mock_googleads_client.called
