import os
from unittest.mock import MagicMock, patch

from fastapi import status
from fastapi.testclient import TestClient
import pytest
from src.main import app


@pytest.fixture
def client() -> TestClient:
  return TestClient(app, raise_server_exceptions=False)


def test_run_scheduler_missing_env_secret(client: TestClient) -> None:
  with patch.dict(os.environ, {}, clear=True):
    response = client.post(
        "/v1/campaign/jobs/run-scheduler",
        headers={"X-Scheduler-Secret-Key": "some_secret"},
    )
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert "SCHEDULER_SECRET_KEY is not configured" in response.json()["detail"]


def test_run_scheduler_invalid_header_secret(client: TestClient) -> None:
  with patch.dict(os.environ, {"SCHEDULER_SECRET_KEY": "super_secret"}):
    response = client.post(
        "/v1/campaign/jobs/run-scheduler",
        headers={"X-Scheduler-Secret-Key": "wrong_secret"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid scheduler secret key" in response.json()["detail"]


def test_run_scheduler_success(client: TestClient) -> None:
  mock_result = {
      "as_of_date": "2026-07-21",
      "started_jobs": 1,
      "unlinked_jobs": 2,
      "failed_jobs": 0,
      "details": [{"job_id": "j1", "action": "START", "status": "SUCCESS"}],
  }
  with (
      patch.dict(os.environ, {"SCHEDULER_SECRET_KEY": "super_secret"}),
      patch(
          "src.campaign.jobs_router.process_scheduled_jobs",
          return_value=mock_result,
      ) as mock_process,
  ):

    response = client.post(
        "/v1/campaign/jobs/run-scheduler",
        headers={"X-Scheduler-Secret-Key": "super_secret"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["started_jobs"] == 1
    assert data["unlinked_jobs"] == 2
    assert len(data["details"]) == 1
    assert data["details"][0]["job_id"] == "j1"
    mock_process.assert_called_once()


def test_run_scheduler_execution_failure(client: TestClient) -> None:
  with (
      patch.dict(os.environ, {"SCHEDULER_SECRET_KEY": "super_secret"}),
      patch(
          "src.campaign.jobs_router.process_scheduled_jobs",
          side_effect=Exception("Database connection timed out"),
      ),
  ):

    response = client.post(
        "/v1/campaign/jobs/run-scheduler",
        headers={"X-Scheduler-Secret-Key": "super_secret"},
    )
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert (
        "Scheduler execution failed: Database connection timed out"
        in response.json()["detail"]
    )
