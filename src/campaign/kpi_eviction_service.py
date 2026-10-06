from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List
from google.ads.googleads.client import GoogleAdsClient
from pydantic import BaseModel, Field
from src.core.firestore_service import default_firestore_service

logger = logging.getLogger(__name__)

KPI_METRIC_MAP = {
    "ctr": "metrics.ctr",
    "clicks": "metrics.clicks",
    "impressions": "metrics.impressions",
    "conv_rate": "metrics.conversions_from_interactions_rate",
    "cpa": "metrics.cost_per_conversion",
    "roas": "metrics.conversions_value_per_cost",
    "conversions": "metrics.conversions",
    "cost": "metrics.cost_micros",
}


class SwapRules(BaseModel):
  lookback_window: str = "30d"  # "7d", "30d", "90d", "quarter", "custom"
  custom_lookback_days: int | None = None
  min_impressions: int | None = None
  min_clicks: int | None = None
  eviction_kpi: str = "ctr"
  allow_cross_aspect_ratio_swap: bool = False
  grace_period_minutes: int = 1


class EvictedAssetInfo(BaseModel):
  asset_id: str
  name: str
  url: str
  kpi_metric: str
  kpi_value: float


class KPIEvictionService:

  @staticmethod
  def calculate_date_range(
      window: str, custom_days: int | None = None
  ) -> tuple[str, str]:
    today = datetime.now(timezone.utc).date()

    if window == "7d":
      start_date = today - timedelta(days=7)
    elif window == "30d":
      start_date = today - timedelta(days=30)
    elif window == "90d":
      start_date = today - timedelta(days=90)
    elif window == "quarter":
      # Dynamic calculation of Last Closed Quarter
      current_quarter = (today.month - 1) // 3 + 1
      current_year = today.year

      if current_quarter == 1:
        start_date = datetime(current_year - 1, 10, 1).date()
        end_date = datetime(current_year - 1, 12, 31).date()
      elif current_quarter == 2:
        start_date = datetime(current_year, 1, 1).date()
        end_date = datetime(current_year, 3, 31).date()
      elif current_quarter == 3:
        start_date = datetime(current_year, 4, 1).date()
        end_date = datetime(current_year, 6, 30).date()
      else:
        start_date = datetime(current_year, 7, 1).date()
        end_date = datetime(current_year, 9, 30).date()

      return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")
    elif window == "custom" and custom_days:
      start_date = today - timedelta(days=custom_days)
    else:
      start_date = today - timedelta(days=30)

    end_date = today
    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")

  @classmethod
  def get_operations_for_group(
      cls,
      g_client: Any,
      clean_customer_id: str,
      asset_group_id: str,
      field_type: str,
      new_asset_resource_name: str,
      rules: SwapRules | None,
  ) -> dict[str, Any]:
    """Returns a dict with operations to execute and evicted asset info if applicable.

    Returns:
        {
            "operations": List of AssetGroupAssetOperation,
            "evicted_asset": EvictedAssetInfo | None,
            "status": "SUCCESS" | "FAILED",
            "error_message": str | None
        }
    """
    ga_service = g_client.get_service("GoogleAdsService")

    # 1. Fetch currently linked assets to check capacity
    query_links = f"""
            SELECT 
              asset_group_asset.asset,
              asset.image_asset.full_size.url,
              asset.name,
              asset_group_asset.field_type
            FROM asset_group_asset
            WHERE asset_group_asset.asset_group = 'customers/{clean_customer_id}/assetGroups/{asset_group_id}'
              AND asset_group_asset.field_type IN ('MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE', 'PORTRAIT_MARKETING_IMAGE', 'TALL_PORTRAIT_MARKETING_IMAGE')
              AND asset_group_asset.status = 'ENABLED'
        """

    linked_assets = []
    rows = ga_service.search(customer_id=clean_customer_id, query=query_links)
    for row in rows:
      linked_assets.append({
          "asset_id": row.asset_group_asset.asset.split("/")[-1],
          "resource_name": row.asset_group_asset.asset,
          "name": row.asset.name or "Unnamed Asset",
          "url": row.asset.image_asset.full_size.url or "",
          "field_type": row.asset_group_asset.field_type.name,
      })

    new_asset_id = new_asset_resource_name.split("/")[-1]
    linked_ids = [item["asset_id"] for item in linked_assets]
    if new_asset_id in linked_ids:
      # Already linked, no need to swap or add
      return {
          "operations": [],
          "evicted_asset": None,
          "status": "SUCCESS",
          "error_message": (
              f"Asset {new_asset_id} is already linked to this Asset Group."
          ),
      }

    total_images = len(linked_assets)
    is_capacity_reached = total_images >= 20

    # Build the standard ADD operation
    op_add = g_client.get_type("AssetGroupAssetOperation")
    aga_add = op_add.create
    aga_add.asset_group = (
        f"customers/{clean_customer_id}/assetGroups/{asset_group_id}"
    )
    aga_add.asset = new_asset_resource_name
    aga_add.field_type = getattr(g_client.enums.AssetFieldTypeEnum, field_type)

    if not is_capacity_reached or not rules:
      return {
          "operations": [{"type": "add", "proto": op_add}],
          "evicted_asset": None,
          "status": "SUCCESS",
          "error_message": None,
      }

    # 2. Limit reached and rules provided: Eviction Engine Required
    logger.info(
        f"Asset Group {asset_group_id} capacity ({total_images}/20) reached."
        f" Executing eviction rules for {field_type}."
    )

    # Fetch full state of asset_group_asset links from Firestore to prevent cyclic or redundant swaps
    link_history = default_firestore_service.get_link_history_for_group(
        clean_customer_id, asset_group_id
    )

    # Map of asset_id -> most recent LINK timestamp
    link_timestamps: Dict[str, datetime] = {}
    for op in reversed(
        link_history
    ):  # Iterate oldest to newest so newest overwrites
      if op.google_ads_asset_id:
        link_timestamps[op.google_ads_asset_id] = op.timestamp

    grace_period = rules.grace_period_minutes if rules else 1
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=grace_period)

    # Query protected assets
    protected_asset_ids = set()
    protected_docs = default_firestore_service.get_protected_assets(
        clean_customer_id
    )
    for asset_id in protected_docs:
      protected_asset_ids.add(asset_id)

    # Query stats
    start_date, end_date = cls.calculate_date_range(
        rules.lookback_window, rules.custom_lookback_days
    )
    kpi_field = KPI_METRIC_MAP.get(rules.eviction_kpi.lower(), "metrics.ctr")

    field_type_filter = (
        "IN ('MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE',"
        " 'PORTRAIT_MARKETING_IMAGE', 'TALL_PORTRAIT_MARKETING_IMAGE')"
        if rules.allow_cross_aspect_ratio_swap
        else f"= '{field_type}'"
    )

    query_stats = f"""
            SELECT 
              asset_group_asset.asset,
              metrics.impressions,
              metrics.clicks,
              {kpi_field}
            FROM asset_group_asset
            WHERE asset_group_asset.asset_group = 'customers/{clean_customer_id}/assetGroups/{asset_group_id}'
              AND asset_group_asset.field_type {field_type_filter}
              AND segments.date >= '{start_date}' AND segments.date <= '{end_date}'
        """

    stats_map = {}
    stat_rows = ga_service.search(
        customer_id=clean_customer_id, query=query_stats
    )
    for r in stat_rows:
      asset_id = r.asset_group_asset.asset.split("/")[-1]

      parts = kpi_field.split(".")
      val = getattr(getattr(r, parts[0]), parts[1], 0.0)
      if val is None:
        val = 0.0

      stats_map[asset_id] = {
          "impressions": getattr(r.metrics, "impressions", 0),
          "clicks": getattr(r.metrics, "clicks", 0),
          "kpi_value": float(val),
      }

    if rules.allow_cross_aspect_ratio_swap:
      format_assets = linked_assets
    else:
      format_assets = [
          a for a in linked_assets if a["field_type"] == field_type
      ]

    if not format_assets:
      return {
          "operations": [],
          "evicted_asset": None,
          "status": "FAILED",
          "error_message": (
              "No images to swap"
              if rules.allow_cross_aspect_ratio_swap
              else "No same aspect ratio images to swap"
          ),
      }

    # Build candidate list
    candidates = []
    for asset in linked_assets:
      asset_id = asset["asset_id"]
      if (
          not rules.allow_cross_aspect_ratio_swap
          and asset["field_type"] != field_type
      ):
        continue

      if asset_id in protected_asset_ids:
        continue

      # Strictly filter out recently swapped assets (Grace Period)
      link_time = link_timestamps.get(asset_id)
      if link_time and link_time >= cutoff_time:
        logger.info(
            f"Asset {asset_id} is protected by Grace Period (linked at"
            f" {link_time})."
        )
        continue

      stats = stats_map.get(
          asset_id, {"impressions": 0, "clicks": 0, "kpi_value": 0.0}
      )

      # Apply thresholds
      if (
          rules.min_impressions is not None
          and stats["impressions"] < rules.min_impressions
      ):
        continue
      if rules.min_clicks is not None and stats["clicks"] < rules.min_clicks:
        continue

      candidates.append({
          **asset,
          "impressions": stats["impressions"],
          "clicks": stats["clicks"],
          "kpi_value": stats["kpi_value"],
          "link_timestamp": link_time,
      })

    if not candidates:
      return {
          "operations": [],
          "evicted_asset": None,
          "status": "FAILED",
          "error_message": (
              "No more capacity. How to fix: check swap rules and protected"
              " images, number of images limit per asset group is 20."
          ),
      }

    # Sort candidates: worst KPI first. Tie-breaker: oldest asset first (to prefer evicting legacy evergreen assets)
    is_descending = rules.eviction_kpi.lower() in ["cpa", "cost"]
    candidates.sort(
        key=lambda x: (
            -x["kpi_value"] if is_descending else x["kpi_value"],
            x["link_timestamp"]
            if x["link_timestamp"] is not None
            else datetime.min.replace(tzinfo=timezone.utc),
        )
    )
    victim = candidates[0]

    # Build REMOVE operation
    op_remove = g_client.get_type("AssetGroupAssetOperation")
    op_remove.remove = f"customers/{clean_customer_id}/assetGroupAssets/{asset_group_id}~{victim['asset_id']}~{victim['field_type']}"

    evicted_info = EvictedAssetInfo(
        asset_id=victim["asset_id"],
        name=victim["name"],
        url=victim["url"],
        kpi_metric=rules.eviction_kpi,
        kpi_value=victim["kpi_value"],
    )

    return {
        "operations": [
            {"type": "remove", "proto": op_remove},
            {"type": "add", "proto": op_add},
        ],
        "evicted_asset": evicted_info,
        "status": "SUCCESS",
        "error_message": None,
    }
