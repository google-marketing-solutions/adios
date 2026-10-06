import os
from unittest import mock
from fastapi import status
from fastapi.testclient import TestClient
import pytest
from src import main
from src.main import app


class FakeFileResponse:

  def __init__(self, path: str):
    self.path = path

  async def __call__(self, scope, receive, send):
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [[b"content-type", b"text/plain"]],
    })
    await send({
        "type": "http.response.body",
        "body": f"Fake content of {self.path}".encode("utf-8"),
    })


@pytest.fixture
def client() -> TestClient:
  return TestClient(app)


def test_unknown_v1_api_returns_structured_404(client: TestClient) -> None:
  response = client.get("/v1/unknown-endpoint")
  assert response.status_code == status.HTTP_404_NOT_FOUND

  data = response.json()
  assert data["error_code"] == 404
  assert data["status"] == "NOT_FOUND"
  assert "not found" in data["message"]
  assert data["details"][0]["reason"] == "ROUTE_NOT_FOUND"


@mock.patch.object(os.path, "isfile", return_value=False, autospec=True)
@mock.patch.object(main, "FileResponse", new=FakeFileResponse)
def test_frontend_route_returns_index_html(
    mock_isfile, client: TestClient
) -> None:
  response = client.get("/dashboard")
  assert response.status_code == status.HTTP_200_OK
  assert "index.html" in response.text


@mock.patch.object(
    os.path,
    "isfile",
    side_effect=lambda path: path
    == os.path.abspath("frontend/dist/adios-frontend/browser/main.js"),
    autospec=True,
)
@mock.patch.object(main, "FileResponse", new=FakeFileResponse)
def test_static_file_returns_file(mock_isfile, client: TestClient) -> None:
  response = client.get("/main.js")
  assert response.status_code == status.HTTP_200_OK
  assert "main.js" in response.text


@mock.patch.object(os.path, "isfile", return_value=True, autospec=True)
@mock.patch.object(main, "FileResponse", new=FakeFileResponse)
def test_path_traversal_blocked(mock_isfile, client: TestClient) -> None:
  response = client.get("/%2e%2e/%2e%2e/config.txt")
  assert response.status_code == status.HTTP_200_OK
  assert "index.html" in response.text
  assert "config.txt" not in response.text
