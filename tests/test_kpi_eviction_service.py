from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import pytest
from src.campaign.kpi_eviction_service import KPIEvictionService, SwapRules
from src.core.firestore_service import LinkOperationDocument, OperationStatus, OperationType


def create_mock_row(
    asset_id: str, field_type: str, impressions: int, clicks: int, ctr: float
):
  row = MagicMock()
  row.asset_group_asset.asset = f"customers/1234567890/assets/{asset_id}"
  row.asset_group_asset.field_type.name = field_type
  row.asset.name = f"Asset_{asset_id}"
  row.asset.image_asset.full_size.url = f"http://example.com/{asset_id}.png"
  row.metrics.impressions = impressions
  row.metrics.clicks = clicks
  row.metrics.ctr = ctr
  return row


@pytest.fixture
def mock_dependencies():
  with patch(
      "src.campaign.kpi_eviction_service.default_firestore_service"
  ) as mock_fs:
    protected_list = []
    link_history = []
    mock_fs.get_protected_assets.side_effect = lambda cid: protected_list
    mock_fs.get_link_history_for_group.side_effect = (
        lambda cid, ag_id: link_history
    )
    yield mock_fs, protected_list, link_history


def test_get_operations_not_full(mock_dependencies):
  mock_g_client = MagicMock()

  # 18 assets in PORTRAIT_MARKETING_IMAGE (capacity is 20)
  rows = [
      create_mock_row(str(i), "PORTRAIT_MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(18)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  assert len(res["operations"]) == 1
  assert res["operations"][0]["type"] == "add"
  assert res["evicted_asset"] is None


def test_get_operations_full_all_protected(mock_dependencies):
  mock_fs, protected_list, link_history = mock_dependencies
  mock_g_client = MagicMock()

  # 20 assets (Full)
  rows = [
      create_mock_row(str(i), "PORTRAIT_MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(20)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  # All 20 are protected
  for i in range(20):
    protected_list.append(str(i))

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "FAILED"
  assert "no more capacity" in res["error_message"].lower()
  assert len(res["operations"]) == 0


def test_get_operations_full_below_thresholds(mock_dependencies):
  mock_g_client = MagicMock()

  # Min impressions = 1000
  # All assets have 500 impressions
  rows = [
      create_mock_row(str(i), "PORTRAIT_MARKETING_IMAGE", 500, 50, 0.1)
      for i in range(20)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(
      lookback_window="30d", eviction_kpi="ctr", min_impressions=1000
  )

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "FAILED"
  assert "no more capacity" in res["error_message"].lower()
  assert len(res["operations"]) == 0


def test_get_operations_full_selects_lowest_ctr(mock_dependencies):
  mock_fs, protected_list, link_history = mock_dependencies
  mock_g_client = MagicMock()

  # Asset 2 has lowest CTR = 0.005
  rows = [
      create_mock_row(
          str(i), "PORTRAIT_MARKETING_IMAGE", 1000, 10 + i, 0.01 + i * 0.001
      )
      for i in range(20)
  ]
  rows[5].metrics.ctr = 0.001
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  # Protect asset 5 to ensure it skips it and takes the NEXT lowest (asset 0)
  protected_list.append("5")

  rules = SwapRules(
      lookback_window="30d", eviction_kpi="ctr", min_impressions=500
  )

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  assert len(res["operations"]) == 2

  remove_op = next(op for op in res["operations"] if op["type"] == "remove")
  assert (
      remove_op["proto"].remove
      == "customers/1234567890/assetGroupAssets/ag1~0~PORTRAIT_MARKETING_IMAGE"
  )

  assert res["evicted_asset"] is not None
  assert res["evicted_asset"].asset_id == "0"
  assert res["evicted_asset"].kpi_value == 0.01


def test_get_operations_already_linked(mock_dependencies):
  mock_g_client = MagicMock()

  rows = [
      create_mock_row("0", "PORTRAIT_MARKETING_IMAGE", 100, 10, 0.1),
      create_mock_row("1", "PORTRAIT_MARKETING_IMAGE", 100, 10, 0.1),
      create_mock_row("new123", "PORTRAIT_MARKETING_IMAGE", 100, 10, 0.1),
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  assert len(res["operations"]) == 0
  assert res["evicted_asset"] is None
  assert "already linked" in res["error_message"]


def test_get_operations_combined_capacity_reached(mock_dependencies):
  mock_g_client = MagicMock()

  # 15 Marketing + 5 Square = 20 total
  rows = [
      create_mock_row(str(i), "MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(15)
  ]
  rows += [
      create_mock_row(str(15 + i), "SQUARE_MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(5)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="SQUARE_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  assert len(res["operations"]) == 2  # Triggers eviction because total is 20!


def test_get_operations_filters_same_format(mock_dependencies):
  mock_g_client = MagicMock()

  # Marketing images have VERY LOW CTR = 0.001
  rows = [
      create_mock_row(str(i), "MARKETING_IMAGE", 1000, 1, 0.001)
      for i in range(15)
  ]

  # Square images have HIGHER CTR, but Square 15 is lowest among them (0.01)
  rows += [
      create_mock_row("15", "SQUARE_MARKETING_IMAGE", 1000, 10, 0.01),
      create_mock_row("16", "SQUARE_MARKETING_IMAGE", 1000, 20, 0.02),
      create_mock_row("17", "SQUARE_MARKETING_IMAGE", 1000, 30, 0.03),
      create_mock_row("18", "SQUARE_MARKETING_IMAGE", 1000, 40, 0.04),
      create_mock_row("19", "SQUARE_MARKETING_IMAGE", 1000, 50, 0.05),
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="SQUARE_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  remove_op = next(op for op in res["operations"] if op["type"] == "remove")

  # MUST evict from Square images, NOT Marketing images!
  assert "SQUARE_MARKETING_IMAGE" in remove_op["proto"].remove
  assert res["evicted_asset"].asset_id == "15"


def test_get_operations_portrait_at_total_capacity(mock_dependencies):
  mock_g_client = MagicMock()

  # 20 Portrait + 0 Marketing = 20 total (at 20 total limit)
  rows = [
      create_mock_row(str(i), "PORTRAIT_MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(20)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  # Should trigger eviction because total capacity of 20 is reached!
  assert res["status"] == "SUCCESS"
  assert len(res["operations"]) == 2


def test_calculate_date_range_quarter():
  from datetime import datetime

  class MockDatetime(datetime):

    @classmethod
    def now(cls, tz=None):
      return datetime(2026, 5, 15, tzinfo=tz)  # Q2

  with patch("src.campaign.kpi_eviction_service.datetime", MockDatetime):
    start_date, end_date = KPIEvictionService.calculate_date_range("quarter")
    assert start_date == "2026-01-01"
    assert end_date == "2026-03-31"


def test_get_operations_for_group_api_failure_propagates(mock_dependencies):
  import pytest

  mock_g_client = MagicMock()
  mock_g_client.get_service.side_effect = RuntimeError("API down")

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  with pytest.raises(RuntimeError, match="API down"):
    KPIEvictionService.get_operations_for_group(
        g_client=mock_g_client,
        clean_customer_id="1234567890",
        asset_group_id="ag1",
        field_type="MARKETING_IMAGE",
        new_asset_resource_name="customers/1234567890/assets/new123",
        rules=rules,
    )


def test_get_operations_no_same_ratio_images_to_swap(mock_dependencies):
  mock_g_client = MagicMock()

  # Capacity is full: 10 Marketing + 10 Square = 20 total
  rows = [
      create_mock_row(str(i), "MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(10)
  ]
  rows += [
      create_mock_row(str(10 + i), "SQUARE_MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(10)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  # Attempt to add PORTRAIT_MARKETING_IMAGE
  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "FAILED"
  assert res["error_message"] == "No same aspect ratio images to swap"
  assert len(res["operations"]) == 0


def test_get_operations_tall_portrait_triggers_eviction(mock_dependencies):
  mock_g_client = MagicMock()

  # Capacity is full: 10 Marketing + 5 Square + 5 Tall Portrait = 20 total
  rows = [
      create_mock_row(str(i), "MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(10)
  ]
  rows += [
      create_mock_row(str(10 + i), "SQUARE_MARKETING_IMAGE", 100, 10, 0.1)
      for i in range(5)
  ]
  rows += [
      create_mock_row(
          str(15 + i), "TALL_PORTRAIT_MARKETING_IMAGE", 100, 10, 0.1
      )
      for i in range(5)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(lookback_window="30d", eviction_kpi="ctr")

  # Attempt to add MARKETING_IMAGE (should evict a Marketing image!)
  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  assert len(res["operations"]) == 2
  remove_op = next(op for op in res["operations"] if op["type"] == "remove")
  assert "MARKETING_IMAGE" in remove_op["proto"].remove


def test_get_operations_cross_ratio_eviction_success(mock_dependencies):
  mock_g_client = MagicMock()

  # Capacity is full: 10 Marketing + 10 Square = 20 total
  rows = [
      create_mock_row(str(i), "MARKETING_IMAGE", 1000, 10 + i, 0.1)
      for i in range(10)
  ]
  # Give square images lower CTR (e.g. 0.05) so they are the victims
  rows += [
      create_mock_row(str(10 + i), "SQUARE_MARKETING_IMAGE", 1000, 10 + i, 0.05)
      for i in range(10)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  rules = SwapRules(
      lookback_window="30d",
      eviction_kpi="ctr",
      allow_cross_aspect_ratio_swap=True,
  )

  # Attempt to add PORTRAIT_MARKETING_IMAGE
  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  assert len(res["operations"]) == 2
  remove_op = next(op for op in res["operations"] if op["type"] == "remove")

  # Victim should be a Square Marketing Image because it had lower CTR!
  assert "SQUARE_MARKETING_IMAGE" in remove_op["proto"].remove
  assert res["evicted_asset"].kpi_value == 0.05


def test_grace_period_protects_recent_swaps(mock_dependencies):
  mock_fs, protected_list, link_history = mock_dependencies
  mock_g_client = MagicMock()

  # 20 assets (Full)
  rows = [
      create_mock_row(str(i), "PORTRAIT_MARKETING_IMAGE", 1000, 10, 0.01)
      for i in range(20)
  ]
  # Asset 0 and 1 have even lower CTR (0.001 and 0.005)
  rows[0].metrics.ctr = 0.001
  rows[1].metrics.ctr = 0.005
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  # Asset 0 was just linked 1 hour ago (within 24h grace period)
  # Asset 1 was linked 48 hours ago (outside grace period)
  now = datetime.now(timezone.utc)
  link_history.append(
      LinkOperationDocument(
          operation_id="op1",
          customer_id="1234567890",
          asset_group_id="ag1",
          google_ads_asset_id="0",
          field_type="PORTRAIT_MARKETING_IMAGE",
          operation_type=OperationType.LINK,
          status=OperationStatus.SUCCESS,
          timestamp=now - timedelta(seconds=30),
      )
  )
  link_history.append(
      LinkOperationDocument(
          operation_id="op2",
          customer_id="1234567890",
          asset_group_id="ag1",
          google_ads_asset_id="1",
          field_type="PORTRAIT_MARKETING_IMAGE",
          operation_type=OperationType.LINK,
          status=OperationStatus.SUCCESS,
          timestamp=now - timedelta(minutes=2),
      )
  )

  rules = SwapRules(
      lookback_window="30d", eviction_kpi="ctr", grace_period_minutes=1
  )

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  remove_op = next(op for op in res["operations"] if op["type"] == "remove")
  # Asset 0 is protected by grace period, so it should evict Asset 1!
  assert "ag1~1~PORTRAIT_MARKETING_IMAGE" in remove_op["proto"].remove
  assert res["evicted_asset"].asset_id == "1"


def test_tie_breaker_prefers_legacy_assets(mock_dependencies):
  mock_fs, protected_list, link_history = mock_dependencies
  mock_g_client = MagicMock()

  # 20 assets (Full). All have SAME CTR (0.01)
  rows = [
      create_mock_row(str(i), "PORTRAIT_MARKETING_IMAGE", 1000, 10, 0.01)
      for i in range(20)
  ]
  mock_g_client.get_service("GoogleAdsService").search.return_value = rows

  # Asset 0 is legacy (no link history, link_timestamp = None)
  # Asset 1 was linked 48 hours ago
  # Asset 2 was linked 72 hours ago
  # Assets 3..19 were linked 1 hour ago
  now = datetime.now(timezone.utc)
  link_history.append(
      LinkOperationDocument(
          operation_id="op1",
          customer_id="1234567890",
          asset_group_id="ag1",
          google_ads_asset_id="1",
          field_type="PORTRAIT_MARKETING_IMAGE",
          operation_type=OperationType.LINK,
          status=OperationStatus.SUCCESS,
          timestamp=now - timedelta(hours=48),
      )
  )
  link_history.append(
      LinkOperationDocument(
          operation_id="op2",
          customer_id="1234567890",
          asset_group_id="ag1",
          google_ads_asset_id="2",
          field_type="PORTRAIT_MARKETING_IMAGE",
          operation_type=OperationType.LINK,
          status=OperationStatus.SUCCESS,
          timestamp=now - timedelta(hours=72),
      )
  )
  for i in range(3, 20):
    link_history.append(
        LinkOperationDocument(
            operation_id=f"op{i}",
            customer_id="1234567890",
            asset_group_id="ag1",
            google_ads_asset_id=str(i),
            field_type="PORTRAIT_MARKETING_IMAGE",
            operation_type=OperationType.LINK,
            status=OperationStatus.SUCCESS,
            timestamp=now - timedelta(hours=1),
        )
    )

  rules = SwapRules(
      lookback_window="30d", eviction_kpi="ctr", grace_period_minutes=1
  )

  res = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )

  assert res["status"] == "SUCCESS"
  remove_op = next(op for op in res["operations"] if op["type"] == "remove")
  # All KPIs tie. Legacy assets (like Asset 0) should be preferred for eviction!
  assert "ag1~0~PORTRAIT_MARKETING_IMAGE" in remove_op["proto"].remove
  assert res["evicted_asset"].asset_id == "0"

  # Now protect Asset 0, it should evict Asset 2 (older than Asset 1)
  protected_list.append("0")
  res2 = KPIEvictionService.get_operations_for_group(
      g_client=mock_g_client,
      clean_customer_id="1234567890",
      asset_group_id="ag1",
      field_type="PORTRAIT_MARKETING_IMAGE",
      new_asset_resource_name="customers/1234567890/assets/new123",
      rules=rules,
  )
  remove_op2 = next(op for op in res2["operations"] if op["type"] == "remove")
  assert "ag1~2~PORTRAIT_MARKETING_IMAGE" in remove_op2["proto"].remove
