from unittest.mock import patch

from fastapi import status
from fastapi.testclient import TestClient
import pytest
from src.main import app


@pytest.fixture(autouse=True)
def setup_env(monkeypatch: pytest.MonkeyPatch) -> None:
  monkeypatch.setenv("GOOGLE_LOGIN_CLIENT_ID", "test_google_login_client_id")


@pytest.fixture
def client() -> TestClient:
  """Fixture providing a FastAPI TestClient instance."""
  return TestClient(app)


def test_verify_google_token_success(client: TestClient) -> None:
  """Verifies that a valid Google ID token returns 200 OK and expected user profile info."""
  payload = {"id_token": "valid_mock_token_123"}

  mock_id_info = {
      "iss": "https://accounts.google.com",
      "sub": "1234567890",
      "email": "user@example.com",
      "name": "Jane Doe",
      "picture": "https://example.com/avatar.jpg",
  }

  with patch(
      "google.oauth2.id_token.verify_oauth2_token", return_value=mock_id_info
  ) as mock_verify:
    response = client.post("/v1/auth/google", json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == "user@example.com"
    assert data["name"] == "Jane Doe"
    assert data["picture"] == "https://example.com/avatar.jpg"

    # Ensure mock verify was called correctly
    mock_verify.assert_called_once()
    args, kwargs = mock_verify.call_args
    assert args[0] == "valid_mock_token_123"
    assert kwargs["audience"] == "test_google_login_client_id"


def test_verify_google_token_invalid_issuer(client: TestClient) -> None:
  """Verifies that an ID token with an invalid issuer raises 401 Unauthorized."""
  payload = {"id_token": "invalid_issuer_token"}
  mock_id_info = {
      "iss": "malicious-issuer.com",
      "sub": "1234567890",
      "email": "user@example.com",
  }

  with patch(
      "google.oauth2.id_token.verify_oauth2_token", return_value=mock_id_info
  ):
    response = client.post("/v1/auth/google", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid Google ID Token credentials" in response.json()["detail"]


def test_verify_google_token_expired_value_error(client: TestClient) -> None:
  """Verifies that token expiration or syntax error returns 401 Unauthorized."""
  payload = {"id_token": "expired_token_abc"}

  with patch(
      "google.oauth2.id_token.verify_oauth2_token",
      side_effect=ValueError("Token expired"),
  ):
    response = client.post("/v1/auth/google", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid Google ID Token credentials" in response.json()["detail"]
