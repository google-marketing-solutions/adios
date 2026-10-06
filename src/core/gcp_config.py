"""Centralized GCP Client Config Wrapper & EU Data Residency Enforcement.

Ensures all GCP services (Vertex AI, Cloud Storage, etc.) are strictly locked
to authorized European regions (europe-west1 or europe-west3).
"""

import logging
import os
from typing import Final

logger = logging.getLogger("adios.core.gcp_config")

# Allowed EU regions for compliance and data residency
ALLOWED_EU_REGIONS: Final[set[str]] = {"europe-west1", "europe-west3"}
DEFAULT_EU_REGION: Final[str] = "europe-west1"


class DataResidencyViolationError(ValueError):
  """Raised when a non-EU region is configured or passed to a GCP service call."""

  pass


class GCPConfig:
  """Manages GCP credentials, project settings, and EU regional residency constraints."""

  def __init__(
      self,
      project_id: str | None = None,
      location: str | None = None,
      gcs_bucket: str | None = None,
      firestore_database_id: str | None = None,
  ) -> None:
    self.project_id = project_id or os.getenv(
        "GCP_PROJECT_ID", "adios-2026-prod"
    )
    self.gcs_bucket = gcs_bucket or os.getenv("GCS_BUCKET", "adios-assets-eu")
    self.firestore_database_id = firestore_database_id or os.getenv(
        "FIRESTORE_DATABASE_ID", "(default)"
    )

    raw_location = location or os.getenv("GCP_LOCATION", DEFAULT_EU_REGION)
    self.location = self.validate_region(raw_location)

  @staticmethod
  def validate_region(region: str) -> str:
    """Validates that a region string belongs to the authorized EU regions set.

    Raises:
        DataResidencyViolationError: If region is not in ALLOWED_EU_REGIONS.
    """
    normalized = region.strip().lower()
    if normalized not in ALLOWED_EU_REGIONS:
      err_msg = (
          f"Data Residency Violation: Region '{region}' is not authorized. "
          f"Must be one of {sorted(list(ALLOWED_EU_REGIONS))}."
      )
      logger.error(err_msg)
      raise DataResidencyViolationError(err_msg)
    return normalized


# Singleton default config instance
default_gcp_config = GCPConfig()
