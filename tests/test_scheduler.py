from unittest.mock import MagicMock, patch
import pytest
from src.core.firestore_service import ScheduledJobDocument, ScheduledJobStatus, OperationType
from src.campaign.scheduler import process_scheduled_jobs


def test_process_scheduled_jobs_dry_run() -> None:
    job = ScheduledJobDocument(
        job_id="job1",
        customer_id="9044713567",
        asset_group_ids=["ag1"],
        asset_name="end_test",
        image_gcs_uri="gs://bucket/assets/end_test.png",
        asset_id="123456",
        end_date="2026-07-20",
        status=ScheduledJobStatus.LINKED,
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_end_jobs.return_value = [job]

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore):
        res = process_scheduled_jobs(as_of_date="2026-07-21", dry_run=True)
        assert res["dry_run"] is True
        assert "job1" in res["pending_end_ids"]






def test_process_scheduled_jobs_end_date_auth_and_restore_rollback() -> None:
    job_end = ScheduledJobDocument(
        job_id="job_rollback",
        customer_id="9044713567",
        asset_group_ids=["ag_restore"],
        asset_name="scheduled.png",
        image_gcs_uri="gs://bucket/assets/scheduled.png",
        asset_id="scheduled_123",
        field_type="MARKETING_IMAGE",
        end_date="2026-07-20",
        status=ScheduledJobStatus.LINKED,
        refresh_token="restore_refresh_token_xyz",
        evicted_asset_ids={"ag_restore": "original_456"}
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_end_jobs.return_value = [job_end]

    mock_g_client = MagicMock()
    mock_aga_res_unlink = MagicMock()
    mock_aga_res_unlink.results = [MagicMock(resource_name="customers/9044713567/assetGroupAssets/ag_restore~scheduled_123~MARKETING_IMAGE")]
    
    mock_aga_res_add = MagicMock()
    mock_add_result = MagicMock(resource_name="customers/9044713567/assetGroupAssets/ag_restore~original_456~MARKETING_IMAGE")
    mock_aga_res_add.results = [mock_add_result]

    mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.side_effect = [
        mock_aga_res_unlink,
        mock_aga_res_add
    ]

    mock_g_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_g_client.enums.AssetFieldTypeEnum, "MARKETING_IMAGE", 1)

    def mock_get_type(name):
        if name == "AssetGroupAssetOperation":
            m = MagicMock()
            m.create = MagicMock()
            return m
        if name == "MutateAssetGroupAssetsRequest":
            m = MagicMock()
            m.operations = []
            return m
        return MagicMock()
    mock_g_client.get_type.side_effect = mock_get_type

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore), \
         patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", return_value=mock_g_client) as mock_get_client:

        res = process_scheduled_jobs(as_of_date="2026-07-21")

        assert res["unlinked_jobs"] == 1
        
        # Verify Auth Isolation: Called with refresh_token_override
        mock_get_client.assert_called_once_with(refresh_token_override="restore_refresh_token_xyz")

        # Verify 2 calls to mutate_asset_group_assets (1 Unlink, 1 Restore)
        calls = mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.call_args_list
        assert len(calls) == 2

        # First call is Unlink (REMOVE)
        assert hasattr(calls[0][1]["request"].operations[0], "remove")
        assert calls[0][1]["request"].partial_failure is True
        
        # Second call is Restore (ADD)
        assert hasattr(calls[1][1]["request"].operations[0], "create")
        assert calls[1][1]["request"].operations[0].create.asset == "customers/9044713567/assets/original_456"
        assert calls[1][1]["request"].partial_failure is True

        # Verify 2 LinkOperations saved (1 UNLINK SUCCESS, 1 LINK SUCCESS for Restore)
        assert mock_firestore.save_link_operation.call_count == 2
        saved_ops = [c[0][0] for c in mock_firestore.save_link_operation.call_args_list]
        unlink_op = next(o for o in saved_ops if o.operation_type == OperationType.UNLINK)
        link_op = next(o for o in saved_ops if o.operation_type == OperationType.LINK)

        assert unlink_op.status == "SUCCESS"
        assert link_op.status == "SUCCESS"
        assert link_op.google_ads_asset_id == "original_456"

        # Verify job marked as COMPLETED_UNLINKED
        mock_firestore.update_scheduled_job.assert_called_once_with(
            "9044713567", "job_rollback", {"status": ScheduledJobStatus.COMPLETED_UNLINKED}
        )


def test_process_scheduled_jobs_end_date_idempotent_retry() -> None:
    job_end = ScheduledJobDocument(
        job_id="job_retry",
        customer_id="9044713567",
        asset_group_ids=["ag_restore"],
        asset_name="scheduled.png",
        image_gcs_uri="gs://bucket/assets/scheduled.png",
        asset_id="scheduled_123",
        field_type="MARKETING_IMAGE",
        end_date="2026-07-20",
        status=ScheduledJobStatus.LINKED,
        evicted_asset_ids={"ag_restore": "original_456"}
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_end_jobs.return_value = [job_end]

    mock_g_client = MagicMock()
    
    # Simulate Unlink throwing ALREADY UNLINKED error
    class MockGoogleAdsException(Exception):
        pass
    exc = MockGoogleAdsException("Resource not found: MUTATE_ERROR_ENTITY_DOES_NOT_EXIST")
    
    mock_aga_res_add = MagicMock()
    mock_aga_res_add.results = [MagicMock(resource_name="customers/9044713567/assetGroupAssets/ag_restore~original_456~MARKETING_IMAGE")]

    mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.side_effect = [
        exc,
        mock_aga_res_add
    ]

    mock_g_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_g_client.enums.AssetFieldTypeEnum, "MARKETING_IMAGE", 1)

    def mock_get_type(name):
        if name == "AssetGroupAssetOperation":
            m = MagicMock()
            m.create = MagicMock()
            return m
        if name == "MutateAssetGroupAssetsRequest":
            m = MagicMock()
            m.operations = []
            return m
        return MagicMock()
    mock_g_client.get_type.side_effect = mock_get_type

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore), \
         patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", return_value=mock_g_client):

        res = process_scheduled_jobs(as_of_date="2026-07-21")

        assert res["unlinked_jobs"] == 1
        
        # Verify Restore STILL executes!
        calls = mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.call_args_list
        assert len(calls) == 2
        
        # Verify NO Unlink operations saved as FAILED, but 1 LinkOperation saved as SUCCESS
        mock_firestore.save_link_operation.assert_called_once()
        saved_op = mock_firestore.save_link_operation.call_args[0][0]
        assert saved_op.operation_type == OperationType.LINK
        assert saved_op.status == "SUCCESS"

        mock_firestore.update_scheduled_job.assert_called_once_with(
            "9044713567", "job_retry", {"status": ScheduledJobStatus.COMPLETED_UNLINKED}
        )


def test_process_scheduled_jobs_end_date_failure_retains_linked_status() -> None:
    job_end = ScheduledJobDocument(
        job_id="job_fail",
        customer_id="9044713567",
        asset_group_ids=["ag_fail"],
        asset_name="scheduled.png",
        image_gcs_uri="gs://bucket/assets/scheduled.py",
        asset_id="scheduled_123",
        field_type="MARKETING_IMAGE",
        end_date="2026-07-20",
        status=ScheduledJobStatus.LINKED,
        refresh_token="fail_refresh_token"
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_end_jobs.return_value = [job_end]

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore), \
         patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", side_effect=ValueError("OAuth auth failed")):

        res = process_scheduled_jobs(as_of_date="2026-07-21")

        assert res["failed_jobs"] == 1
        assert res["details"][0]["status"] == "FAILED"
        assert "OAuth auth failed" in res["details"][0]["error"]

        mock_firestore.update_scheduled_job.assert_called_once_with(
            "9044713567", "job_fail", {"error_message": "OAuth auth failed"}
        )
