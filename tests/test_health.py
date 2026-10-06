from fastapi import status
from fastapi.testclient import TestClient
import pytest
from src.main import app


@pytest.fixture
def client() -> TestClient:
  """Fixture providing a FastAPI TestClient instance targeting the Adios 2.0 app."""
  return TestClient(app)


def test_health_check_returns_healthy_status_and_metadata(
    client: TestClient,
) -> None:
  """Verifies that the /health endpoint returns 200 OK with expected Python 3/FastAPI metadata."""
  response = client.get("/health")
  assert response.status_code == status.HTTP_200_OK

  data = response.json()
  assert data["status_code"] == "healthy"
  assert data["service"] == "Adios 2.0 Advanced API"
  assert "Python 3" in data["architecture"]
  assert "FastAPI" in data["architecture"]
  assert "Pydantic v2" in data["architecture"]
  assert data["api_version"] == "v1"


def test_global_exception_handler_returns_structured_json() -> None:
  """Verifies that unhandled exceptions are caught by the global exception handler and return structured JSON."""

  @app.get("/_test_unhandled_error")
  async def trigger_unhandled_error() -> None:
    raise RuntimeError("Simulated database connection failure")

  local_client = TestClient(app, raise_server_exceptions=False)
  response = local_client.get("/_test_unhandled_error")
  assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

  data = response.json()
  assert data["error_code"] == 500
  assert data["status"] == "INTERNAL_SERVER_ERROR"
  assert (
      "Simulated database connection failure" in data["details"][0]["message"]
  )
