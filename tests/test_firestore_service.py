"""Unit tests for FirestoreService."""

from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest
from src.core.firestore_service import (
    FirestoreService,
    AssetDocument,
    LinkOperationDocument,
    ProtectedAssetDocument,
    ScheduledJobDocument,
    OperationType,
    OperationStatus,
    ScheduledJobStatus,
)
from src.core.gcp_config import GCPConfig


@pytest.fixture
def mock_firestore() -> tuple[MagicMock, FirestoreService]:
    mock_client = MagicMock()
    config = GCPConfig(project_id="test-proj", firestore_database_id="test-db")
    service = FirestoreService(config=config)
    service._client = mock_client
    return mock_client, service


def test_save_asset_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    asset = AssetDocument(
        google_ads_asset_id="12345",
        customer_id="9044713567",
        gcs_uri="gs://bucket/assets/1.png",
        asset_name="image.png",
    )
    
    service.save_asset(asset)
    
    client.collection.assert_called_once_with("assets")
    client.collection().document.assert_called_once_with("12345")
    client.collection().document().set.assert_called_once_with(asset.model_dump())


def test_get_asset_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    now = datetime.now(timezone.utc)
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "google_ads_asset_id": "12345",
        "customer_id": "9044713567",
        "gcs_uri": "gs://bucket/assets/1.png",
        "asset_name": "image.png",
        "asset_group_ids": ["ag1"],
        "created_at": now,
    }
    client.collection().document().get.return_value = mock_doc

    result = service.get_asset("9044713567", "12345")
    
    assert result is not None
    assert result.google_ads_asset_id == "12345"
    assert result.created_at == now
    client.collection.assert_called_with("assets")


def test_save_link_operation_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    op = LinkOperationDocument(
        operation_id="uuid-1",
        operation_type=OperationType.LINK,
        customer_id="9044713567",
        asset_group_id="ag1",
        google_ads_asset_id="12345",
        status=OperationStatus.SUCCESS,
    )
    
    service.save_link_operation(op)
    
    client.collection.assert_called_once_with("asset_group_links")
    client.collection().document.assert_called_once_with("uuid-1")
    client.collection().document().set.assert_called_once_with(op.model_dump())


def test_get_last_linked_asset_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    mock_doc1 = MagicMock()
    mock_doc1.to_dict.return_value = {"google_ads_asset_id": "12345"}
    
    # Mocking chain: collection().where().where().order_by().limit().stream()
    mock_query = MagicMock()
    client.collection.return_value.where.return_value = mock_query
    mock_query.where.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.stream.return_value = [mock_doc1]
    
    # Mock for get_asset which is called internally
    mock_asset_doc = MagicMock()
    mock_asset_doc.exists = True
    now = datetime.now(timezone.utc)
    mock_asset_doc.to_dict.return_value = {
        "google_ads_asset_id": "12345",
        "customer_id": "9044713567",
        "gcs_uri": "gs://bucket/assets/1.png",
        "asset_name": "image.png",
        "asset_group_ids": ["ag1"],
        "created_at": now,
    }
    client.collection("assets").document().get.return_value = mock_asset_doc

    result = service.get_last_linked_asset("9044713567", "ag1")
    
    assert result is not None
    assert result.google_ads_asset_id == "12345"
    client.collection.assert_any_call("asset_group_links")
    mock_query.order_by.assert_called_once_with("timestamp", direction="DESCENDING")


def test_toggle_protection_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    
    service.toggle_protection("9044713567", "12345", True)
    
    client.collection.assert_called_once_with("protected_assets")
    client.collection().document.assert_called_once_with("12345")
    # We expect it to save a ProtectedAssetDocument dict
    called_args = client.collection().document().set.call_args[0][0]
    assert called_args["is_protected"] is True
    assert called_args["customer_id"] == "9044713567"


def test_get_protected_assets_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    mock_doc1 = MagicMock()
    mock_doc1.to_dict.return_value = {"google_ads_asset_id": "12345", "is_protected": True}
    
    mock_query = MagicMock()
    client.collection.return_value.where.return_value = mock_query
    mock_query.where.return_value = mock_query
    mock_query.stream.return_value = [mock_doc1]

    result = service.get_protected_assets("9044713567")
    
    assert "12345" in result
    client.collection.assert_called_once_with("protected_assets")


def test_create_scheduled_job_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    job = ScheduledJobDocument(
        job_id="job-1",
        customer_id="9044713567",
        asset_group_ids=["ag1"],
        asset_name="start.png",
        image_gcs_uri="gs://bucket/assets/start.png",
        start_date="2026-07-20",
        end_date="2026-07-30",
        status=ScheduledJobStatus.PENDING,
    )
    
    service.create_scheduled_job(job)
    
    client.collection.assert_called_once_with("scheduled_jobs")
    client.collection().document.assert_called_once_with("job-1")
    client.collection().document().set.assert_called_once_with(job.model_dump())


def test_get_scheduled_job_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    now = datetime.now(timezone.utc)
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "job_id": "job-1",
        "customer_id": "9044713567",
        "asset_group_ids": ["ag1"],
        "asset_name": "start.png",
        "image_gcs_uri": "gs://bucket/assets/start.png",
        "start_date": "2026-07-20",
        "end_date": "2026-07-30",
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }
    client.collection().document().get.return_value = mock_doc

    result = service.get_scheduled_job("9044713567", "job-1")
    
    assert result is not None
    assert result.job_id == "job-1"
    client.collection.assert_called_with("scheduled_jobs")


def test_update_scheduled_job_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    
    # First mock the get to return the existing job
    now = datetime.now(timezone.utc)
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "job_id": "job-1",
        "customer_id": "9044713567",
        "asset_group_ids": ["ag1"],
        "asset_name": "start.png",
        "image_gcs_uri": "gs://bucket/assets/start.png",
        "start_date": "2026-07-20",
        "end_date": "2026-07-30",
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }
    client.collection().document().get.return_value = mock_doc

    updated = service.update_scheduled_job("9044713567", "job-1", {"status": ScheduledJobStatus.LINKED})
    
    assert updated.status == ScheduledJobStatus.LINKED
    client.collection().document().update.assert_called_once()
    called_args = client.collection().document().update.call_args[0][0]
    assert called_args["status"] == ScheduledJobStatus.LINKED


def test_get_pending_start_jobs_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    now = datetime.now(timezone.utc)
    mock_doc = MagicMock()
    mock_doc.to_dict.return_value = {
        "job_id": "job-1",
        "customer_id": "9044713567",
        "asset_group_ids": ["ag1"],
        "asset_name": "start.png",
        "image_gcs_uri": "gs://bucket/assets/start.png",
        "start_date": "2026-07-20",
        "end_date": "2026-07-30",
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }
    
    mock_query = MagicMock()
    client.collection.return_value.where.return_value = mock_query
    mock_query.where.return_value = mock_query
    mock_query.stream.return_value = [mock_doc]

    results = service.get_pending_start_jobs("2026-07-21")
    
    assert len(results) == 1
    assert results[0].job_id == "job-1"
    client.collection.assert_called_once_with("scheduled_jobs")
    client.collection.return_value.where.assert_called_once_with("status", "==", "PENDING")
    mock_query.where.assert_called_once_with("start_date", "<=", "2026-07-21")


def test_get_pending_end_jobs_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    now = datetime.now(timezone.utc)
    mock_doc = MagicMock()
    mock_doc.to_dict.return_value = {
        "job_id": "job-1",
        "customer_id": "9044713567",
        "asset_group_ids": ["ag1"],
        "asset_name": "start.png",
        "image_gcs_uri": "gs://bucket/assets/start.png",
        "start_date": "2026-07-20",
        "end_date": "2026-07-30",
        "status": "LINKED",
        "created_at": now,
        "updated_at": now,
    }
    
    mock_query = MagicMock()
    client.collection.return_value.where.return_value = mock_query
    mock_query.where.return_value = mock_query
    mock_query.stream.return_value = [mock_doc]

    results = service.get_pending_end_jobs("2026-07-31")
    
    assert len(results) == 1
    assert results[0].job_id == "job-1"
    client.collection.assert_called_once_with("scheduled_jobs")
    client.collection.return_value.where.assert_called_once_with("status", "==", "LINKED")
    mock_query.where.assert_called_once_with("end_date", "<", "2026-07-31")


def test_list_scheduled_jobs_success(mock_firestore: tuple[MagicMock, FirestoreService]) -> None:
    client, service = mock_firestore
    now1 = datetime.now(timezone.utc)
    mock_doc1 = MagicMock()
    mock_doc1.to_dict.return_value = {
        "job_id": "job-1",
        "customer_id": "9044713567",
        "asset_group_ids": ["ag1"],
        "asset_name": "start.png",
        "image_gcs_uri": "gs://bucket/assets/start.png",
        "start_date": "2026-07-20",
        "end_date": "2026-07-30",
        "status": "PENDING",
        "created_at": now1,
        "updated_at": now1,
    }
    
    mock_query = MagicMock()
    client.collection.return_value.where.return_value = mock_query
    mock_query.stream.return_value = [mock_doc1]

    results = service.list_scheduled_jobs("9044713567")
    
    assert len(results) == 1
    assert results[0].job_id == "job-1"
    client.collection.assert_called_once_with("scheduled_jobs")
    client.collection.return_value.where.assert_called_once_with("customer_id", "==", "9044713567")
