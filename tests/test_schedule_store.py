import pytest
from pathlib import Path
from src.campaign.schedule_store import ScheduleStore, ScheduledJob, ScheduledJobStatus


@pytest.fixture
def temp_store(tmp_path: Path) -> ScheduleStore:
    jobs_file = tmp_path / "scheduled_jobs_test.json"
    return ScheduleStore(file_path=jobs_file)


def test_schedule_store_add_and_get(temp_store: ScheduleStore) -> None:
    job = ScheduledJob(
        customer_id="1234567890",
        asset_group_ids=["ag1", "ag2"],
        asset_name="promo_banner",
        image_b64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        start_date="2026-07-21",
        end_date="2026-07-28",
    )

    created = temp_store.add_job(job)
    assert created.job_id == job.job_id
    assert created.status == ScheduledJobStatus.PENDING

    retrieved = temp_store.get_job(job.job_id)
    assert retrieved is not None
    assert retrieved.asset_name == "promo_banner"
    assert retrieved.asset_group_ids == ["ag1", "ag2"]


def test_schedule_store_get_pending_start_jobs(temp_store: ScheduleStore) -> None:
    job_past = ScheduledJob(
        customer_id="123",
        asset_name="past_job",
        image_b64="dummy",
        start_date="2026-07-20",
        end_date="2026-07-25",
        status=ScheduledJobStatus.PENDING,
    )
    job_future = ScheduledJob(
        customer_id="123",
        asset_name="future_job",
        image_b64="dummy",
        start_date="2026-07-25",
        end_date="2026-07-30",
        status=ScheduledJobStatus.PENDING,
    )
    temp_store.add_job(job_past)
    temp_store.add_job(job_future)

    pending_today = temp_store.get_pending_start_jobs(as_of_date="2026-07-21")
    assert len(pending_today) == 1
    assert pending_today[0].asset_name == "past_job"


def test_schedule_store_get_pending_end_jobs(temp_store: ScheduleStore) -> None:
    job_active = ScheduledJob(
        customer_id="123",
        asset_name="active_job",
        image_b64="dummy",
        start_date="2026-07-15",
        end_date="2026-07-20",  # Expired
        status=ScheduledJobStatus.LINKED,
    )
    job_ongoing = ScheduledJob(
        customer_id="123",
        asset_name="ongoing_job",
        image_b64="dummy",
        start_date="2026-07-15",
        end_date="2026-07-25",  # Not expired yet
        status=ScheduledJobStatus.LINKED,
    )
    temp_store.add_job(job_active)
    temp_store.add_job(job_ongoing)

    expired = temp_store.get_pending_end_jobs(as_of_date="2026-07-21")
    assert len(expired) == 1
    assert expired[0].asset_name == "active_job"


def test_schedule_store_update_status(temp_store: ScheduleStore) -> None:
    job = ScheduledJob(
        customer_id="123",
        asset_name="test_job",
        image_b64="dummy",
        start_date="2026-07-21",
        end_date="2026-07-28",
    )
    temp_store.add_job(job)

    updated = temp_store.update_job(job.job_id, status=ScheduledJobStatus.LINKED, asset_id="987654321")
    assert updated is not None
    assert updated.status == ScheduledJobStatus.LINKED
    assert updated.asset_id == "987654321"

    # Verify persistent state
    fetched = temp_store.get_job(job.job_id)
    assert fetched is not None
    assert fetched.status == ScheduledJobStatus.LINKED
