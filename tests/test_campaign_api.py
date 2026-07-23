"""Integration tests for Campaign & Asset Group API endpoints."""

import io
import pytest
from unittest.mock import MagicMock, patch
from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image
from src.main import app
from src.core.firestore_service import ScheduledJobDocument, ScheduledJobStatus

client = TestClient(app)


def create_test_image_bytes(width: int, height: int) -> bytes:
    img = Image.new("RGB", (width, height), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def mock_dependencies():
    with patch("src.campaign.bulk_assign_controller.default_firestore_service") as mock_fs, \
         patch("src.campaign.bulk_assign_controller.default_gcs_service") as mock_gcs:
        
        mock_gcs.upload_image.return_value = "gs://bucket/assets/token_filename.png"
        valid_bytes = create_test_image_bytes(1000, 1000)
        mock_gcs.download_image_by_token.return_value = (valid_bytes, "filename.png")
        
        mock_fs.get_protected_assets.return_value = {}
        mock_fs.get_all_assets.return_value = []
        
        stored_jobs = []
        def mock_create_job(job):
            stored_jobs.append(job)
        mock_fs.create_scheduled_job.side_effect = mock_create_job
        mock_fs.list_scheduled_jobs.side_effect = lambda cid: stored_jobs

        yield mock_fs, mock_gcs


def test_get_asset_groups_endpoint() -> None:
    response = client.get("/v1/campaign/asset-groups")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "total_count" in data
    assert "asset_groups" in data
    assert isinstance(data["asset_groups"], list)

def test_get_asset_groups_live_api_fallback() -> None:
    from unittest.mock import MagicMock, patch
    
    mock_creds = MagicMock()
    mock_creds.developer_token = "real_dev_token_123"
    mock_creds.login_customer_id = "111222333"
    
    mock_client_mcc = MagicMock()
    mock_client_customer = MagicMock()
    
    # First strategy (mcc_header) returns zero groups
    mock_client_mcc.get_service.return_value.search.return_value = []
    
    # Second strategy (customer_header) returns a valid group
    mock_row = MagicMock()
    mock_row.asset_group.id = 12345
    mock_row.asset_group.name = "Test AG"
    mock_row.campaign.id = 67890
    mock_row.campaign.name = "Test Campaign"
    mock_row.asset_group.status.name = "ENABLED"
    mock_row.campaign.status.name = "ENABLED"
    
    # We mock search so that the first call (for links) returns an empty list, and the second call (for asset groups) also returns an empty list,
    # OR we can just check that it calls search for both strategies sequentially!
    # Let's mock side_effect:
    # mcc_header: main search -> [], customer_header: main search -> [mock_row]
    # Wait, the endpoint does TWO searches per strategy: main search, and asset_counts search!
    mock_client_mcc.get_service.return_value.search.side_effect = [[], []]
    mock_client_customer.get_service.return_value.search.side_effect = [[mock_row], []]
    
    def mock_get_client(user_access_token, include_login_customer_id, login_customer_id_override=None):
        if include_login_customer_id and not login_customer_id_override:
            return mock_client_mcc
        if login_customer_id_override == "1234567890":
            return mock_client_customer
        raise Exception("Unexpected client")
        
    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_credentials", return_value=mock_creds), \
         patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", side_effect=mock_get_client):
        
        response = client.get("/v1/campaign/asset-groups?customer_id=1234567890")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["asset_groups"][0]["name"] == "Test AG"
        assert data["asset_groups"][0]["campaign_status"] == "ENABLED"
        assert data["source"] == "live_google_ads_api"

def test_get_asset_groups_live_api_all_empty() -> None:
    from unittest.mock import MagicMock, patch
    
    mock_creds = MagicMock()
    mock_creds.developer_token = "real_dev_token_123"
    mock_creds.login_customer_id = "111222333"
    
    mock_client = MagicMock()
    mock_client.get_service.return_value.search.return_value = []
    
    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_credentials", return_value=mock_creds), \
         patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client):
        
        response = client.get("/v1/campaign/asset-groups?customer_id=1234567890")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 0
        assert len(data["asset_groups"]) == 0
        assert "No Asset Groups found in this Google Ads account" in data["error_message"]


def test_get_asset_groups_live_api_capacity_logic() -> None:
    from unittest.mock import MagicMock, patch
    
    mock_creds = MagicMock()
    mock_creds.developer_token = "real_dev_token_123"
    mock_creds.login_customer_id = "111222333"
    
    mock_client = MagicMock()
    
    # Asset Group row
    ag_row = MagicMock()
    ag_row.asset_group.id = 12345
    ag_row.asset_group.name = "Test AG"
    ag_row.campaign.id = 67890
    ag_row.campaign.name = "Test Campaign"
    ag_row.asset_group.status.name = "ENABLED"
    ag_row.campaign.status.name = "ENABLED"
    
    # Asset rows: 1 Landscape, 1 Square, 1 Portrait, 1 Tall Portrait, 1 Logo, 1 Landscape Logo
    def create_asset_row(field_type: str):
        r = MagicMock()
        r.asset_group.id = 12345
        r.asset_group_asset.field_type.name = field_type
        r.asset.type.name = "IMAGE"
        return r
        
    asset_rows = [
        create_asset_row("MARKETING_IMAGE"),
        create_asset_row("SQUARE_MARKETING_IMAGE"),
        create_asset_row("PORTRAIT_MARKETING_IMAGE"),
        create_asset_row("TALL_PORTRAIT_MARKETING_IMAGE"),
        create_asset_row("LOGO"),
        create_asset_row("LANDSCAPE_LOGO"),
    ]
    
    mock_client.get_service.return_value.search.side_effect = [[ag_row], asset_rows]
    
    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_credentials", return_value=mock_creds), \
         patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client):
        
        response = client.get("/v1/campaign/asset-groups?customer_id=1234567890")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        ag = data["asset_groups"][0]
        assert ag["campaign_status"] == "ENABLED"
        
        # Logos must be EXCLUDED, Tall Portrait INCLUDED. So strictly 4 images!
        assert ag["total_image_count"] == 4
        assert ag["total_image_capacity"] == 20
        assert ag["landscape_count"] == 1
        assert ag["landscape_capacity"] == 20
        assert ag["portrait_count"] == 1
        assert ag["portrait_capacity"] == 20
        assert ag["tall_portrait_count"] == 1
        assert ag["tall_portrait_capacity"] == 20


def test_get_campaign_assets_endpoint() -> None:
    from unittest.mock import MagicMock, patch
    
    mock_creds = MagicMock()
    mock_creds.developer_token = "real_dev_token_123"
    mock_creds.login_customer_id = "111222333"
    
    mock_client = MagicMock()
    
    row = MagicMock()
    row.asset.id = 999
    row.asset.name = "Tall Portrait Asset"
    row.asset.image_asset.full_size.url = "http://example.com/tall.png"
    row.asset_group_asset.field_type.name = "TALL_PORTRAIT_MARKETING_IMAGE"
    
    mock_client.get_service.return_value.search.return_value = [row]
    
    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_credentials", return_value=mock_creds), \
         patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client):
        
        response = client.get("/v1/campaign/assets?customer_id=1234567890")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["assets"][0]["id"] == "999"
        assert data["assets"][0]["name"] == "Tall Portrait Asset"


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
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
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


def test_trigger_scheduler_endpoint() -> None:
    with patch("src.campaign.bulk_assign_controller.process_scheduled_jobs") as mock_proc:
        mock_proc.return_value = {"started_jobs": 1, "unlinked_jobs": 0, "failed_jobs": 0, "details": []}
        res = client.post("/v1/campaign/run-scheduler?as_of_date=2026-07-21")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert "started_jobs" in data
        assert "unlinked_jobs" in data


def test_get_campaign_assets_endpoint() -> None:
    res = client.get("/v1/campaign/assets")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "total_count" in data
    assert "assets" in data


def test_toggle_asset_protection_endpoint(mock_dependencies) -> None:
    mock_fs, _ = mock_dependencies
    payload = {
        "asset_id": "test_asset_999", 
        "is_protected": True, 
        "customer_id": "123-456-7890"
    }
    res = client.post("/v1/campaign/assets/toggle-protection", json=payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["asset_id"] == "test_asset_999"
    assert data["is_protected"] is True
    assert data["success"] is True
    
    mock_fs.toggle_protection.assert_called_once_with(
        customer_id="1234567890",
        asset_id="test_asset_999",
        is_protected=True
    )


def test_toggle_asset_protection_missing_customer_id() -> None:
    payload = {"asset_id": "test_asset_999", "is_protected": True}
    res = client.post("/v1/campaign/assets/toggle-protection", json=payload)
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_assign_partial_failure_mapping() -> None:
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("cat_food.png", img_bytes, "image/png")},
    )
    file_token = upload_res.json()["file_token"]

    mock_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.results = [MagicMock(resource_name="customers/9941182026/assets/12345")]
    mock_client.get_service.return_value.mutate_assets.return_value = mock_asset_res

    # Setup partial failure by mapping operations index
    mock_aga_res = MagicMock()
    mock_aga_res.results = [
        MagicMock(resource_name="customers/9941182026/assetGroupAssets/10101~12345"),
        MagicMock(resource_name=""), # Empty resource_name for failure
    ]
    
    # Mock GoogleAdsFailure detail Status proto
    status_proto = MagicMock()
    error_detail = MagicMock()
    error_detail.message = "Resource limit exceeded for Marketing Images"
    fpe = MagicMock()
    fpe.field_name = "operations"
    fpe.index = 1
    error_detail.location.field_path_elements = [fpe]
    
    failure_proto = MagicMock()
    failure_proto.errors = [error_detail]
    
    # Helper to mimic the unpack and typing behavior
    def mock_unpack(msg_dest):
        msg_dest.errors = [error_detail]
    
    detail_proto = MagicMock()
    detail_proto.Unpack.side_effect = mock_unpack
    
    status_proto.details = [detail_proto]
    mock_aga_res.partial_failure_error = status_proto
    
    mock_client.get_service.return_value.mutate_asset_group_assets.return_value = mock_aga_res
    
    # Mock search to return zero currently linked images
    mock_client.get_service.return_value.search.return_value = []
    
    mock_client.get_type.return_value = MagicMock(_pb=MagicMock())

    mock_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_client.enums.AssetFieldTypeEnum, "SQUARE_MARKETING_IMAGE", 1)

    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client):
        payload = {
            "file_token": file_token,
            "asset_group_ids": ["10101", "10103"],
            "customer_id": "9941182026",
        }
        assign_res = client.post("/v1/campaign/assign", json=payload)
        assert assign_res.status_code == status.HTTP_200_OK
        assign_data = assign_res.json()
        
        assert assign_data["total_assigned"] == 1
        assert len(assign_data["results"]) == 2
        
        # Index 0 succeeds
        assert assign_data["results"][0]["asset_group_id"] == "10101"
        assert assign_data["results"][0]["status"] == "SUCCESS"
        
        # Index 1 fails with precise extracted partial failure error
        assert assign_data["results"][1]["asset_group_id"] == "10103"
        assert assign_data["results"][1]["status"] == "FAILED"
        assert "Resource limit exceeded" in assign_data["results"][1]["error_message"]

def test_assign_evicted_asset_passed_on_failure() -> None:
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("cat_food.png", img_bytes, "image/png")},
    )
    file_token = upload_res.json()["file_token"]

    mock_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.results = [MagicMock(resource_name="customers/9941182026/assets/12345")]
    mock_client.get_service.return_value.mutate_assets.return_value = mock_asset_res

    # Mock capacity reached with 20 linked images
    def create_mock_row(idx: str):
        row = MagicMock()
        row.asset_group_asset.asset = f"customers/9941182026/assets/{idx}"
        row.asset.image_asset.full_size.url = f"https://example.com/{idx}.png"
        row.asset.name = f"Image {idx}"
        row.asset_group_asset.field_type.name = "SQUARE_MARKETING_IMAGE"
        row.metrics.impressions = 1000
        row.metrics.clicks = 10
        row.metrics.cost_micros = 0
        return row

    mock_client.get_service.return_value.search.side_effect = [
        [create_mock_row(str(i)) for i in range(20)], # query_links
        [create_mock_row(str(i)) for i in range(20)], # query_stats
    ]

    mock_aga_res = MagicMock()
    mock_aga_res.results = [MagicMock(resource_name="")] # Mutation fails

    status_proto = MagicMock()
    error_detail = MagicMock()
    error_detail.message = "Transaction error"
    fpe = MagicMock()
    fpe.field_name = "operations"
    fpe.index = 1 # 0 is REMOVE, 1 is ADD
    error_detail.location.field_path_elements = [fpe]
    
    def mock_unpack(msg_dest):
        msg_dest.errors = [error_detail]
    
    detail_proto = MagicMock()
    detail_proto.Unpack.side_effect = mock_unpack
    status_proto.details = [detail_proto]
    mock_aga_res.partial_failure_error = status_proto

    mock_client.get_service.return_value.mutate_asset_group_assets.return_value = mock_aga_res
    mock_client.get_type.return_value = MagicMock(_pb=MagicMock())
    mock_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_client.enums.AssetFieldTypeEnum, "SQUARE_MARKETING_IMAGE", 1)

    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client), \
         patch("src.campaign.kpi_eviction_service.default_firestore_service", MagicMock()):
        
        payload = {
            "file_token": file_token,
            "asset_group_ids": ["10101"],
            "customer_id": "9941182026",
            "swap_rules": {"lookback_window": "30d", "eviction_kpi": "clicks"}
        }
        assign_res = client.post("/v1/campaign/assign", json=payload)
        assert assign_res.status_code == status.HTTP_200_OK
        assign_data = assign_res.json()
        
        assert assign_data["results"][0]["status"] == "FAILED"
        assert assign_data["results"][0]["evicted_asset"] is not None
        assert "asset_id" in assign_data["results"][0]["evicted_asset"]


def test_assign_already_linked_no_op() -> None:
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("cat_food.png", img_bytes, "image/png")},
    )
    file_token = upload_res.json()["file_token"]

    mock_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.results = [MagicMock(resource_name="customers/9941182026/assets/12345")]
    mock_client.get_service.return_value.mutate_assets.return_value = mock_asset_res

    # Mock search returning the asset as ALREADY LINKED
    row = MagicMock()
    row.asset_group_asset.asset = "customers/9941182026/assets/12345"
    row.asset_group_asset.field_type.name = "SQUARE_MARKETING_IMAGE"
    row.asset.name = "Test"
    row.asset.image_asset.full_size.url = "http://test.com/img.png"
    
    mock_client.get_service.return_value.search.return_value = [row]

    mock_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_client.enums.AssetFieldTypeEnum, "SQUARE_MARKETING_IMAGE", 1)

    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client):
        payload = {
            "file_token": file_token,
            "asset_group_ids": ["10101"],
            "customer_id": "9941182026",
        }
        assign_res = client.post("/v1/campaign/assign", json=payload)
        assert assign_res.status_code == status.HTTP_200_OK
        assign_data = assign_res.json()
        
        assert assign_data["total_assigned"] == 0
        assert len(assign_data["results"]) == 1
        assert assign_data["results"][0]["status"] == "FAILED"
        assert "already linked" in assign_data["results"][0]["error_message"]


def test_assign_eviction_triggers_atomic_mutation_and_surfaces_error_code() -> None:
    from unittest.mock import MagicMock, patch
    import grpc
    from google.protobuf.any import Any as ProtoAny
    from fastapi import status
    import importlib
    from google.ads.googleads.client import _DEFAULT_VERSION
    from google.ads.googleads.errors import GoogleAdsException

    errors_module = importlib.import_module(f"google.ads.googleads.{_DEFAULT_VERSION}.errors.types.errors")
    resource_count_limit_error_module = importlib.import_module(f"google.ads.googleads.{_DEFAULT_VERSION}.errors.types.resource_count_limit_exceeded_error")
    services_module = importlib.import_module(f"google.ads.googleads.{_DEFAULT_VERSION}.services.types.asset_group_asset_service")
    
    GoogleAdsFailure = errors_module.GoogleAdsFailure
    GoogleAdsError = errors_module.GoogleAdsError
    ResourceCountLimitExceededErrorEnum = resource_count_limit_error_module.ResourceCountLimitExceededErrorEnum
    MutateAssetGroupAssetsRequest = services_module.MutateAssetGroupAssetsRequest

    # 1. Upload valid image first
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("eviction_test.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    file_token = upload_res.json()["file_token"]

    mock_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.results = [MagicMock(resource_name="customers/9941182026/assets/12345")]
    mock_client.get_service.return_value.mutate_assets.return_value = mock_asset_res

    # Mock capacity reached (20 linked images)
    def create_mock_row(idx: str):
        row = MagicMock()
        row.asset_group_asset.asset = f"customers/9941182026/assets/{idx}"
        row.asset.image_asset.full_size.url = f"https://example.com/{idx}.png"
        row.asset.name = f"Image {idx}"
        row.asset_group_asset.field_type.name = "SQUARE_MARKETING_IMAGE"
        row.metrics.impressions = 1000
        row.metrics.clicks = 10
        row.metrics.cost_micros = 0
        return row

    mock_client.get_service.return_value.search.side_effect = [
        [create_mock_row(str(i)) for i in range(20)],
        [create_mock_row(str(i)) for i in range(20)],
    ]

    # Intercept the Mutate request object to assert its properties
    captured_requests = []
    def mock_mutate(request):
        captured_requests.append(request)

        failure = GoogleAdsFailure()
        err = GoogleAdsError()
        err.message = "Resource limit exceeded for Marketing Images."
        err.error_code.resource_count_limit_exceeded_error = ResourceCountLimitExceededErrorEnum.ResourceCountLimitExceededError.RESOURCE_LIMIT
        failure.errors.append(err)

        exc = GoogleAdsException(
            error=MagicMock(),
            call=MagicMock(),
            failure=failure,
            request_id="req_123"
        )
        raise exc

    mock_client.get_service.return_value.mutate_asset_group_assets.side_effect = mock_mutate
    
    # Setup real request type creation
    def mock_get_type(name: str):
        if hasattr(services_module, name):
            return getattr(services_module, name)()
        return MagicMock()
    mock_client.get_type.side_effect = mock_get_type

    mock_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_client.enums.AssetFieldTypeEnum, "SQUARE_MARKETING_IMAGE", 1)

    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client), \
         patch("src.campaign.kpi_eviction_service.default_firestore_service", MagicMock()):
        
        payload = {
            "file_token": file_token,
            "asset_group_ids": ["10101"],
            "customer_id": "9941182026",
            "swap_rules": {"lookback_window": "30d", "eviction_kpi": "clicks"}
        }
        assign_res = client.post("/v1/campaign/assign", json=payload)
        assert assign_res.status_code == status.HTTP_200_OK
        assign_data = assign_res.json()
        
        assert len(captured_requests) == 1
        assert captured_requests[0].partial_failure is False
        assert len(captured_requests[0].operations) == 2 # 1 REMOVE + 1 ADD
        assert assign_data["results"][0]["status"] == "FAILED"
        assert "RESOURCE_LIMIT" in assign_data["results"][0]["error_message"]
        assert "Resource limit exceeded" in assign_data["results"][0]["error_message"]


def test_assign_consecutive_swaps_grace_period() -> None:
    # 1. Upload valid image first
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("cat_food.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    file_token = upload_res.json()["file_token"]

    mock_client = MagicMock()
    mock_client.get_service.return_value.mutate_assets.side_effect = [
        MagicMock(results=[MagicMock(resource_name="customers/9941182026/assets/new123")]),
        MagicMock(results=[MagicMock(resource_name="customers/9941182026/assets/new456")]),
    ]

    def create_mock_row(idx: str):
        row = MagicMock()
        row.asset_group_asset.asset = f"customers/9941182026/assets/{idx}"
        row.asset.image_asset.full_size.url = f"https://example.com/{idx}.png"
        row.asset.name = f"Image {idx}"
        row.asset_group_asset.field_type.name = "SQUARE_MARKETING_IMAGE"
        row.metrics.impressions = 1000
        row.metrics.clicks = 10
        row.metrics.cost_micros = 0
        return row

    first_search_links = [create_mock_row(str(i)) for i in range(20)]
    second_search_links = [create_mock_row(str(i)) for i in range(1, 20)] + [create_mock_row("new123")]

    mock_client.get_service.return_value.search.side_effect = [
        first_search_links, 
        first_search_links, 
        second_search_links, 
        second_search_links, 
    ]

    from google.ads.googleads.client import _DEFAULT_VERSION
    import importlib
    services_module = importlib.import_module(f"google.ads.googleads.{_DEFAULT_VERSION}.services.types.asset_group_asset_service")

    def mock_get_type(name: str):
        if hasattr(services_module, name):
            return getattr(services_module, name)()
        return MagicMock()
    mock_client.get_type.side_effect = mock_get_type

    mock_client.get_service.return_value.mutate_asset_group_assets.side_effect = [
        MagicMock(results=[
            MagicMock(resource_name=""), 
            MagicMock(resource_name="customers/9941182026/assetGroupAssets/10101~new123") 
        ]),
        MagicMock(results=[
            MagicMock(resource_name=""), 
            MagicMock(resource_name="customers/9941182026/assetGroupAssets/10101~new456") 
        ]),
    ]
    mock_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_client.enums.AssetFieldTypeEnum, "SQUARE_MARKETING_IMAGE", 1)

    link_history = []
    def mock_save_op(op):
        link_history.append(op)
    
    mock_fs = MagicMock()
    mock_fs.get_protected_assets.return_value = []
    mock_fs.get_link_history_for_group.side_effect = lambda cid, ag_id: link_history
    mock_fs.save_link_operation.side_effect = mock_save_op

    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client), \
         patch("src.campaign.kpi_eviction_service.default_firestore_service", mock_fs), \
         patch("src.campaign.bulk_assign_controller.default_firestore_service", mock_fs):
        
        payload1 = {
            "file_token": file_token,
            "asset_group_ids": ["10101"],
            "customer_id": "9941182026",
            "swap_rules": {"lookback_window": "30d", "eviction_kpi": "clicks", "grace_period_minutes": 1}
        }
        res1 = client.post("/v1/campaign/assign", json=payload1)
        assert res1.status_code == status.HTTP_200_OK
        data1 = res1.json()
        assert data1["results"][0]["status"] == "SUCCESS"
        assert data1["results"][0]["evicted_asset"]["asset_id"] == "0"
        
        img_bytes2 = create_test_image_bytes(1000, 1000)
        upload_res2 = client.post(
            "/v1/campaign/upload",
            files={"file": ("dog_food.png", img_bytes2, "image/png")},
        )
        file_token2 = upload_res2.json()["file_token"]
        
        payload2 = {
            "file_token": file_token2,
            "asset_group_ids": ["10101"],
            "customer_id": "9941182026",
            "swap_rules": {"lookback_window": "30d", "eviction_kpi": "clicks", "grace_period_minutes": 1}
        }
        res2 = client.post("/v1/campaign/assign", json=payload2)
        assert res2.status_code == status.HTTP_200_OK
        data2 = res2.json()
        
        assert data2["results"][0]["evicted_asset"]["asset_id"] == "1"


def test_assign_scheduled_end_date_saves_tokens_and_evictions() -> None:
    from src.core.auth_provider import GoogleAdsCredentials
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("schedule_test.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    file_token = upload_res.json()["file_token"]

    mock_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.resource_name = "customers/9941182026/assets/new_sched_123"
    mock_client.get_service("AssetService").mutate_assets.return_value.results = [mock_asset_res]

    mock_aga_res_remove = MagicMock()
    mock_aga_res_remove.resource_name = "customers/9941182026/assetGroupAssets/10101~0~SQUARE_MARKETING_IMAGE"
    mock_aga_res_add = MagicMock()
    mock_aga_res_add.resource_name = "customers/9941182026/assetGroupAssets/10101~new_sched_123~SQUARE_MARKETING_IMAGE"
    mock_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.return_value.results = [
        mock_aga_res_remove,
        mock_aga_res_add,
    ]

    def create_mock_row(idx: str):
        row = MagicMock()
        row.asset_group_asset.asset = f"customers/9941182026/assets/{idx}"
        row.asset.image_asset.full_size.url = f"https://example.com/{idx}.png"
        row.asset.name = f"Image {idx}"
        row.asset_group_asset.field_type.name = "SQUARE_MARKETING_IMAGE"
        row.metrics.clicks = 100
        return row

    mock_client.get_service("GoogleAdsService").search.side_effect = [
        [create_mock_row(str(i)) for i in range(20)],  # Full group to force eviction
        [create_mock_row(str(i)) for i in range(20)],
    ]

    mock_creds = GoogleAdsCredentials(
        developer_token="dev_tok",
        client_id="client_id",
        client_secret="client_sec",
        refresh_token="test_schedule_refresh_token",
        use_proto_plus=False,
    )

    mock_fs = MagicMock()
    mock_fs.get_protected_assets.return_value = []
    mock_fs.get_link_history_for_group.return_value = []

    with patch("src.core.auth_provider.default_auth_provider.get_google_ads_client", return_value=mock_client), \
         patch("src.core.auth_provider.default_auth_provider.get_google_ads_credentials", return_value=mock_creds), \
         patch("src.campaign.kpi_eviction_service.default_firestore_service", mock_fs), \
         patch("src.campaign.bulk_assign_controller.default_firestore_service", mock_fs):
        
        payload = {
            "file_token": file_token,
            "asset_group_ids": ["10101"],
            "customer_id": "9941182026",
            "end_date": "2026-12-31",
            "swap_rules": {"lookback_window": "30d", "eviction_kpi": "clicks", "grace_period_minutes": 1}
        }
        headers = {"X-Refresh-Token": "test_schedule_refresh_token"}
        res = client.post("/v1/campaign/assign", json=payload, headers=headers)
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["results"][0]["status"] == "SUCCESS"
        assert data["results"][0]["evicted_asset"] is not None

        # Verify ScheduledJobDocument was created with refresh_token and evicted_asset_ids
        mock_fs.create_scheduled_job.assert_called_once()
        saved_job = mock_fs.create_scheduled_job.call_args[0][0]
        
        assert saved_job.status == "LINKED"
        assert saved_job.end_date == "2026-12-31"
        assert saved_job.refresh_token == "test_schedule_refresh_token"
        assert "10101" in saved_job.evicted_asset_ids
        assert saved_job.evicted_asset_ids["10101"] == data["results"][0]["evicted_asset"]["asset_id"]


def test_assign_scheduled_fallback_saves_refresh_token() -> None:
    from src.core.auth_provider import GoogleAdsCredentials
    img_bytes = create_test_image_bytes(1000, 1000)
    upload_res = client.post(
        "/v1/campaign/upload",
        files={"file": ("fallback_sched.png", img_bytes, "image/png")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    file_token = upload_res.json()["file_token"]

    mock_creds = GoogleAdsCredentials(
        developer_token="mock_developer_token_2026",
        client_id="client_id",
        client_secret="client_sec",
        refresh_token="old_unused",
        use_proto_plus=False,
    )

    mock_fs = MagicMock()
    with patch("src.campaign.bulk_assign_controller.default_firestore_service", mock_fs), \
         patch("src.core.auth_provider.default_auth_provider.get_google_ads_credentials", return_value=mock_creds):

        payload = {
            "file_token": file_token,
            "asset_group_ids": ["20202"],
            "customer_id": "9941182026",
            "end_date": "2026-11-30",
        }
        headers = {"X-Refresh-Token": "fallback_refresh_token_123"}
        res = client.post("/v1/campaign/assign", json=payload, headers=headers)
        assert res.status_code == status.HTTP_200_OK

        mock_fs.create_scheduled_job.assert_called_once()
        saved_job = mock_fs.create_scheduled_job.call_args[0][0]
        assert saved_job.end_date == "2026-11-30"
        assert saved_job.refresh_token == "fallback_refresh_token_123"


def test_assign_scheduled_end_date_requires_refresh_token() -> None:
    payload = {
        "file_token": "dummy_token",
        "asset_group_ids": ["20202"],
        "customer_id": "9941182026",
        "end_date": "2026-11-30",
    }
    res = client.post("/v1/campaign/assign", json=payload)
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert "No Refresh Token provided" in res.json()["detail"]
