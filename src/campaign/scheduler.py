"""
Automated Scheduling & Unlinking Engine for Adios 2.0.

Provides background processing and CLI cron tools to:
1. Upload and link visual assets to PMax asset groups on start_date.
2. Unlink (REMOVE operation) visual assets from PMax asset groups on end_date.
"""

import argparse
import base64
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from src.campaign.schedule_store import ScheduledJob, ScheduledJobStatus, schedule_store
from src.core.auth_provider import default_auth_provider

logger = logging.getLogger("adios.campaign.scheduler")


def create_asset_in_library(g_client: Any, customer_id: str, asset_name: str, image_bytes: bytes) -> str:
    """Uploads an image asset to the Google Ads Customer Asset Library."""
    asset_service = g_client.get_service("AssetService")
    asset_operation = g_client.get_type("AssetOperation")
    asset = asset_operation.create

    asset.name = f"{asset_name}_{int(datetime.now(timezone.utc).timestamp())}"
    asset.type_ = g_client.enums.AssetTypeEnum.IMAGE
    asset.image_asset.data = image_bytes

    response = asset_service.mutate_assets(
        customer_id=customer_id,
        operations=[asset_operation],
    )
    asset_resource_name = response.results[0].resource_name
    # Resource name is in format customers/{customer_id}/assets/{asset_id}
    asset_id = asset_resource_name.split("/")[-1]
    logger.info(f"Created image asset in Google Ads library: {asset_resource_name} (ID: {asset_id})")
    return asset_id


def link_asset_to_groups(
    g_client: Any, customer_id: str, asset_id: str, asset_group_ids: list[str], field_type: str = "MARKETING_IMAGE"
) -> list[str]:
    """Links an asset from the Customer Library to target Asset Groups."""
    asset_group_asset_service = g_client.get_service("AssetGroupAssetService")
    operations = []

    field_type_enum = getattr(g_client.enums.AssetFieldTypeEnum, field_type, g_client.enums.AssetFieldTypeEnum.MARKETING_IMAGE)

    for group_id in asset_group_ids:
        op = g_client.get_type("AssetGroupAssetOperation")
        aga = op.create
        aga.asset_group = asset_group_asset_service.asset_group_path(customer_id, group_id)
        aga.asset = g_client.get_service("AssetService").asset_path(customer_id, asset_id)
        aga.field_type = field_type_enum
        operations.append(op)

    response = asset_group_asset_service.mutate_asset_group_assets(
        customer_id=customer_id,
        operations=operations,
    )
    linked_resources = [r.resource_name for r in response.results]
    logger.info(f"Linked asset {asset_id} to {len(linked_resources)} asset groups for customer {customer_id}")
    return linked_resources


def unlink_asset_from_groups(
    g_client: Any, customer_id: str, asset_id: str, asset_group_ids: list[str], field_type: str = "MARKETING_IMAGE"
) -> list[str]:
    """Unlinks (REMOVE operation) an asset from target Asset Groups."""
    asset_group_asset_service = g_client.get_service("AssetGroupAssetService")
    operations = []

    for group_id in asset_group_ids:
        op = g_client.get_type("AssetGroupAssetOperation")
        # Resource name format: customers/{customer_id}/assetGroupAssets/{asset_group_id}~{asset_id}~{field_type}
        op.remove = f"customers/{customer_id}/assetGroupAssets/{group_id}~{asset_id}~{field_type}"
        operations.append(op)

    response = asset_group_asset_service.mutate_asset_group_assets(
        customer_id=customer_id,
        operations=operations,
    )
    unlinked_resources = [r.resource_name for r in response.results]
    logger.info(f"Unlinked asset {asset_id} from {len(unlinked_resources)} asset groups for customer {customer_id}")
    return unlinked_resources


def process_scheduled_jobs(
    as_of_date: str | None = None,
    user_access_token: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Evaluates and processes all pending start and expired end date jobs."""
    if not as_of_date:
        as_of_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    summary = {
        "as_of_date": as_of_date,
        "started_jobs": 0,
        "unlinked_jobs": 0,
        "failed_jobs": 0,
        "details": [],
    }

    pending_start = schedule_store.get_pending_start_jobs(as_of_date)
    pending_end = schedule_store.get_pending_end_jobs(as_of_date)

    logger.info(f"Processing schedule jobs as of {as_of_date}: {len(pending_start)} pending start, {len(pending_end)} pending end.")

    if dry_run:
        summary["dry_run"] = True
        summary["pending_start_ids"] = [j.job_id for j in pending_start]
        summary["pending_end_ids"] = [j.job_id for j in pending_end]
        return summary

    g_client = None
    try:
        g_client = default_auth_provider.get_google_ads_client(
            user_access_token=user_access_token,
            include_login_customer_id=True,
        )
    except Exception as err:
        logger.warning(f"Google Ads API client instantiation unavailable: {err}")

    # 1. Process Start Date Activations
    for job in pending_start:
        try:
            asset_id = job.asset_id
            if g_client:
                if not asset_id:
                    # Decode base64 image
                    raw_b64 = job.image_b64
                    if "," in raw_b64:
                        raw_b64 = raw_b64.split(",", 1)[1]
                    image_bytes = base64.b64decode(raw_b64)
                    asset_id = create_asset_in_library(g_client, job.customer_id, job.asset_name, image_bytes)

                link_asset_to_groups(g_client, job.customer_id, asset_id, job.asset_group_ids)

            schedule_store.update_job(job.job_id, status=ScheduledJobStatus.LINKED, asset_id=asset_id)
            summary["started_jobs"] += 1
            summary["details"].append({"job_id": job.job_id, "action": "START", "status": "SUCCESS"})
        except Exception as exc:
            logger.error(f"Failed to process start schedule for job {job.job_id}: {exc}", exc_info=True)
            schedule_store.update_job(job.job_id, status=ScheduledJobStatus.FAILED, error_message=str(exc))
            summary["failed_jobs"] += 1
            summary["details"].append({"job_id": job.job_id, "action": "START", "status": "FAILED", "error": str(exc)})

    # 2. Process End Date Expirations (Unlinking)
    for job in pending_end:
        try:
            if g_client and job.asset_id:
                unlink_asset_from_groups(g_client, job.customer_id, job.asset_id, job.asset_group_ids)

            schedule_store.update_job(job.job_id, status=ScheduledJobStatus.COMPLETED_UNLINKED)
            summary["unlinked_jobs"] += 1
            summary["details"].append({"job_id": job.job_id, "action": "UNLINK", "status": "SUCCESS"})
        except Exception as exc:
            logger.error(f"Failed to process end schedule unlinking for job {job.job_id}: {exc}", exc_info=True)
            schedule_store.update_job(job.job_id, status=ScheduledJobStatus.FAILED, error_message=str(exc))
            summary["failed_jobs"] += 1
            summary["details"].append({"job_id": job.job_id, "action": "UNLINK", "status": "FAILED", "error": str(exc)})

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Adios 2.0 Cron Scheduler for Asset Lifecycles")
    parser.add_argument("--date", type=str, help="Override as-of date (YYYY-MM-DD)", default=None)
    parser.add_argument("--dry-run", action="store_true", help="Simulate schedule execution without API mutations")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    result = process_scheduled_jobs(as_of_date=args.date, dry_run=args.dry_run)
    print(f"Schedule processing complete: {result}")


if __name__ == "__main__":
    main()
