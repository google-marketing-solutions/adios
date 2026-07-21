from unittest.mock import MagicMock, patch
import pytest
from pathlib import Path

from src.campaign.schedule_store import ScheduleStore, ScheduledJob, ScheduledJobStatus
from src.campaign.scheduler import process_scheduled_jobs


@pytest.fixture
def temp_store(tmp_path: Path) -> ScheduleStore:
    jobs_file = tmp_path / "scheduler_jobs_test.json"
    return ScheduleStore(file_path=jobs_file)


def test_process_scheduled_jobs_dry_run(temp_store: ScheduleStore) -> None:
    with patch("src.campaign.scheduler.schedule_store", temp_store):
        job1 = ScheduledJob(
            customer_id="9044713567",
            asset_group_ids=["ag1"],
            asset_name="start_test",
            image_b64="dummy_b64",
            start_date="2026-07-20",
            end_date="2026-07-30",
            status=ScheduledJobStatus.PENDING,
        )
        job2 = ScheduledJob(
            customer_id="9044713567",
            asset_group_ids=["ag1"],
            asset_name="end_test",
            image_b64="dummy_b64",
            asset_id="123456",
            start_date="2026-07-10",
            end_date="2026-07-20",
            status=ScheduledJobStatus.LINKED,
        )
        temp_store.add_job(job1)
        temp_store.add_job(job2)

        res = process_scheduled_jobs(as_of_date="2026-07-21", dry_run=True)
        assert res["dry_run"] is True
        assert job1.job_id in res["pending_start_ids"]
        assert job2.job_id in res["pending_end_ids"]


def test_process_scheduled_jobs_start_and_end_execution(temp_store: ScheduleStore) -> None:
    with patch("src.campaign.scheduler.schedule_store", temp_store):
        job_start = ScheduledJob(
            customer_id="9044713567",
            asset_group_ids=["ag1"],
            asset_name="start_img",
            image_b64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            start_date="2026-07-20",
            end_date="2026-07-30",
            status=ScheduledJobStatus.PENDING,
        )
        job_end = ScheduledJob(
            customer_id="9044713567",
            asset_group_ids=["ag1"],
            asset_name="end_img",
            image_b64="dummy_b64",
            asset_id="555666777",
            start_date="2026-07-10",
            end_date="2026-07-20",
            status=ScheduledJobStatus.LINKED,
        )
        temp_store.add_job(job_start)
        temp_store.add_job(job_end)

        # Mock Google Ads Client
        mock_g_client = MagicMock()
        mock_asset_res = MagicMock()
        mock_asset_res.resource_name = "customers/9044713567/assets/999888777"
        mock_g_client.get_service.return_module = MagicMock()
        mock_g_client.get_service("AssetService").mutate_assets.return_value.results = [mock_asset_res]

        mock_aga_res = MagicMock()
        mock_aga_res.resource_name = "customers/9044713567/assetGroupAssets/ag1~999888777~MARKETING_IMAGE"
        mock_g_client.get_service("AssetGroupAssetService").mutate_asset_group_assets.return_value.results = [mock_aga_res]

        with patch("src.campaign.scheduler.default_auth_provider.get_google_ads_client", return_value=mock_g_client):
            res = process_scheduled_jobs(as_of_date="2026-07-21")

            assert res["started_jobs"] == 1
            assert res["unlinked_jobs"] == 1

            # Check job statuses in store
            j_start_updated = temp_store.get_job(job_start.job_id)
            assert j_start_updated is not None
            assert j_start_updated.status == ScheduledJobStatus.LINKED
            assert j_start_updated.asset_id == "999888777"

            j_end_updated = temp_store.get_job(job_end.job_id)
            assert j_end_updated is not None
            assert j_end_updated.status == ScheduledJobStatus.COMPLETED_UNLINKED
