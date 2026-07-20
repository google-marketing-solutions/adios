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


def test_assign_asset_to_asset_groups() -> None:
    # 1. Upload valid image first
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("cat_food.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    file_token = upload_res.json()["file_token"]

    # 2. Assign image to asset groups
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
