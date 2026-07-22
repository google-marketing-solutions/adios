"""Unit tests for GCSService."""

from unittest.mock import MagicMock, patch
import pytest
from src.core.gcs_service import GCSService
from src.core.gcp_config import GCPConfig


def test_upload_image_success() -> None:
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()

    mock_client.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob

    config = GCPConfig(project_id="test-proj", gcs_bucket="test-bucket")
    service = GCSService(config=config)
    service._client = mock_client

    file_token = "token-123"
    filename = "dog.png"
    content_type = "image/png"
    image_bytes = b"dummy_bytes"

    uri = service.upload_image(file_token, filename, content_type, image_bytes)

    assert uri == "gs://test-bucket/assets/token-123_dog.png"
    mock_client.bucket.assert_called_once_with("test-bucket")
    mock_bucket.blob.assert_called_once_with("assets/token-123_dog.png")
    mock_blob.upload_from_string.assert_called_once_with(
        image_bytes,
        content_type=content_type,
    )


def test_download_image_success() -> None:
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()

    mock_client.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob
    mock_blob.download_as_bytes.return_value = b"dummy_bytes"

    config = GCPConfig(project_id="test-proj", gcs_bucket="test-bucket")
    service = GCSService(config=config)
    service._client = mock_client

    gcs_uri = "gs://test-bucket/assets/token-123_dog.png"

    downloaded = service.download_image(gcs_uri)

    assert downloaded == b"dummy_bytes"
    mock_client.bucket.assert_called_once_with("test-bucket")
    mock_bucket.blob.assert_called_once_with("assets/token-123_dog.png")
    mock_blob.download_as_bytes.assert_called_once()


def test_download_image_by_token_success() -> None:
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.name = "assets/token-123_dog.png"
    mock_blob.download_as_bytes.return_value = b"dummy_bytes"

    mock_client.bucket.return_value = mock_bucket
    mock_bucket.list_blobs.return_value = [mock_blob]

    config = GCPConfig(project_id="test-proj", gcs_bucket="test-bucket")
    service = GCSService(config=config)
    service._client = mock_client

    image_bytes, filename = service.download_image_by_token("token-123")

    assert image_bytes == b"dummy_bytes"
    assert filename == "dog.png"
    mock_bucket.list_blobs.assert_called_once_with(prefix="assets/token-123_")


def test_download_image_by_token_not_found() -> None:
    mock_client = MagicMock()
    mock_bucket = MagicMock()

    mock_client.bucket.return_value = mock_bucket
    mock_bucket.list_blobs.return_value = []

    config = GCPConfig(project_id="test-proj", gcs_bucket="test-bucket")
    service = GCSService(config=config)
    service._client = mock_client

    with pytest.raises(ValueError) as exc_info:
        service.download_image_by_token("token-123")

    assert "No image found for token token-123" in str(exc_info.value)


def test_download_image_malformed_uri() -> None:
    config = GCPConfig(project_id="test-proj", gcs_bucket="test-bucket")
    service = GCSService(config=config)
    service._client = MagicMock()

    with pytest.raises(ValueError) as exc_info:
        service.download_image("invalid-uri")

    assert "Invalid GCS URI" in str(exc_info.value)


def test_download_image_missing_object() -> None:
    config = GCPConfig(project_id="test-proj", gcs_bucket="test-bucket")
    service = GCSService(config=config)
    service._client = MagicMock()

    with pytest.raises(ValueError) as exc_info:
        service.download_image("gs://bucket-without-slash")

    assert "Missing object name in URI" in str(exc_info.value)


def test_download_image_gcs_exception() -> None:
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()

    mock_client.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob
    mock_blob.download_as_bytes.side_effect = RuntimeError("Connection timeout")

    config = GCPConfig(project_id="test-proj", gcs_bucket="test-bucket")
    service = GCSService(config=config)
    service._client = mock_client

    with pytest.raises(RuntimeError) as exc_info:
        service.download_image("gs://test-bucket/assets/valid.png")

    assert "Connection timeout" in str(exc_info.value)
