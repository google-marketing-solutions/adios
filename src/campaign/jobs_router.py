from pydantic import BaseModel, Field
from typing import Any, List
from fastapi import APIRouter, Header, HTTPException, status
import os
import asyncio
import logging
from src.campaign.scheduler import process_scheduled_jobs

logger = logging.getLogger("adios.jobs")

router = APIRouter(prefix="/v1/campaign/jobs", tags=["Jobs"])


class SchedulerResponseDetail(BaseModel):
    job_id: str
    action: str
    status: str
    error: str | None = None


class SchedulerResponse(BaseModel):
    as_of_date: str
    started_jobs: int
    unlinked_jobs: int
    failed_jobs: int
    details: list[SchedulerResponseDetail] = Field(default_factory=list)


@router.post(
    "/run-scheduler",
    response_model=SchedulerResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger Background Scheduled Asset Lifecycle Processing",
)
async def run_scheduler(
    as_of_date: str | None = None,
    x_scheduler_secret_key: str | None = Header(None, alias="X-Scheduler-Secret-Key")
) -> SchedulerResponse:
    """
    Triggers the automated background schedule processing for PMax asset lifecycles.
    Secured by X-Scheduler-Secret-Key.
    """
    expected_secret = os.getenv("SCHEDULER_SECRET_KEY")
    if not expected_secret:
        logger.error("SCHEDULER_SECRET_KEY is not configured on the server")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SCHEDULER_SECRET_KEY is not configured on the server",
        )

    if x_scheduler_secret_key != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid scheduler secret key",
        )

    logger.info(f"Triggering background scheduler execution via API (as_of_date={as_of_date})...")
    try:
        result = await asyncio.to_thread(process_scheduled_jobs, as_of_date=as_of_date)
        return SchedulerResponse(**result)
    except Exception as exc:
        logger.error(f"Scheduler execution failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scheduler execution failed: {exc}",
        )
