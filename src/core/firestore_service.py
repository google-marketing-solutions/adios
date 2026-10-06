"""Firestore Service Wrapper for Adios 2.0.

Provides schemas and multi-tenant persistence for assets, link operations,
protected assets, and scheduled jobs.
"""

from datetime import datetime, timezone
from enum import Enum
import logging
from typing import Any
from google.cloud import firestore
from pydantic import BaseModel, ConfigDict, Field
from src.core.gcp_config import GCPConfig, default_gcp_config

logger = logging.getLogger("adios.core.firestore_service")


class OperationType(str, Enum):
  LINK = "LINK"
  UNLINK = "UNLINK"


class OperationStatus(str, Enum):
  SUCCESS = "SUCCESS"
  FAILED = "FAILED"


class ScheduledJobStatus(str, Enum):
  LINKED = "LINKED"
  COMPLETED_UNLINKED = "COMPLETED_UNLINKED"
  FAILED = "FAILED"


# Pydantic Models for Schema Enforcement
class AssetDocument(BaseModel):
  model_config = ConfigDict(use_enum_values=True)

  google_ads_asset_id: str = Field(
      ..., description="Google Ads Asset Resource ID"
  )
  customer_id: str
  gcs_uri: str
  asset_name: str
  asset_group_ids: list[str] = Field(default_factory=list)
  created_at: datetime = Field(
      default_factory=lambda: datetime.now(timezone.utc)
  )


class LinkOperationDocument(BaseModel):
  model_config = ConfigDict(use_enum_values=True)

  operation_id: str = Field(
      ..., description="Unique UUID for the operation audit log"
  )
  operation_type: OperationType
  customer_id: str
  asset_group_id: str
  google_ads_asset_id: str
  google_ads_asset_group_asset_id: str | None = Field(
      default=None, description="Resource ID returned by API, e.g. 10101~12345"
  )
  status: OperationStatus
  error_message: str | None = None
  timestamp: datetime = Field(
      default_factory=lambda: datetime.now(timezone.utc)
  )


class ProtectedAssetDocument(BaseModel):
  model_config = ConfigDict(use_enum_values=True)

  google_ads_asset_id: str
  customer_id: str
  is_protected: bool
  updated_at: datetime = Field(
      default_factory=lambda: datetime.now(timezone.utc)
  )


class ScheduledJobDocument(BaseModel):
  model_config = ConfigDict(use_enum_values=True)

  job_id: str
  customer_id: str
  asset_group_ids: list[str]
  asset_name: str
  image_gcs_uri: str
  asset_id: str | None = None
  evicted_asset_ids: dict[str, str] | None = None
  refresh_token: str | None = None
  end_date: str
  field_type: str = "MARKETING_IMAGE"
  status: ScheduledJobStatus
  error_message: str | None = None
  swap_rules: dict[str, Any] | None = None
  created_at: datetime = Field(
      default_factory=lambda: datetime.now(timezone.utc)
  )
  updated_at: datetime = Field(
      default_factory=lambda: datetime.now(timezone.utc)
  )


class FirestoreService:

  def __init__(self, config: GCPConfig = default_gcp_config) -> None:
    self.config = config
    self._client: firestore.Client | None = None

  @property
  def client(self) -> firestore.Client:
    if self._client is None:
      self._client = firestore.Client(
          project=self.config.project_id,
          database=self.config.firestore_database_id,
      )
    return self._client

  # Assets
  def save_asset(self, asset: AssetDocument) -> None:
    logger.info(
        f"Saving asset {asset.google_ads_asset_id} for customer"
        f" {asset.customer_id}"
    )
    self.client.collection("assets").document(asset.google_ads_asset_id).set(
        asset.model_dump()
    )

  def get_asset(
      self, customer_id: str, google_ads_asset_id: str
  ) -> AssetDocument | None:
    doc_ref = self.client.collection("assets").document(google_ads_asset_id)
    doc = doc_ref.get()
    if not doc.exists:
      return None
    data = doc.to_dict()
    if data and data.get("customer_id") == customer_id:
      return AssetDocument(**data)
    return None

  # Link Operations
  def save_link_operation(self, op: LinkOperationDocument) -> None:
    logger.info(
        f"Logging {op.operation_type} op {op.operation_id} for asset"
        f" {op.google_ads_asset_id}"
    )
    self.client.collection("asset_group_links").document(op.operation_id).set(
        op.model_dump()
    )

  def get_last_linked_asset(
      self, customer_id: str, asset_group_id: str
  ) -> AssetDocument | None:
    logger.info(
        f"Finding last successfully linked asset for group {asset_group_id}"
    )
    docs = (
        self.client.collection("asset_group_links")
        .where("customer_id", "==", customer_id)
        .where("asset_group_id", "==", asset_group_id)
        .where("operation_type", "==", OperationType.LINK.value)
        .where("status", "==", OperationStatus.SUCCESS.value)
        .stream()
    )
    ops = [LinkOperationDocument(**doc.to_dict()) for doc in docs]
    if not ops:
      return None
    ops.sort(key=lambda x: x.timestamp, reverse=True)
    return self.get_asset(customer_id, ops[0].google_ads_asset_id)

  # Protected Assets
  def toggle_protection(
      self, customer_id: str, asset_id: str, is_protected: bool
  ) -> None:
    logger.info(f"Toggling protection for asset {asset_id} to {is_protected}")
    doc = ProtectedAssetDocument(
        google_ads_asset_id=asset_id,
        customer_id=customer_id,
        is_protected=is_protected,
        updated_at=datetime.now(timezone.utc),
    )
    self.client.collection("protected_assets").document(asset_id).set(
        doc.model_dump()
    )

  def get_protected_assets(self, customer_id: str) -> list[str]:
    docs = (
        self.client.collection("protected_assets")
        .where("customer_id", "==", customer_id)
        .where("is_protected", "==", True)
        .stream()
    )
    return [
        doc.to_dict()["google_ads_asset_id"]
        for doc in docs
        if doc.to_dict().get("google_ads_asset_id")
    ]

  def get_link_history_for_group(
      self, customer_id: str, asset_group_id: str, limit: int = 100
  ) -> list[LinkOperationDocument]:
    docs = (
        self.client.collection("asset_group_links")
        .where("customer_id", "==", customer_id)
        .where("asset_group_id", "==", asset_group_id)
        .where("operation_type", "==", OperationType.LINK.value)
        .where("status", "==", OperationStatus.SUCCESS.value)
        .stream()
    )
    ops = [LinkOperationDocument(**doc.to_dict()) for doc in docs]
    ops.sort(key=lambda x: x.timestamp, reverse=True)
    return ops[:limit]

  # Scheduled Jobs
  def create_scheduled_job(self, job: ScheduledJobDocument) -> None:
    logger.info(
        f"Creating scheduled job {job.job_id} for customer {job.customer_id}"
    )
    self.client.collection("scheduled_jobs").document(job.job_id).set(
        job.model_dump()
    )

  def get_scheduled_job(
      self, customer_id: str, job_id: str
  ) -> ScheduledJobDocument | None:
    doc = self.client.collection("scheduled_jobs").document(job_id).get()
    if not doc.exists:
      return None
    data = doc.to_dict()
    if data and data.get("customer_id") == customer_id:
      return ScheduledJobDocument(**data)
    return None

  def update_scheduled_job(
      self, customer_id: str, job_id: str, updates: dict[str, Any]
  ) -> ScheduledJobDocument:
    logger.info(f"Updating scheduled job {job_id}")
    doc_ref = self.client.collection("scheduled_jobs").document(job_id)

    # Verify it exists and belongs to customer
    existing = self.get_scheduled_job(customer_id, job_id)
    if not existing:
      raise ValueError(f"Job {job_id} not found for customer {customer_id}")

    updates["updated_at"] = datetime.now(timezone.utc)

    # Sanitize Enums to their values
    for k, v in updates.items():
      if isinstance(v, Enum):
        updates[k] = v.value

    doc_ref.update(updates)

    # Return fully updated document
    updated_data = existing.model_dump()
    updated_data.update(updates)
    return ScheduledJobDocument(**updated_data)

  def list_scheduled_jobs(self, customer_id: str) -> list[ScheduledJobDocument]:
    docs = (
        self.client.collection("scheduled_jobs")
        .where("customer_id", "==", customer_id)
        .stream()
    )
    jobs = [ScheduledJobDocument(**doc.to_dict()) for doc in docs]
    return sorted(jobs, key=lambda j: j.created_at, reverse=True)

  def get_pending_end_jobs(self, as_of_date: str) -> list[ScheduledJobDocument]:
    docs = (
        self.client.collection("scheduled_jobs")
        .where("status", "==", ScheduledJobStatus.LINKED.value)
        .stream()
    )
    return [
        ScheduledJobDocument(**doc.to_dict())
        for doc in docs
        if doc.to_dict().get("end_date") < as_of_date
    ]


# Singleton instance
default_firestore_service = FirestoreService()
