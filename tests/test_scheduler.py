from unittest.mock import MagicMock, patch
import pytest
from src.core.firestore_service import ScheduledJobDocument, ScheduledJobStatus
from src.campaign.scheduler import process_scheduled_jobs


def test_process_scheduled_jobs_dry_run() -> None:
    job1 = ScheduledJobDocument(
        job_id="job1",
        customer_id="9044713567",
        asset_group_ids=["ag1"],
        asset_name="start_test",
        image_gcs_uri="gs://bucket/assets/start_test.png",
        start_date="2026-07-20",
        end_date="2026-07-30",
        status=ScheduledJobStatus.PENDING,
    )
    job2 = ScheduledJobDocument(
        job_id="job2",
        customer_id="9044713567",
        asset_group_ids=["ag1"],
        asset_name="end_test",
        image_gcs_uri="gs://bucket/assets/end_test.png",
        asset_id="123456",
        start_date="2026-07-10",
        end_date="2026-07-20",
        status=ScheduledJobStatus.LINKED,
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_start_jobs.return_value = [job1]
    mock_firestore.get_pending_end_jobs.return_value = [job2]

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore):
        res = process_scheduled_jobs(as_of_date="2026-07-21", dry_run=True)
        assert res["dry_run"] is True
        assert "job1" in res["pending_start_ids"]
        assert "job2" in res["pending_end_ids"]


def test_process_scheduled_jobs_start_and_end_execution() -> None:
    job_start = ScheduledJobDocument(
        job_id="job_start",
        customer_id="9044713567",
        asset_group_ids=["ag1"],
        asset_name="start_img.png",
        image_gcs_uri="gs://bucket/assets/start_img.png",
        start_date="2026-07-20",
        end_date="2026-07-30",
        status=ScheduledJobStatus.PENDING,
    )
    job_end = ScheduledJobDocument(
        job_id="job_end",
        customer_id="9044713567",
        asset_group_ids=["ag1"],
        asset_name="end_img.png",
        image_gcs_uri="gs://bucket/assets/end_img.png",
        asset_id="555666777",
        start_date="2026-07-10",
        end_date="2026-07-20",
        status=ScheduledJobStatus.LINKED,
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_start_jobs.return_value = [job_start]
    mock_firestore.get_pending_end_jobs.return_value = [job_end]

    mock_gcs = MagicMock()
    mock_gcs.download_image.return_value = b"dummy_image_bytes"

    # Mock Google Ads Client
    mock_g_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.resource_name = "customers/9044713567/assets/999888777"
    mock_g_client.get_service.return_module = MagicMock()
    mock_g_client.get_service("AssetService").mutate_assets.return_value.results = [mock_asset_res]

    mock_aga_res = MagicMock()
    mock_aga_res.resource_name = "customers/9044713567/assetGroupAssets/ag1~999888777~MARKETING_IMAGE"
    mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.return_value.results = [mock_aga_res]

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore), \
         patch("src.campaign.scheduler.default_gcs_service", mock_gcs), \
         patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", return_value=mock_g_client):

        res = process_scheduled_jobs(as_of_date="2026-07-21")

        assert res["started_jobs"] == 1
        assert res["unlinked_jobs"] == 1

        # Verify GCS download was called
        mock_gcs.download_image.assert_called_once_with("gs://bucket/assets/start_img.png")

        # Verify AssetDocument and LinkOperationDocuments were saved
        mock_firestore.save_asset.assert_called_once()
        assert mock_firestore.save_link_operation.call_count == 2  # 1 for LINK, 1 for UNLINK

        # Verify job updates
        mock_firestore.update_scheduled_job.assert_any_call(
            "9044713567", "job_start", {
                "status": ScheduledJobStatus.LINKED, 
                "asset_id": "999888777",
                "asset_group_ids": ["ag1"]
            }
        )
        mock_firestore.update_scheduled_job.assert_any_call(
            "9044713567", "job_end", {"status": ScheduledJobStatus.COMPLETED_UNLINKED}
        )


def test_process_scheduled_jobs_already_linked_success() -> None:
    job_start = ScheduledJobDocument(
        job_id="job_already_linked",
        customer_id="9044713567",
        asset_group_ids=["ag1"],
        asset_name="start_img.png",
        image_gcs_uri="gs://bucket/assets/start_img.png",
        start_date="2026-07-20",
        end_date="2026-07-30",
        status=ScheduledJobStatus.PENDING,
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_start_jobs.return_value = [job_start]
    mock_firestore.get_pending_end_jobs.return_value = []

    mock_gcs = MagicMock()
    mock_gcs.download_image.return_value = b"dummy_image_bytes"

    mock_g_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.resource_name = "customers/9044713567/assets/999888777"
    mock_g_client.get_service("AssetService").mutate_assets.return_value.results = [mock_asset_res]

    # Mock search returning ALREADY LINKED
    row = MagicMock()
    row.asset_group_asset.asset = "customers/9044713567/assets/999888777"
    row.asset_group_asset.field_type.name = "MARKETING_IMAGE"
    mock_g_client.get_service.return_value.search.return_value = [row]

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore), \
         patch("src.campaign.scheduler.default_gcs_service", mock_gcs), \
         patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", return_value=mock_g_client):

        res = process_scheduled_jobs(as_of_date="2026-07-21")

        assert res["started_jobs"] == 1
        assert res["failed_jobs"] == 0
        
        # Verify it saves a SUCCESS LinkOperationDocument with the already linked error message
        mock_firestore.save_link_operation.assert_called_once()
        saved_op = mock_firestore.save_link_operation.call_args[0][0]
        assert saved_op.status == "SUCCESS"
        assert "already linked" in saved_op.error_message

        # Verify job transitions to LINKED so it unlinks later!
        mock_firestore.update_scheduled_job.assert_any_call(
            "9044713567", "job_already_linked", {
                "status": ScheduledJobStatus.LINKED, 
                "asset_id": "999888777",
                "asset_group_ids": ["ag1"]
            }
        )


def test_process_scheduled_jobs_partial_failure_prunes_groups() -> None:
    job_start = ScheduledJobDocument(
        job_id="job_partial",
        customer_id="9044713567",
        asset_group_ids=["ag_success", "ag_fail"],
        asset_name="start_img.png",
        image_gcs_uri="gs://bucket/assets/start_img.png",
        start_date="2026-07-20",
        end_date="2026-07-30",
        status=ScheduledJobStatus.PENDING,
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_start_jobs.return_value = [job_start]
    mock_firestore.get_pending_end_jobs.return_value = []

    mock_gcs = MagicMock()
    mock_gcs.download_image.return_value = b"dummy_image_bytes"

    mock_g_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.resource_name = "customers/9044713567/assets/999888777"
    mock_g_client.get_service("AssetService").mutate_assets.return_value.results = [mock_asset_res]

    # No existing links
    mock_g_client.get_service.return_value.search.return_value = []

    mock_aga_res = MagicMock()
    mock_aga_res.results = [
        MagicMock(resource_name="customers/9044713567/assetGroupAssets/ag_success~999888777"),
        MagicMock(resource_name=""), # Failure
    ]
    
    status_proto = MagicMock()
    error_detail = MagicMock()
    error_detail.message = "Resource limit exceeded"
    fpe = MagicMock()
    fpe.field_name = "operations"
    fpe.index = 1
    error_detail.location.field_path_elements = [fpe]
    
    def mock_unpack(msg_dest):
        msg_dest.errors = [error_detail]
    
    detail_proto = MagicMock()
    detail_proto.Unpack.side_effect = mock_unpack
    status_proto.details = [detail_proto]
    mock_aga_res.partial_failure_error = status_proto
    
    mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.return_value = mock_aga_res
    mock_g_client.get_type.return_value = MagicMock(_pb=MagicMock())

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore), \
         patch("src.campaign.scheduler.default_gcs_service", mock_gcs), \
         patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", return_value=mock_g_client):

        res = process_scheduled_jobs(as_of_date="2026-07-21")

        assert res["started_jobs"] == 1
        assert res["failed_jobs"] == 0
        
        # Verify saved one SUCCESS and one FAILED Link Operation
        assert mock_firestore.save_link_operation.call_count == 2
        calls = mock_firestore.save_link_operation.call_args_list
        ops = [c[0][0] for c in calls]
        
        success_op = next(o for o in ops if o.asset_group_id == "ag_success")
        fail_op = next(o for o in ops if o.asset_group_id == "ag_fail")
        
        assert success_op.status == "SUCCESS"
        assert fail_op.status == "FAILED"
        assert "Resource limit exceeded" in fail_op.error_message

        # Verify job transitions to LINKED BUT PRUNES asset_group_ids to ONLY "ag_success"!!!
        mock_firestore.update_scheduled_job.assert_any_call(
            "9044713567", "job_partial", {
                "status": ScheduledJobStatus.LINKED, 
                "asset_id": "999888777",
                "asset_group_ids": ["ag_success"]
            }
        )


def test_process_scheduled_jobs_eviction_atomic_mutation_and_surfaces_error_code() -> None:
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

    job_evict = ScheduledJobDocument(
        job_id="job_evict",
        customer_id="9044713567",
        asset_group_ids=["ag_full"],
        asset_name="start_img.png",
        image_gcs_uri="gs://bucket/assets/start_img.png",
        start_date="2026-07-20",
        end_date="2026-07-30",
        status=ScheduledJobStatus.PENDING,
        swap_rules={"lookback_window": "30d", "eviction_kpi": "clicks"}
    )

    mock_firestore = MagicMock()
    mock_firestore.get_pending_start_jobs.return_value = [job_evict]
    mock_firestore.get_pending_end_jobs.return_value = []

    mock_gcs = MagicMock()
    mock_gcs.download_image.return_value = b"dummy_image_bytes"

    mock_g_client = MagicMock()
    mock_asset_res = MagicMock()
    mock_asset_res.resource_name = "customers/9044713567/assets/999888777"
    mock_g_client.get_service("AssetService").mutate_assets.return_value.results = [mock_asset_res]

    def create_mock_row(idx: str):
        row = MagicMock()
        row.asset_group_asset.asset = f"customers/9044713567/assets/{idx}"
        row.asset.image_asset.full_size.url = f"https://example.com/{idx}.png"
        row.asset.name = f"Image {idx}"
        row.asset_group_asset.field_type.name = "MARKETING_IMAGE"
        row.metrics.impressions = 1000
        row.metrics.clicks = 10
        row.metrics.cost_micros = 0
        return row

    mock_g_client.get_service.return_value.search.side_effect = [
        [create_mock_row(str(i)) for i in range(20)],
        [create_mock_row(str(i)) for i in range(20)],
    ]

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

    mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.side_effect = mock_mutate
    
    def mock_get_type(name: str):
        if hasattr(services_module, name):
            return getattr(services_module, name)()
        return MagicMock()
    mock_g_client.get_type.side_effect = mock_get_type

    mock_g_client.enums.AssetFieldTypeEnum = MagicMock()
    setattr(mock_g_client.enums.AssetFieldTypeEnum, "MARKETING_IMAGE", 1)

    with patch("src.campaign.scheduler.default_firestore_service", mock_firestore), \
         patch("src.campaign.kpi_eviction_service.default_firestore_service", mock_firestore), \
         patch("src.campaign.scheduler.default_gcs_service", mock_gcs), \
         patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", return_value=mock_g_client):

        res = process_scheduled_jobs(as_of_date="2026-07-21")
        
        assert len(captured_requests) == 1
        assert captured_requests[0].partial_failure is False
        assert len(captured_requests[0].operations) == 2
        
        assert mock_firestore.save_link_operation.call_count == 1
        saved_op = mock_firestore.save_link_operation.call_args[0][0]
        assert saved_op.status == "FAILED"
        assert "RESOURCE_LIMIT" in saved_op.error_message
