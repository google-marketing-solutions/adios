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

import uuid
from src.core.firestore_service import (
    default_firestore_service,
    AssetDocument,
    LinkOperationDocument,
    OperationType,
    OperationStatus,
    ScheduledJobDocument,
    ScheduledJobStatus,
)
from src.core.gcs_service import default_gcs_service
from src.core.auth_provider import default_auth_provider
from src.campaign.kpi_eviction_service import KPIEvictionService, SwapRules

logger = logging.getLogger("adios.campaign.scheduler")


def _clean_asset_group_error_message(err_str: str) -> str:
    """Formats raw Google Ads API validation errors into human-friendly explanations."""
    if any(k in err_str for k in ["LIMIT_EXCEEDED", "MAX_ASSETS", "20 images", "TOO_MANY_ASSETS", "RESOURCE_EXHAUSTED", "ASSET_GROUP_ASSET_LIMIT"]):
        return "Reached maximum limit of 20 images for this Asset Group."
    if any(k in err_str for k in ["not enough", "NOT_ENOUGH", "Headline asset", "Description headline"]):
        return (
            "The selected Asset Group does not meet Google Ads minimum asset composition requirements. "
            "Google Ads requires at least 3 Headlines, 1 Long Headline, 1 Description, and 1 Square Image "
            "in the Asset Group before new image assets can be linked."
        )
    return err_str


def _extract_partial_failure_details(g_client: Any, status_err: Any) -> dict[int, str]:
    """Extracts human-readable error messages mapped by operation index from google.rpc.Status."""
    op_errors: dict[int, str] = {}
    if not status_err:
        return op_errors

    for detail in getattr(status_err, "details", []):
        try:
            failure = g_client.get_type("GoogleAdsFailure")
            failure_pb = failure._pb if hasattr(failure, "_pb") else failure
            detail.Unpack(failure_pb)
            for err in failure_pb.errors:
                op_idx = None
                if hasattr(err, "location") and err.location.field_path_elements:
                    first_element = err.location.field_path_elements[0]
                    if getattr(first_element, "field_name", "") == "operations" and hasattr(first_element, "index"):
                        op_idx = first_element.index
                
                if op_idx is not None and err.message:
                    error_code_str = ""
                    if hasattr(err, "error_code"):
                        from unittest.mock import MagicMock
                        if not isinstance(err.error_code, MagicMock):
                            err_code_pb = err.error_code._pb if hasattr(err.error_code, "_pb") else err.error_code
                            if hasattr(err_code_pb, "WhichOneof"):
                                oneof_type = err_code_pb.WhichOneof("error_code")
                                if isinstance(oneof_type, str):
                                    enum_val = getattr(err.error_code, oneof_type)
                                    if hasattr(enum_val, "name"):
                                        error_code_str = f" [{enum_val.name}]"
                                    else:
                                        error_code_str = f" [{enum_val}]"
                    
                    op_errors[op_idx] = _clean_asset_group_error_message(err.message) + error_code_str
        except Exception:
            pass
    return op_errors


def _format_google_ads_error(err: Exception) -> str:
    """Extracts human-readable error messages from Google Ads API exception structures."""
    if hasattr(err, "failure") and getattr(err, "failure", None):
        try:
            msg_parts = []
            for e in err.failure.errors:
                msg = getattr(e, "message", None)
                if msg:
                    err_code_str = ""
                    if hasattr(e, "error_code"):
                        from unittest.mock import MagicMock
                        if not isinstance(e.error_code, MagicMock):
                            e_code_pb = e.error_code._pb if hasattr(e.error_code, "_pb") else e.error_code
                            if hasattr(e_code_pb, "WhichOneof"):
                                oneof_type = e_code_pb.WhichOneof("error_code")
                                if isinstance(oneof_type, str):
                                    enum_val = getattr(e.error_code, oneof_type)
                                    if hasattr(enum_val, "name"):
                                        err_code_str = f" [{enum_val.name}]"
                                    else:
                                        err_code_str = f" [{enum_val}]"
                    msg_parts.append(f"{msg}{err_code_str}")
            
            if msg_parts:
                return _clean_asset_group_error_message(" | ".join(msg_parts))
        except Exception:
            pass
    return _clean_asset_group_error_message(str(err))


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
    g_client: Any, 
    customer_id: str, 
    asset_id: str, 
    asset_group_ids: list[str], 
    field_type: str = "MARKETING_IMAGE",
    swap_rules_dict: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Links an asset to target Asset Groups enforcing KPI eviction if capacity reached."""
    asset_group_asset_service = g_client.get_service("AssetGroupAssetService")
    
    rules = SwapRules(**swap_rules_dict) if swap_rules_dict else None
    new_asset_resource_name = f"customers/{customer_id}/assets/{asset_id}"
    
    batch_add_request = g_client.get_type("MutateAssetGroupAssetsRequest")
    batch_add_request.customer_id = customer_id
    batch_add_request.partial_failure = True
    
    atomic_requests = []
    batch_add_metadata = []
    results = []
    
    for ag_id in asset_group_ids:
        eviction_res = KPIEvictionService.get_operations_for_group(
            g_client=g_client,
            clean_customer_id=customer_id,
            asset_group_id=ag_id,
            field_type=field_type,
            new_asset_resource_name=new_asset_resource_name,
            rules=rules
        )
        
        if eviction_res["status"] == "FAILED":
            results.append({
                "asset_group_id": ag_id,
                "status": "FAILED",
                "asset_group_asset_resource_name": "",
                "evicted_asset": None,
                "error_message": eviction_res["error_message"]
            })
            continue

        ops = eviction_res["operations"]
        if not ops and eviction_res["status"] == "SUCCESS":
            # Already linked! Count as Success in scheduler so job becomes LINKED and unlinks later!
            results.append({
                "asset_group_id": ag_id,
                "status": "SUCCESS",
                "asset_group_asset_resource_name": f"customers/{customer_id}/assetGroupAssets/{ag_id}~{asset_id}~{field_type}",
                "evicted_asset": None,
                "error_message": "Asset is already linked to this Asset Group."
            })
            continue

        evicted = eviction_res["evicted_asset"]
        op_types = [op_item["type"] for op_item in ops]
        
        if "remove" in op_types and "add" in op_types:
            # Atomic eviction: REMOVE and ADD for the same entity. 
            # Must use a separate request with partial_failure=False to ensure atomicity
            # and avoid Request-Wide limit check exceptions in Google Ads API.
            req = g_client.get_type("MutateAssetGroupAssetsRequest")
            req.customer_id = customer_id
            req.partial_failure = False
            for op_item in ops:
                req.operations.append(op_item["proto"])
            atomic_requests.append((ag_id, req, evicted, op_types))
        else:
            # Pure ADD operation(s). Add to the shared batch partial_failure request.
            for op_item in ops:
                batch_add_request.operations.append(op_item["proto"])
            batch_add_metadata.append({
                "ag_id": ag_id,
                "op_types": op_types,
                "evicted_asset": evicted
            })

    # Execute Atomic requests sequentially
    for ag_id, req, evicted, op_types in atomic_requests:
        try:
            res = asset_group_asset_service.mutate_asset_group_assets(request=req)
            add_rn = ""
            for op_type, r in zip(op_types, res.results):
                if op_type == "add" and getattr(r, "resource_name", ""):
                    add_rn = r.resource_name
            if add_rn:
                results.append({
                    "asset_group_id": ag_id,
                    "status": "SUCCESS",
                    "asset_group_asset_resource_name": add_rn,
                    "evicted_asset": evicted,
                    "error_message": None
                })
            else:
                results.append({
                    "asset_group_id": ag_id,
                    "status": "FAILED",
                    "asset_group_asset_resource_name": "",
                    "error_message": "Atomic mutation failed: Resource name not returned for ADD operation.",
                    "evicted_asset": evicted
                })
        except Exception as exc:
            formatted_err = _format_google_ads_error(exc)
            results.append({
                "asset_group_id": ag_id,
                "status": "FAILED",
                "asset_group_asset_resource_name": "",
                "error_message": formatted_err,
                "evicted_asset": evicted
            })

    # Execute Batch Add request
    if batch_add_request.operations:
        try:
            aga_response = asset_group_asset_service.mutate_asset_group_assets(request=batch_add_request)
            pf_err = getattr(aga_response, "partial_failure_error", None)
            op_errors = _extract_partial_failure_details(g_client, pf_err)
            
            res_idx = 0
            for meta in batch_add_metadata:
                ag_id = meta["ag_id"]
                evicted = meta["evicted_asset"]
                
                group_success = True
                add_rn = ""
                group_errors = []
                
                for op_type in meta["op_types"]:
                    if res_idx in op_errors:
                        group_errors.append(op_errors[res_idx])
                        group_success = False

                    if res_idx < len(aga_response.results):
                        r = aga_response.results[res_idx]
                        res_idx += 1
                        res_rn = getattr(r, "resource_name", "")
                        if op_type == "add":
                            if res_rn:
                                add_rn = res_rn
                            else:
                                group_success = False
                
                if group_success and add_rn:
                    results.append({
                        "asset_group_id": ag_id,
                        "status": "SUCCESS",
                        "asset_group_asset_resource_name": add_rn,
                        "evicted_asset": evicted,
                        "error_message": None
                    })
                else:
                    err_str = " | ".join(group_errors) if group_errors else "Google Ads mutation failed"
                    results.append({
                        "asset_group_id": ag_id,
                        "status": "FAILED",
                        "asset_group_asset_resource_name": "",
                        "evicted_asset": evicted,
                        "error_message": err_str
                    })
        except Exception as exc:
            formatted_err = _format_google_ads_error(exc)
            for meta in batch_add_metadata:
                results.append({
                    "asset_group_id": meta["ag_id"],
                    "status": "FAILED",
                    "asset_group_asset_resource_name": "",
                    "evicted_asset": meta["evicted_asset"],
                    "error_message": formatted_err
                })

    return {
        "results": results,
        "partial_failure_error": None # Partial failures already mapped to results
    }


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

    pending_start = default_firestore_service.get_pending_start_jobs(as_of_date)
    pending_end = default_firestore_service.get_pending_end_jobs(as_of_date)

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
                    # Download image from GCS
                    logger.info(f"Downloading image from GCS for job {job.job_id}: {job.image_gcs_uri}")
                    image_bytes = default_gcs_service.download_image(job.image_gcs_uri)
                    asset_id = create_asset_in_library(g_client, job.customer_id, job.asset_name, image_bytes)
                    
                    # Save Asset Document to Firestore
                    asset_doc = AssetDocument(
                        google_ads_asset_id=asset_id,
                        customer_id=job.customer_id,
                        gcs_uri=job.image_gcs_uri,
                        asset_name=job.asset_name,
                        asset_group_ids=job.asset_group_ids,
                    )
                    default_firestore_service.save_asset(asset_doc)
                    logger.info(f"Saved AssetDocument to Firestore for {asset_id}")

                # Link Asset to Groups
                try:
                    swap_rules = getattr(job, "swap_rules", None)
                    link_res = link_asset_to_groups(
                        g_client, 
                        job.customer_id, 
                        asset_id, 
                        job.asset_group_ids, 
                        field_type=job.field_type,
                        swap_rules_dict=swap_rules
                    )
                    
                    results = link_res["results"]
                    success_count = 0
                    err_msgs = []
                    
                    for res_item in results:
                        ag_id = res_item["asset_group_id"]
                        if res_item["status"] == "SUCCESS":
                            success_count += 1
                            add_rn = res_item["asset_group_asset_resource_name"]
                            
                            op_link = LinkOperationDocument(
                                operation_id=str(uuid.uuid4()),
                                operation_type=OperationType.LINK,
                                customer_id=job.customer_id,
                                asset_group_id=ag_id,
                                google_ads_asset_id=asset_id,
                                google_ads_asset_group_asset_id=add_rn.split("/")[-1],
                                status=OperationStatus.SUCCESS,
                                error_message=res_item.get("error_message"),
                            )
                            default_firestore_service.save_link_operation(op_link)
                            
                            if res_item.get("evicted_asset"):
                                op_un = LinkOperationDocument(
                                    operation_id=str(uuid.uuid4()),
                                    operation_type=OperationType.UNLINK,
                                    customer_id=job.customer_id,
                                    asset_group_id=ag_id,
                                    google_ads_asset_id=res_item["evicted_asset"].asset_id,
                                    status=OperationStatus.SUCCESS,
                                )
                                default_firestore_service.save_link_operation(op_un)
                        else:
                            err_msg = res_item["error_message"] or "Failed to link"
                            err_msgs.append(f"Group {ag_id}: {err_msg}")
                            op_fail = LinkOperationDocument(
                                operation_id=str(uuid.uuid4()),
                                operation_type=OperationType.LINK,
                                customer_id=job.customer_id,
                                asset_group_id=ag_id,
                                google_ads_asset_id=asset_id,
                                status=OperationStatus.FAILED,
                                error_message=err_msg,
                            )
                            default_firestore_service.save_link_operation(op_fail)

                    if success_count == 0:
                        raise Exception(" | ".join(err_msgs) if err_msgs else "All asset groups failed to link.")

                    successful_groups = [r["asset_group_id"] for r in results if r["status"] == "SUCCESS"]
                    job.asset_group_ids = successful_groups

                except Exception as api_exc:
                    if "results" not in locals():
                        for ag_id in job.asset_group_ids:
                            op_link = LinkOperationDocument(
                                operation_id=str(uuid.uuid4()),
                                operation_type=OperationType.LINK,
                                customer_id=job.customer_id,
                                asset_group_id=ag_id,
                                google_ads_asset_id=asset_id,
                                status=OperationStatus.FAILED,
                                error_message=str(api_exc),
                            )
                            default_firestore_service.save_link_operation(op_link)
                    raise api_exc

            default_firestore_service.update_scheduled_job(
                job.customer_id, 
                job.job_id, 
                {
                    "status": ScheduledJobStatus.LINKED, 
                    "asset_id": asset_id,
                    "asset_group_ids": job.asset_group_ids
                }
            )
            summary["started_jobs"] += 1
            summary["details"].append({"job_id": job.job_id, "action": "START", "status": "SUCCESS"})
        except Exception as exc:
            logger.error(f"Failed to process start schedule for job {job.job_id}: {exc}", exc_info=True)
            default_firestore_service.update_scheduled_job(job.customer_id, job.job_id, {"status": ScheduledJobStatus.FAILED, "error_message": str(exc)})
            summary["failed_jobs"] += 1
            summary["details"].append({"job_id": job.job_id, "action": "START", "status": "FAILED", "error": str(exc)})

    # 2. Process End Date Expirations (Unlinking)
    for job in pending_end:
        try:
            if g_client and job.asset_id:
                try:
                    unlinked_resources = unlink_asset_from_groups(g_client, job.customer_id, job.asset_id, job.asset_group_ids, field_type=job.field_type)
                    
                    # Save UNLINK Operations as SUCCESS
                    for ag_id in job.asset_group_ids:
                        op_id = str(uuid.uuid4())
                        op = LinkOperationDocument(
                            operation_id=op_id,
                            operation_type=OperationType.UNLINK,
                            customer_id=job.customer_id,
                            asset_group_id=ag_id,
                            google_ads_asset_id=job.asset_id,
                            status=OperationStatus.SUCCESS,
                        )
                        default_firestore_service.save_link_operation(op)
                except Exception as api_exc:
                    # Save UNLINK Operations as FAILED
                    for ag_id in job.asset_group_ids:
                        op_id = str(uuid.uuid4())
                        op = LinkOperationDocument(
                            operation_id=op_id,
                            operation_type=OperationType.UNLINK,
                            customer_id=job.customer_id,
                            asset_group_id=ag_id,
                            google_ads_asset_id=job.asset_id,
                            status=OperationStatus.FAILED,
                            error_message=str(api_exc),
                        )
                        default_firestore_service.save_link_operation(op)
                    raise api_exc

            default_firestore_service.update_scheduled_job(job.customer_id, job.job_id, {"status": ScheduledJobStatus.COMPLETED_UNLINKED})
            summary["unlinked_jobs"] += 1
            summary["details"].append({"job_id": job.job_id, "action": "UNLINK", "status": "SUCCESS"})
        except Exception as exc:
            logger.error(f"Failed to process end schedule unlinking for job {job.job_id}: {exc}", exc_info=True)
            default_firestore_service.update_scheduled_job(job.customer_id, job.job_id, {"status": ScheduledJobStatus.FAILED, "error_message": str(exc)})
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
