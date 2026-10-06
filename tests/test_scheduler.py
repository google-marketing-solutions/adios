from dataclasses import dataclass, field
from typing import Any
from unittest import mock

from src.campaign import scheduler
from src.campaign.scheduler import process_scheduled_jobs
from src.core.firestore_service import (
    OperationType,
    ScheduledJobDocument,
    ScheduledJobStatus,
)


@dataclass
class _FakeMutateResult:
  resource_name: str


@dataclass
class _FakeMutateResponse:
  results: list[_FakeMutateResult]


@dataclass
class _FakeAssetGroupAssetCreate:
  asset_group: str = ""
  asset: str = ""
  field_type: int = 0


@dataclass
class _FakeAssetGroupAssetOperation:
  remove: str = ""
  create: _FakeAssetGroupAssetCreate = field(
      default_factory=_FakeAssetGroupAssetCreate
  )


@dataclass
class _FakeMutateAssetGroupAssetsRequest:
  customer_id: str = ""
  partial_failure: bool = False
  operations: list[_FakeAssetGroupAssetOperation] = field(default_factory=list)


@dataclass
class _FakeAssetFieldTypeEnum:
  MARKETING_IMAGE: int = 1


@dataclass
class _FakeEnums:
  AssetFieldTypeEnum: _FakeAssetFieldTypeEnum = field(
      default_factory=_FakeAssetFieldTypeEnum
  )


class _AssetGroupAssetServiceSpec:

  def mutate_asset_group_assets(
      self, request: _FakeMutateAssetGroupAssetsRequest
  ) -> _FakeMutateResponse:
    raise NotImplementedError


class _GoogleAdsClientSpec:
  enums: _FakeEnums = _FakeEnums()

  def get_service(self, name: str) -> _AssetGroupAssetServiceSpec:
    raise NotImplementedError

  def get_type(self, name: str) -> Any:
    raise NotImplementedError


def _get_fake_type(name: str) -> Any:
  if name == "AssetGroupAssetOperation":
    return _FakeAssetGroupAssetOperation()
  if name == "MutateAssetGroupAssetsRequest":
    return _FakeMutateAssetGroupAssetsRequest()
  raise ValueError(f"Unexpected type requested: {name}")


def test_process_scheduled_jobs_dry_run() -> None:
  job = ScheduledJobDocument(
      job_id="job1",
      customer_id="1234567890",
      asset_group_ids=["ag1"],
      asset_name="end_test",
      image_gcs_uri="gs://bucket/assets/end_test.png",
      asset_id="123456",
      end_date="2026-07-20",
      status=ScheduledJobStatus.LINKED,
  )

  with mock.patch.object(
      scheduler,
      "default_firestore_service",
      autospec=True,
      spec_set=True,
  ) as mock_firestore:
    mock_firestore.get_pending_end_jobs.return_value = [job]

    res = process_scheduled_jobs(as_of_date="2026-07-21", dry_run=True)
    assert res["dry_run"] is True
    assert "job1" in res["pending_end_ids"]


def test_process_scheduled_jobs_end_date_auth_and_restore_rollback() -> None:
  job_end = ScheduledJobDocument(
      job_id="job_rollback",
      customer_id="1234567890",
      asset_group_ids=["ag_restore"],
      asset_name="scheduled.png",
      image_gcs_uri="gs://bucket/assets/scheduled.png",
      asset_id="scheduled_123",
      field_type="MARKETING_IMAGE",
      end_date="2026-07-20",
      status=ScheduledJobStatus.LINKED,
      refresh_token="restore_refresh_token_xyz",
      evicted_asset_ids={"ag_restore": "original_456"},
  )

  mock_aga_service = mock.create_autospec(
      _AssetGroupAssetServiceSpec, instance=True, spec_set=True
  )
  mock_aga_res_unlink = _FakeMutateResponse(
      results=[
          _FakeMutateResult(
              resource_name="customers/1234567890/assetGroupAssets/ag_restore~scheduled_123~MARKETING_IMAGE"
          )
      ]
  )
  mock_aga_res_add = _FakeMutateResponse(
      results=[
          _FakeMutateResult(
              resource_name="customers/1234567890/assetGroupAssets/ag_restore~original_456~MARKETING_IMAGE"
          )
      ]
  )
  mock_aga_service.mutate_asset_group_assets.side_effect = [
      mock_aga_res_unlink,
      mock_aga_res_add,
  ]

  mock_g_client = mock.create_autospec(
      _GoogleAdsClientSpec, instance=True, spec_set=True
  )
  mock_g_client.enums = _FakeEnums()
  mock_g_client.get_service.return_value = mock_aga_service
  mock_g_client.get_type.side_effect = _get_fake_type

  with (
      mock.patch.object(
          scheduler,
          "default_firestore_service",
          autospec=True,
          spec_set=True,
      ) as mock_firestore,
      mock.patch.object(
          scheduler.default_auth_provider,
          "get_google_ads_client",
          autospec=True,
          spec_set=True,
          return_value=mock_g_client,
      ) as mock_get_client,
  ):
    mock_firestore.get_pending_end_jobs.return_value = [job_end]

    res = process_scheduled_jobs(as_of_date="2026-07-21")

    assert res["unlinked_jobs"] == 1

    # Verify Auth Isolation: Called with refresh_token_override
    mock_get_client.assert_called_once_with(
        refresh_token_override="restore_refresh_token_xyz"
    )

    # Verify 2 calls to mutate_asset_group_assets (1 Unlink, 1 Restore)
    calls = mock_aga_service.mutate_asset_group_assets.call_args_list
    assert len(calls) == 2

    # First call is Unlink (REMOVE)
    assert hasattr(calls[0][1]["request"].operations[0], "remove")
    assert (
        calls[0][1]["request"].operations[0].remove
        == "customers/1234567890/assetGroupAssets/ag_restore~scheduled_123~MARKETING_IMAGE"
    )
    assert calls[0][1]["request"].partial_failure is True

    # Second call is Restore (ADD)
    assert hasattr(calls[1][1]["request"].operations[0], "create")
    assert (
        calls[1][1]["request"].operations[0].create.asset
        == "customers/1234567890/assets/original_456"
    )
    assert calls[1][1]["request"].partial_failure is True

    # Verify 2 LinkOperations saved (1 UNLINK SUCCESS, 1 LINK SUCCESS for Restore)
    assert mock_firestore.save_link_operation.call_count == 2
    saved_ops = [
        c[0][0] for c in mock_firestore.save_link_operation.call_args_list
    ]
    unlink_op = next(
        o for o in saved_ops if o.operation_type == OperationType.UNLINK
    )
    link_op = next(
        o for o in saved_ops if o.operation_type == OperationType.LINK
    )

    assert unlink_op.status == "SUCCESS"
    assert link_op.status == "SUCCESS"
    assert link_op.google_ads_asset_id == "original_456"

    # Verify job marked as COMPLETED_UNLINKED
    mock_firestore.update_scheduled_job.assert_called_once_with(
        "1234567890",
        "job_rollback",
        {"status": ScheduledJobStatus.COMPLETED_UNLINKED},
    )


def test_process_scheduled_jobs_end_date_idempotent_retry() -> None:
  job_end = ScheduledJobDocument(
      job_id="job_retry",
      customer_id="1234567890",
      asset_group_ids=["ag_restore"],
      asset_name="scheduled.png",
      image_gcs_uri="gs://bucket/assets/scheduled.png",
      asset_id="scheduled_123",
      field_type="MARKETING_IMAGE",
      end_date="2026-07-20",
      status=ScheduledJobStatus.LINKED,
      evicted_asset_ids={"ag_restore": "original_456"},
  )

  # Simulate Unlink throwing ALREADY UNLINKED error
  class MockGoogleAdsException(Exception):
    pass

  exc = MockGoogleAdsException(
      "Resource not found: MUTATE_ERROR_ENTITY_DOES_NOT_EXIST"
  )

  mock_aga_service = mock.create_autospec(
      _AssetGroupAssetServiceSpec, instance=True, spec_set=True
  )
  mock_aga_res_add = _FakeMutateResponse(
      results=[
          _FakeMutateResult(
              resource_name="customers/1234567890/assetGroupAssets/ag_restore~original_456~MARKETING_IMAGE"
          )
      ]
  )
  mock_aga_service.mutate_asset_group_assets.side_effect = [
      exc,
      mock_aga_res_add,
  ]

  mock_g_client = mock.create_autospec(
      _GoogleAdsClientSpec, instance=True, spec_set=True
  )
  mock_g_client.enums = _FakeEnums()
  mock_g_client.get_service.return_value = mock_aga_service
  mock_g_client.get_type.side_effect = _get_fake_type

  with (
      mock.patch.object(
          scheduler,
          "default_firestore_service",
          autospec=True,
          spec_set=True,
      ) as mock_firestore,
      mock.patch.object(
          scheduler.default_auth_provider,
          "get_google_ads_client",
          autospec=True,
          spec_set=True,
          return_value=mock_g_client,
      ),
  ):
    mock_firestore.get_pending_end_jobs.return_value = [job_end]

    res = process_scheduled_jobs(as_of_date="2026-07-21")

    assert res["unlinked_jobs"] == 1

    # Verify Restore STILL executes!
    calls = mock_aga_service.mutate_asset_group_assets.call_args_list
    assert len(calls) == 2

    # Verify NO Unlink operations saved as FAILED, but 1 LinkOperation saved as SUCCESS
    mock_firestore.save_link_operation.assert_called_once()
    saved_op = mock_firestore.save_link_operation.call_args[0][0]
    assert saved_op.operation_type == OperationType.LINK
    assert saved_op.status == "SUCCESS"

    mock_firestore.update_scheduled_job.assert_called_once_with(
        "1234567890",
        "job_retry",
        {"status": ScheduledJobStatus.COMPLETED_UNLINKED},
    )


def test_process_scheduled_jobs_end_date_failure_retains_linked_status() -> (
    None
):
  job_end = ScheduledJobDocument(
      job_id="job_fail",
      customer_id="1234567890",
      asset_group_ids=["ag_fail"],
      asset_name="scheduled.png",
      image_gcs_uri="gs://bucket/assets/scheduled.py",
      asset_id="scheduled_123",
      field_type="MARKETING_IMAGE",
      end_date="2026-07-20",
      status=ScheduledJobStatus.LINKED,
      refresh_token="fail_refresh_token",
  )

  with (
      mock.patch.object(
          scheduler,
          "default_firestore_service",
          autospec=True,
          spec_set=True,
      ) as mock_firestore,
      mock.patch.object(
          scheduler.default_auth_provider,
          "get_google_ads_client",
          autospec=True,
          spec_set=True,
          side_effect=ValueError("OAuth auth failed"),
      ),
  ):
    mock_firestore.get_pending_end_jobs.return_value = [job_end]

    res = process_scheduled_jobs(as_of_date="2026-07-21")

    assert res["failed_jobs"] == 1
    assert res["details"][0]["status"] == "FAILED"
    assert "OAuth auth failed" in res["details"][0]["error"]

    mock_firestore.update_scheduled_job.assert_called_once_with(
        "1234567890", "job_fail", {"error_message": "OAuth auth failed"}
    )
