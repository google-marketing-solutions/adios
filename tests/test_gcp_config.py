"""Unit tests for GCP Config & Data Residency Wrapper."""

import pytest
from src.core.gcp_config import GCPConfig, DataResidencyViolationError, ALLOWED_EU_REGIONS


def test_valid_eu_region() -> None:
    config = GCPConfig(location="europe-west1")
    assert config.location == "europe-west1"

    config_w3 = GCPConfig(location="europe-west3")
    assert config_w3.location == "europe-west3"


def test_invalid_region_raises_error() -> None:
    with pytest.raises(DataResidencyViolationError) as exc_info:
        GCPConfig(location="us-central1")

    assert "Data Residency Violation" in str(exc_info.value)
    assert "us-central1" in str(exc_info.value)


def test_allowed_regions_set() -> None:
    assert "europe-west1" in ALLOWED_EU_REGIONS
    assert "europe-west3" in ALLOWED_EU_REGIONS
