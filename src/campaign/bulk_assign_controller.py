"""
Campaign Bulk Assignment Controller & Google Ads API Integration.

Provides API endpoints for:
- GET /v1/campaign/asset-groups (Queries PMax Asset Groups via GAQL)
- POST /v1/campaign/upload (Validates & processes native aspect ratio image uploads)
- POST /v1/campaign/assign (Mutates and links image assets to selected PMax Asset Groups via Google Ads API)
"""

import base64
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List
from fastapi import APIRouter, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from src.campaign.aspect_ratio_validator import (
    UnsupportedAspectRatioError,
    inspect_image_aspect_ratio,
)
from src.campaign.schedule_store import ScheduledJob, ScheduledJobStatus, schedule_store
from src.campaign.scheduler import process_scheduled_jobs
from src.core.auth_provider import default_auth_provider

logger = logging.getLogger("adios.campaign.bulk_assign_controller")

router = APIRouter(prefix="/v1/campaign", tags=["Campaign & Asset Groups"])

# In-memory storage for uploaded file session tokens in this vertical slice
_UPLOAD_CACHE: dict[str, dict] = {}


def _extract_bearer_token(authorization: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        return token if token and token != "null" and token != "undefined" else None
    return None


def _clean_asset_group_error_message(err_str: str) -> str:
    """Formats raw Google Ads API validation errors into human-friendly explanations."""
    if any(k in err_str for k in ["not enough", "NOT_ENOUGH", "Headline asset", "Description headline"]):
        return (
            "The selected Asset Group does not meet Google Ads minimum asset composition requirements. "
            "Google Ads requires at least 3 Headlines, 1 Long Headline, 1 Description, and 1 Square Image "
            "in the Asset Group before new image assets can be linked."
        )
    return err_str


def _extract_partial_failure_details(g_client: Any, status_err: Any) -> list[str]:
    """Extracts human-readable error messages from google.rpc.Status partial_failure_error."""
    messages: list[str] = []
    if not status_err:
        return messages
    if getattr(status_err, "message", None):
        messages.append(status_err.message)

    for detail in getattr(status_err, "details", []):
        try:
            failure = g_client.get_type("GoogleAdsFailure")
            failure_pb = failure._pb if hasattr(failure, "_pb") else failure
            detail.Unpack(failure_pb)
            for err in failure_pb.errors:
                if getattr(err, "message", None):
                    messages.append(err.message)
        except Exception:
            pass
    return messages


def _format_google_ads_error(err: Exception) -> str:
    """Extracts human-readable error messages from Google Ads API exception structures."""
    if hasattr(err, "failure") and getattr(err, "failure", None):
        try:
            msgs = [e.message for e in err.failure.errors if getattr(e, "message", None)]
            if msgs:
                return _clean_asset_group_error_message(" | ".join(msgs))
        except Exception:
            pass
    return _clean_asset_group_error_message(str(err))


class AssetGroupItem(BaseModel):
    """Pydantic model representing a Performance Max Asset Group."""

    id: str = Field(..., description="Asset Group ID")
    name: str = Field(..., description="Asset Group Display Name")
    campaign_id: str = Field(..., description="Parent Campaign ID")
    campaign_name: str = Field(..., description="Parent Campaign Display Name")
    status: str = Field(default="ENABLED", description="Asset Group Status")
    square_count: int = Field(default=0, description="Currently linked square images")
    square_capacity: int = Field(default=20, description="Square image slot limit")
    landscape_count: int = Field(default=0, description="Currently linked landscape images")
    landscape_capacity: int = Field(default=20, description="Landscape image slot limit")
    portrait_count: int = Field(default=0, description="Currently linked portrait images")
    portrait_capacity: int = Field(default=5, description="Portrait image slot limit")


class AssetGroupListResponse(BaseModel):
    """API Response containing list of PMax Asset Groups."""

    total_count: int
    asset_groups: List[AssetGroupItem]
    source: str = Field(default="mock", description="Data source: 'live_google_ads_api' or 'mock'")
    error_message: str | None = Field(default=None, description="Detailed error message if live GAQL query failed")


class AccountItem(BaseModel):
    """Pydantic model representing an accessible Google Ads Account."""

    id: str = Field(..., description="Google Ads Customer ID (digits only)")
    name: str = Field(..., description="Formatted display name (e.g. 'DogFood Store (904-471-3567)')")
    descriptive_name: str | None = Field(default=None, description="Account descriptive name")
    is_manager: bool = Field(default=False, description="Whether account is an MCC Manager account")


class AccountListResponse(BaseModel):
    """API Response containing list of accessible Google Ads Accounts."""

    total_count: int
    accounts: List[AccountItem]
    source: str = Field(default="mock", description="Data source: 'live_google_ads_api' or 'mock'")
    error_message: str | None = Field(default=None, description="Detailed error message if query failed")


class ImageUploadResponse(BaseModel):
    """API Response after image aspect ratio validation."""

    file_token: str
    filename: str
    width: int
    height: int
    ratio_type: str
    field_type: str
    aspect_ratio: float


class AssignRequest(BaseModel):
    """API Request payload to assign an uploaded image to target Asset Groups."""

    file_token: str = Field(..., description="Upload session token returned by /upload")
    asset_group_ids: List[str] = Field(..., description="List of target Asset Group IDs")
    customer_id: str = Field(default="9941182026", description="Google Ads Customer ID (without hyphens)")
    start_date: str | None = Field(default=None, description="Optional ISO start date (YYYY-MM-DD)")
    end_date: str | None = Field(default=None, description="Optional ISO end date (YYYY-MM-DD)")


class AssignmentResult(BaseModel):
    """Result of asset assignment for an individual Asset Group."""

    asset_group_id: str
    status: str
    asset_resource_name: str
    asset_group_asset_resource_name: str


class AssignResponse(BaseModel):
    """API Response after dispatching batch assignment mutations to Google Ads API."""

    file_token: str
    field_type: str
    total_assigned: int
    results: List[AssignmentResult]


@router.get(
    "/accounts",
    response_model=AccountListResponse,
    status_code=status.HTTP_200_OK,
    summary="List accessible Google Ads Customer Accounts for the logged-in user",
)
async def get_accessible_accounts(
    authorization: str | None = Header(None),
) -> AccountListResponse:
    """Retrieves up to 100 accessible Google Ads customer accounts for the authenticated user.

    Uses Google Ads API CustomerService.list_accessible_customers().
    Falls back to mock accounts if unauthenticated or in mock credential mode.
    """
    creds = default_auth_provider.get_google_ads_credentials()
    user_access_token = _extract_bearer_token(authorization)
    query_error: str | None = None

    if creds.developer_token:
        try:
            # 1. Fetch accessible customer accounts (must NOT include login_customer_id header)
            googleads_client = default_auth_provider.get_google_ads_client(
                user_access_token=user_access_token,
                include_login_customer_id=False,
            )
            customer_service = googleads_client.get_service("CustomerService")
            accessible_customers = customer_service.list_accessible_customers()

            resource_names = list(accessible_customers.resource_names)[:100]
            accounts_dict: dict[str, AccountItem] = {}

            # Traverse customer_client hierarchy for top-level accessible customers (MCCs)
            for resource_name in resource_names:
                top_cid = resource_name.split("/")[-1].replace("-", "").strip()
                formatted_top = f"{top_cid[:3]}-{top_cid[3:6]}-{top_cid[6:]}" if len(top_cid) == 10 else top_cid

                # Try querying customer_client hierarchy under top_cid
                client_attempts = []
                if creds.login_customer_id:
                    try:
                        c1 = default_auth_provider.get_google_ads_client(
                            user_access_token=user_access_token,
                            include_login_customer_id=True,
                        )
                        client_attempts.append(c1)
                    except Exception:
                        pass
                try:
                    c2 = default_auth_provider.get_google_ads_client(
                        user_access_token=user_access_token,
                        include_login_customer_id=True,
                        login_customer_id_override=top_cid,
                    )
                    client_attempts.append(c2)
                except Exception:
                    pass
                try:
                    c3 = default_auth_provider.get_google_ads_client(
                        user_access_token=user_access_token,
                        include_login_customer_id=False,
                    )
                    client_attempts.append(c3)
                except Exception:
                    pass

                queried_hierarchy = False
                for g_client in client_attempts:
                    try:
                        ga_service = g_client.get_service("GoogleAdsService")
                        query = """
                            SELECT
                              customer_client.id,
                              customer_client.descriptive_name,
                              customer_client.manager,
                              customer_client.status,
                              customer_client.level
                            FROM customer_client
                            WHERE customer_client.status = 'ENABLED'
                            ORDER BY customer_client.level ASC, customer_client.descriptive_name ASC
                        """
                        rows = ga_service.search(customer_id=top_cid, query=query)
                        for row in rows:
                            sub_id = str(row.customer_client.id)
                            if sub_id in accounts_dict:
                                continue

                            formatted_sub = f"{sub_id[:3]}-{sub_id[3:6]}-{sub_id[6:]}" if len(sub_id) == 10 else sub_id
                            desc_name = row.customer_client.descriptive_name or None
                            is_mgr = bool(row.customer_client.manager)

                            if desc_name:
                                name_str = f"{desc_name} ({formatted_sub})"
                            else:
                                name_str = f"Google Ads Account ({formatted_sub})" if not is_mgr else f"Manager Account ({formatted_sub})"

                            accounts_dict[sub_id] = AccountItem(
                                id=sub_id,
                                name=name_str,
                                descriptive_name=desc_name,
                                is_manager=is_mgr,
                            )
                        queried_hierarchy = True
                        break
                    except Exception as h_err:
                        logger.debug(f"customer_client hierarchy search failed for {top_cid}: {h_err}")

                # Fallback: if hierarchy query didn't execute, add top_cid directly
                if not queried_hierarchy and top_cid not in accounts_dict:
                    accounts_dict[top_cid] = AccountItem(
                        id=top_cid,
                        name=f"Google Ads Account ({formatted_top})",
                        descriptive_name=None,
                        is_manager=False,
                    )

            accounts = list(accounts_dict.values())

            # If user is logged in or accounts were fetched, return ONLY live accounts
            if user_access_token or accounts:
                return AccountListResponse(
                    total_count=len(accounts),
                    accounts=accounts,
                    source="live_google_ads_api",
                    error_message=query_error,
                )
        except Exception as err:
            logger.warning(f"Failed to list accessible customer accounts: {err}")
            err_str = str(err)
            if "invalid_grant" in err_str or "UNAUTHENTICATED" in err_str or "Unauthenticated" in err_str:
                query_error = "Google OAuth session unauthorized or expired. Please sign in with Google again."
            elif isinstance(err, ValueError):
                query_error = str(err)
            else:
                query_error = f"Google Ads API notice: {err_str}"

            if user_access_token:
                return AccountListResponse(
                    total_count=0,
                    accounts=[],
                    source="live_google_ads_api",
                    error_message=query_error,
                )

    # Fallback to mock accounts ONLY when unauthenticated AND in mock mode
    mock_mcc = (creds.login_customer_id or "9044713567").replace("-", "").strip()
    fmt_mcc = f"{mock_mcc[:3]}-{mock_mcc[3:6]}-{mock_mcc[6:]}" if len(mock_mcc) == 10 else mock_mcc

    mock_accounts = [
        AccountItem(
            id=mock_mcc,
            name=f"Primary Account ({fmt_mcc})",
            descriptive_name="Primary Account",
            is_manager=True,
        ),
        AccountItem(
            id="9941182026",
            name="Store DE PMax Demo (994-118-2026)",
            descriptive_name="Store DE PMax Demo",
            is_manager=False,
        ),
    ]
    return AccountListResponse(
        total_count=len(mock_accounts),
        accounts=mock_accounts,
        source="mock",
        error_message=query_error,
    )


@router.get(
    "/asset-groups",
    response_model=AssetGroupListResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch PMax Asset Groups via GAQL",
)
async def get_asset_groups(
    customer_id: str | None = None,
    authorization: str | None = Header(None),
) -> AssetGroupListResponse:
    """Queries live Performance Max Asset Groups from Google Ads API via GAQL.

    Falls back cleanly to structured default asset groups if credentials are in mock mode.
    """
    creds = default_auth_provider.get_google_ads_credentials()
    if customer_id and customer_id != "9941182026":
        clean_customer_id = customer_id.replace("-", "").strip()
    else:
        clean_customer_id = (creds.login_customer_id or "9044713567").replace("-", "").strip()

    user_access_token = _extract_bearer_token(authorization)
    query_error: str | None = None

    if creds.developer_token:
        query = """
            SELECT
              asset_group.id,
              asset_group.name,
              campaign.id,
              campaign.name,
              asset_group.status,
              campaign.status
            FROM asset_group
            WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
            ORDER BY campaign.name ASC
        """

        # Build fallback GoogleAdsClient instances in order of preference:
        # 1. Configured MCC Manager ID
        # 2. Target Customer ID as login_customer_id
        # 3. Direct access (No login_customer_id header)
        client_attempts: list[tuple[str, Any]] = []
        if creds.login_customer_id:
            try:
                c1 = default_auth_provider.get_google_ads_client(
                    user_access_token=user_access_token,
                    include_login_customer_id=True,
                )
                client_attempts.append(("mcc_header", c1))
            except Exception as e:
                logger.warning(f"Could not build GoogleAdsClient with MCC header: {e}")
        else:
            if clean_customer_id:
                try:
                    c2 = default_auth_provider.get_google_ads_client(
                        user_access_token=user_access_token,
                        include_login_customer_id=True,
                        login_customer_id_override=clean_customer_id,
                    )
                    client_attempts.append(("customer_header", c2))
                except Exception:
                    pass
            try:
                c3 = default_auth_provider.get_google_ads_client(
                    user_access_token=user_access_token,
                    include_login_customer_id=False,
                )
                client_attempts.append(("no_header", c3))
            except Exception:
                pass

        last_err: Exception | None = None
        for mode, g_client in client_attempts:
            try:
                ga_service = g_client.get_service("GoogleAdsService")
                response = ga_service.search(customer_id=clean_customer_id, query=query)

                square_counts: dict[str, int] = {}
                landscape_counts: dict[str, int] = {}
                portrait_counts: dict[str, int] = {}
                image_type_counts: dict[str, int] = {}
                try:
                    asset_query = """
                        SELECT
                          asset_group.id,
                          asset_group_asset.field_type,
                          asset_group_asset.status,
                          asset.type
                        FROM asset_group_asset
                        WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
                          AND asset_group_asset.status = 'ENABLED'
                    """
                    asset_response = ga_service.search(customer_id=clean_customer_id, query=asset_query)
                    for r in asset_response:
                        ag_id_str = str(r.asset_group.id)
                        ft_val = r.asset_group_asset.field_type
                        ft = ft_val.name if hasattr(ft_val, "name") else str(ft_val)
                        at_val = getattr(r.asset, "type", None)
                        at = at_val.name if hasattr(at_val, "name") else str(at_val)
                        if at == "IMAGE" or ft in ("MARKETING_IMAGE", "SQUARE_MARKETING_IMAGE", "PORTRAIT_MARKETING_IMAGE", "LOGO", "LANDSCAPE_LOGO"):
                            image_type_counts[ag_id_str] = image_type_counts.get(ag_id_str, 0) + 1

                        if ft == "SQUARE_MARKETING_IMAGE":
                            square_counts[ag_id_str] = square_counts.get(ag_id_str, 0) + 1
                        elif ft == "MARKETING_IMAGE":
                            landscape_counts[ag_id_str] = landscape_counts.get(ag_id_str, 0) + 1
                        elif ft == "PORTRAIT_MARKETING_IMAGE":
                            portrait_counts[ag_id_str] = portrait_counts.get(ag_id_str, 0) + 1
                except Exception as count_err:
                    logger.warning(f"Could not fetch live asset counts via asset_group_asset GAQL: {count_err}")

                groups: list[AssetGroupItem] = []
                for row in response:
                    ag_id_str = str(row.asset_group.id)
                    sq_c = square_counts.get(ag_id_str, 0)
                    ls_c = landscape_counts.get(ag_id_str, 0)
                    pt_c = portrait_counts.get(ag_id_str, 0)
                    tot_c = image_type_counts.get(ag_id_str, 0)
                    groups.append(
                        AssetGroupItem(
                            id=ag_id_str,
                            name=row.asset_group.name,
                            campaign_id=str(row.campaign.id),
                            campaign_name=row.campaign.name,
                            status=row.asset_group.status.name,
                            square_count=tot_c,
                            landscape_count=ls_c,
                            portrait_count=pt_c,
                        )
                    )
                logger.info(f"Successfully queried {len(groups)} asset groups for customer {clean_customer_id} using '{mode}' header strategy.")
                return AssetGroupListResponse(
                    total_count=len(groups),
                    asset_groups=groups,
                    source="live_google_ads_api",
                )
            except Exception as err:
                last_err = err
                logger.debug(f"GAQL search using '{mode}' header strategy failed for customer {clean_customer_id}: {err}")

        err = last_err or Exception("All Google Ads API client header strategies failed.")
        logger.warning(f"Google Ads API live GAQL query failed for customer {clean_customer_id}: {err}")
        err_str = str(err)
        if "CUSTOMER_NOT_FOUND" in err_str:
            query_error = f"Google Ads Customer ID '{clean_customer_id}' was not found or is not accessible by your account."
        elif "PERMISSION_DENIED" in err_str or "USER_PERMISSION_DENIED" in err_str:
            query_error = f"Google Ads Customer ID '{clean_customer_id}' permission denied for your logged-in Google account."
        elif "invalid_grant" in err_str or "UNAUTHENTICATED" in err_str or "Unauthenticated" in err_str:
            query_error = "Google OAuth session unauthorized or expired. Please sign in with Google again."
        elif isinstance(err, ValueError):
            query_error = str(err)
        else:
            query_error = f"Google Ads API notice: {err_str}"

        return AssetGroupListResponse(
            total_count=0,
            asset_groups=[],
            source="live_google_ads_api",
            error_message=query_error,
        )

    return AssetGroupListResponse(
        total_count=0,
        asset_groups=[],
        source="live_google_ads_api",
        error_message=query_error or "No live Google Ads credentials configured.",
    )


@router.post(
    "/upload",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload & Inspect Native Aspect Ratio Image",
)
async def upload_image(file: UploadFile = File(...)) -> ImageUploadResponse:
    """Validates an uploaded image file against native Google Ads PMax aspect ratios."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    try:
        ratio_info = inspect_image_aspect_ratio(contents)
    except UnsupportedAspectRatioError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        ) from val_err

    file_token = str(uuid.uuid4())
    _UPLOAD_CACHE[file_token] = {
        "filename": file.filename or "uploaded_image.png",
        "bytes": contents,
        "ratio_info": ratio_info,
    }

    return ImageUploadResponse(
        file_token=file_token,
        filename=file.filename or "uploaded_image.png",
        width=ratio_info.width,
        height=ratio_info.height,
        ratio_type=ratio_info.ratio_type,
        field_type=ratio_info.field_type,
        aspect_ratio=ratio_info.aspect_ratio,
    )


@router.post(
    "/assign",
    response_model=AssignResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch Assign Asset to Selected PMax Asset Groups",
)
async def assign_asset(
    payload: AssignRequest,
    authorization: str | None = Header(None),
) -> AssignResponse:
    """Creates Google Ads Image Asset and links it to target Asset Groups via Google Ads API."""
    if payload.file_token not in _UPLOAD_CACHE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload session expired or token not found. Please upload the image again.",
        )

    upload_data = _UPLOAD_CACHE[payload.file_token]
    ratio_info = upload_data["ratio_info"]
    filename = upload_data["filename"]
    image_bytes = upload_data["bytes"]

    clean_customer_id = payload.customer_id.replace("-", "").strip() if payload.customer_id else "9044713567"
    results: list[AssignmentResult] = []

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if payload.start_date and payload.start_date > today_str:
        raw_b64 = base64.b64encode(image_bytes).decode("utf-8")
        job = ScheduledJob(
            customer_id=clean_customer_id,
            asset_group_ids=payload.asset_group_ids,
            asset_name=filename,
            image_b64=raw_b64,
            start_date=payload.start_date,
            end_date=payload.end_date or "",
            status=ScheduledJobStatus.PENDING,
        )
        schedule_store.add_job(job)
        return AssignResponse(
            file_token=payload.file_token,
            field_type=ratio_info.field_type,
            total_assigned=0,
            results=[
                AssignmentResult(
                    asset_group_id=ag_id,
                    status="SCHEDULED_PENDING",
                    asset_resource_name="",
                    asset_group_asset_resource_name="",
                )
                for ag_id in payload.asset_group_ids
            ],
        )

    creds = default_auth_provider.get_google_ads_credentials()
    user_access_token = _extract_bearer_token(authorization)

    client_attempts: list[tuple[str, Any]] = []
    if creds.login_customer_id:
        try:
            c1 = default_auth_provider.get_google_ads_client(
                user_access_token=user_access_token,
                include_login_customer_id=True,
            )
            client_attempts.append(("mcc_header", c1))
        except Exception as e:
            logger.warning(f"Could not build GoogleAdsClient with MCC header: {e}")
    else:
        if clean_customer_id:
            try:
                c2 = default_auth_provider.get_google_ads_client(
                    user_access_token=user_access_token,
                    include_login_customer_id=True,
                    login_customer_id_override=clean_customer_id,
                )
                client_attempts.append(("customer_header", c2))
            except Exception:
                pass
        try:
            c3 = default_auth_provider.get_google_ads_client(
                user_access_token=user_access_token,
                include_login_customer_id=False,
            )
            client_attempts.append(("no_header", c3))
        except Exception:
            pass

    last_err: Exception | None = None
    if creds.developer_token and creds.developer_token != "mock_developer_token_2026":
        for mode, g_client in client_attempts:
            try:
                asset_service = g_client.get_service("AssetService")
                asset_group_asset_service = g_client.get_service("AssetGroupAssetService")

                # 1. Create Asset mutation
                asset_operation = g_client.get_type("AssetOperation")
                asset = asset_operation.create
                asset.name = f"Adios_{filename}_{uuid.uuid4().hex[:6]}"
                asset.type_ = g_client.enums.AssetTypeEnum.IMAGE
                asset.image_asset.data = image_bytes

                asset_response = asset_service.mutate_assets(
                    customer_id=clean_customer_id,
                    operations=[asset_operation]
                )
                created_asset_rn = asset_response.results[0].resource_name

                # 2. Link Asset to each Asset Group via AssetGroupAssetOperation
                aga_request = g_client.get_type("MutateAssetGroupAssetsRequest")
                aga_request.customer_id = clean_customer_id
                aga_request.partial_failure = True
                for ag_id in payload.asset_group_ids:
                    aga_op = g_client.get_type("AssetGroupAssetOperation")
                    aga = aga_op.create
                    aga.asset_group = f"customers/{clean_customer_id}/assetGroups/{ag_id}"
                    aga.asset = created_asset_rn

                    field_enum = getattr(g_client.enums.AssetFieldTypeEnum, ratio_info.field_type)
                    aga.field_type = field_enum
                    aga_request.operations.append(aga_op)

                aga_response = asset_group_asset_service.mutate_asset_group_assets(request=aga_request)

                linked_count = 0
                for i, res in enumerate(aga_response.results):
                    res_rn = getattr(res, "resource_name", "")
                    if res_rn:
                        linked_count += 1
                        results.append(
                            AssignmentResult(
                                asset_group_id=payload.asset_group_ids[i],
                                status="SUCCESS",
                                asset_resource_name=created_asset_rn,
                                asset_group_asset_resource_name=res_rn,
                            )
                        )
                    else:
                        results.append(
                            AssignmentResult(
                                asset_group_id=payload.asset_group_ids[i],
                                status="FAILED",
                                asset_resource_name=created_asset_rn,
                                asset_group_asset_resource_name="",
                            )
                        )

                pf_err = getattr(aga_response, "partial_failure_error", None)
                if linked_count == 0:
                    err_msgs = _extract_partial_failure_details(g_client, pf_err) if pf_err else []
                    raw_str = " | ".join(err_msgs) if err_msgs else "Google Ads API partial failure prevented asset group link."
                    err_str = _clean_asset_group_error_message(raw_str)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Asset created in library ({created_asset_rn}), but linking to asset group failed: {err_str}",
                    )

                logger.info(f"Successfully uploaded & linked image to {linked_count} asset group(s) for customer {clean_customer_id} using '{mode}' header strategy.")
                
                # If an end date is set, register for automated unlinking
                if payload.end_date:
                    raw_b64 = base64.b64encode(image_bytes).decode("utf-8")
                    extracted_asset_id = created_asset_rn.split("/")[-1]
                    schedule_store.add_job(
                        ScheduledJob(
                            customer_id=clean_customer_id,
                            asset_group_ids=payload.asset_group_ids,
                            asset_name=filename,
                            image_b64=raw_b64,
                            asset_id=extracted_asset_id,
                            start_date=payload.start_date or today_str,
                            end_date=payload.end_date,
                            status=ScheduledJobStatus.LINKED,
                        )
                    )

                return AssignResponse(
                    file_token=payload.file_token,
                    field_type=ratio_info.field_type,
                    total_assigned=linked_count,
                    results=results,
                )
            except Exception as err:
                last_err = err
                logger.warning(f"Google Ads API mutation using '{mode}' header strategy failed for customer {clean_customer_id}: {err}")

        formatted_err = _format_google_ads_error(last_err) if last_err else "Live Google Ads API mutation failed."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google Ads API mutation failed for customer {clean_customer_id}: {formatted_err}",
        )

    # Fallback for local sandbox/testing without live dev token
    synthetic_asset_id = f"customers/{clean_customer_id}/assets/{uuid.uuid4().hex[:8]}"
    for ag_id in payload.asset_group_ids:
        synthetic_aga_id = f"customers/{clean_customer_id}/assetGroupAssets/{ag_id}~{uuid.uuid4().hex[:6]}"
        results.append(
            AssignmentResult(
                asset_group_id=ag_id,
                status="SUCCESS",
                asset_resource_name=synthetic_asset_id,
                asset_group_asset_resource_name=synthetic_aga_id,
            )
        )

    if payload.end_date:
        raw_b64 = base64.b64encode(image_bytes).decode("utf-8")
        schedule_store.add_job(
            ScheduledJob(
                customer_id=clean_customer_id,
                asset_group_ids=payload.asset_group_ids,
                asset_name=filename,
                image_b64=raw_b64,
                asset_id=synthetic_asset_id.split("/")[-1],
                start_date=payload.start_date or today_str,
                end_date=payload.end_date,
                status=ScheduledJobStatus.LINKED,
            )
        )

    return AssignResponse(
        file_token=payload.file_token,
        field_type=ratio_info.field_type,
        total_assigned=len(results),
        results=results,
    )


@router.get(
    "/scheduled-jobs",
    summary="List Scheduled Asset Lifecycle Jobs",
)
async def list_scheduled_jobs() -> dict[str, Any]:
    jobs = schedule_store.load_jobs()
    return {"total_count": len(jobs), "jobs": [j.model_dump() for j in jobs]}


@router.post(
    "/run-scheduler",
    summary="Manually Trigger Scheduled Jobs Engine",
)
async def trigger_scheduler(
    as_of_date: str | None = None,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    user_access_token = _extract_bearer_token(authorization)
    return process_scheduled_jobs(as_of_date=as_of_date, user_access_token=user_access_token)

