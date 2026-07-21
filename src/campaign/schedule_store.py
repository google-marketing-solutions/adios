"""
Scheduled Job Store for Adios 2.0.

Provides thread-safe JSON file storage for scheduled image uploads
and asset group unlinking tasks.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from uuid import uuid4
from pydantic import BaseModel, Field

logger = logging.getLogger("adios.campaign.schedule_store")

DATA_DIR = Path("local")
JOBS_FILE = DATA_DIR / "scheduled_jobs.json"
_file_lock = threading.Lock()


class ScheduledJobStatus(str, Enum):
    PENDING = "PENDING"
    LINKED = "LINKED"
    COMPLETED_UNLINKED = "COMPLETED_UNLINKED"
    FAILED = "FAILED"


class ScheduledJob(BaseModel):
    job_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique identifier for the scheduled job")
    customer_id: str = Field(..., description="Google Ads Customer Account ID")
    asset_group_ids: list[str] = Field(default_factory=list, description="Target PMax Asset Group IDs")
    asset_name: str = Field(..., description="Name of the image asset")
    image_b64: str = Field(..., description="Base64 encoded image content or data URI")
    asset_id: str | None = Field(default=None, description="Google Ads Asset Resource ID once created in library")
    start_date: str = Field(..., description="ISO Start Date (YYYY-MM-DD)")
    end_date: str = Field(..., description="ISO End Date (YYYY-MM-DD)")
    status: ScheduledJobStatus = Field(default=ScheduledJobStatus.PENDING, description="Current job lifecycle status")
    error_message: str | None = Field(default=None, description="Last error description if failed")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ScheduleStore:
    def __init__(self, file_path: Path = JOBS_FILE) -> None:
        self.file_path = file_path
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        if not self.file_path.parent.exists():
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.file_path.exists():
            with _file_lock:
                with open(self.file_path, "w", encoding="utf-8") as f:
                    json.dump([], f)

    def load_jobs(self) -> list[ScheduledJob]:
        with _file_lock:
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return [ScheduledJob.model_validate(item) for item in data]
            except Exception as err:
                logger.error(f"Error loading scheduled jobs from {self.file_path}: {err}")
                return []

    def _save_raw_jobs(self, jobs: list[ScheduledJob]) -> None:
        with _file_lock:
            data = [job.model_dump() for job in jobs]
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

    def add_job(self, job: ScheduledJob) -> ScheduledJob:
        jobs = self.load_jobs()
        jobs.append(job)
        self._save_raw_jobs(jobs)
        logger.info(f"Added scheduled job {job.job_id} for asset '{job.asset_name}' (start: {job.start_date}, end: {job.end_date})")
        return job

    def get_job(self, job_id: str) -> ScheduledJob | None:
        jobs = self.load_jobs()
        for job in jobs:
            if job.job_id == job_id:
                return job
        return None

    def get_pending_start_jobs(self, as_of_date: str) -> list[ScheduledJob]:
        """Returns PENDING jobs whose start_date is on or before as_of_date."""
        jobs = self.load_jobs()
        results: list[ScheduledJob] = []
        for job in jobs:
            if job.status == ScheduledJobStatus.PENDING and job.start_date:
                if job.start_date <= as_of_date:
                    results.append(job)
        return results

    def get_pending_end_jobs(self, as_of_date: str) -> list[ScheduledJob]:
        """Returns LINKED jobs whose end_date is before or equal to as_of_date."""
        jobs = self.load_jobs()
        results: list[ScheduledJob] = []
        for job in jobs:
            if job.status == ScheduledJobStatus.LINKED and job.end_date:
                if job.end_date < as_of_date:
                    results.append(job)
        return results

    def update_job(self, job_id: str, status: ScheduledJobStatus, asset_id: str | None = None, error_message: str | None = None) -> ScheduledJob | None:
        jobs = self.load_jobs()
        target: ScheduledJob | None = None
        for job in jobs:
            if job.job_id == job_id:
                job.status = status
                job.updated_at = datetime.now(timezone.utc).isoformat()
                if asset_id is not None:
                    job.asset_id = asset_id
                if error_message is not None:
                    job.error_message = error_message
                target = job
                break

        if target:
            self._save_raw_jobs(jobs)
            logger.info(f"Updated scheduled job {job_id} status to {status}")
        return target


# Singleton instance
schedule_store = ScheduleStore()
