"""Integration tests for Campaign & Asset Group API endpoints."""

import io
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image
from src.main import app

client = TestClient(app)


def create_test_image_bytes(width: int, height: int) -> bytes:
    img = Image.new("RGB", (width, height), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_get_asset_groups_endpoint() -> None:
    response = client.get("/v1/campaign/asset-groups")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "total_count" in data
    assert "asset_groups" in data
    assert isinstance(data["asset_groups"], list)


def test_get_accessible_accounts_endpoint() -> None:
    response = client.get("/v1/campaign/accounts")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "total_count" in data
    assert "accounts" in data
    assert len(data["accounts"]) > 0
    assert "id" in data["accounts"][0]
    assert "name" in data["accounts"][0]


def test_upload_valid_square_image() -> None:
    img_bytes = create_test_image_bytes(800, 800)
    files = {"file": ("square_dog.png", img_bytes, "image/png")}

    response = client.post("/v1/campaign/upload", files=files)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["ratio_type"] == "SQUARE"
    assert data["field_type"] == "SQUARE_MARKETING_IMAGE"
    assert "file_token" in data


def test_upload_invalid_aspect_ratio_fails() -> None:
    img_bytes = create_test_image_bytes(1920, 1080)
    files = {"file": ("banner.png", img_bytes, "image/png")}

    response = client.post("/v1/campaign/upload", files=files)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert "detail" in data
    assert "Unsupported aspect ratio" in data["detail"]


from unittest.mock import MagicMock, patch

def test_assign_asset_to_asset_groups() -> None:
    # 1. Upload valid image first
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("cat_food.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    file_token = upload_res.json()["file_token"]

    # 2. Assign image to asset groups with mocked Google Ads API
    mock_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.results = [MagicMock(resource_name="customers/9941182026/assets/12345")]
    mock_client.get_service.return_value.mutate_assets.return_value = mock_asset_res

    mock_aga_res = MagicMock()
    mock_aga_res.results = [
        MagicMock(resource_name="customers/9941182026/assetGroupAssets/10101~12345"),
        MagicMock(resource_name="customers/9941182026/assetGroupAssets/10103~12345"),
    ]
    mock_client.get_service.return_value.mutate_asset_group_assets.return_value = mock_aga_res

    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client):
        payload = {
            "file_token": file_token,
            "asset_group_ids": ["10101", "10103"],
            "customer_id": "9941182026",
        }
        assign_res = client.post("/v1/campaign/assign", json=payload)
        assert assign_res.status_code == status.HTTP_200_OK
        assign_data = assign_res.json()
        assert assign_data["total_assigned"] == 2
        assert len(assign_data["results"]) == 2
        assert assign_data["results"][0]["status"] == "SUCCESS"


def test_assign_future_scheduled_asset() -> None:
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("future_promo.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    file_token = upload_res.json()["file_token"]

    payload = {
        "file_token": file_token,
        "asset_group_ids": ["ag_sched_1"],
        "customer_id": "9044713567",
        "start_date": "2099-01-01",
        "end_date": "2099-01-15",
    }
    assign_res = client.post("/v1/campaign/assign", json=payload)
    assert assign_res.status_code == status.HTTP_200_OK
    data = assign_res.json()
    assert data["total_assigned"] == 0
    assert data["results"][0]["status"] == "SCHEDULED_PENDING"

    # Verify job in /scheduled-jobs endpoint
    jobs_res = client.get("/v1/campaign/scheduled-jobs")
    assert jobs_res.status_code == status.HTTP_200_OK
    jobs = jobs_res.json()["jobs"]
    assert any(j["asset_name"] == "future_promo.png" for j in jobs)


def test_trigger_scheduler_endpoint() -> None:
    res = client.post("/v1/campaign/run-scheduler?as_of_date=2026-07-21")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "started_jobs" in data
    assert "unlinked_jobs" in data

