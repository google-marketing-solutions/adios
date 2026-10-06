"""Google Cloud Storage (GCS) Service Wrapper for Adios 2.0."""

import logging
from google.cloud import storage
from src.core.gcp_config import GCPConfig, default_gcp_config

logger = logging.getLogger("adios.core.gcs_service")


class GCSService:

  def __init__(self, config: GCPConfig = default_gcp_config) -> None:
    self.config = config
    self._client: storage.Client | None = None

  @property
  def client(self) -> storage.Client:
    if self._client is None:
      self._client = storage.Client(project=self.config.project_id)
    return self._client

  def upload_image(
      self,
      file_token: str,
      filename: str,
      content_type: str,
      image_bytes: bytes,
  ) -> str:
    """Uploads an image to GCS under the /assets/ prefix and returns the gs:// URI."""
    bucket_name = self.config.gcs_bucket
    blob_name = f"assets/{file_token}_{filename}"

    logger.info(
        f"Uploading image to gs://{bucket_name}/{blob_name} (Type:"
        f" {content_type})"
    )
    try:
      bucket = self.client.bucket(bucket_name)
      blob = bucket.blob(blob_name)
      blob.upload_from_string(image_bytes, content_type=content_type)
      gcs_uri = f"gs://{bucket_name}/{blob_name}"
      logger.info(f"Successfully uploaded image: {gcs_uri}")
      return gcs_uri
    except Exception as err:
      logger.error(f"Failed to upload image to GCS: {err}")
      raise

  def download_image(self, gcs_uri: str) -> bytes:
    """Downloads image raw bytes from a gs:// URI."""
    if not gcs_uri.startswith("gs://"):
      logger.error(f"Invalid GCS URI provided: {gcs_uri}")
      raise ValueError(f"Invalid GCS URI: {gcs_uri}")

    try:
      parts = gcs_uri.replace("gs://", "").split("/", 1)
      if len(parts) < 2:
        raise ValueError("Missing object name in URI")

      bucket_name, blob_name = parts[0], parts[1]
      logger.info(f"Downloading image from gs://{bucket_name}/{blob_name}")

      bucket = self.client.bucket(bucket_name)
      blob = bucket.blob(blob_name)
      data = blob.download_as_bytes()
      logger.info(
          f"Successfully downloaded image from gs://{bucket_name}/{blob_name}"
      )
      return data
    except Exception as err:
      logger.error(f"Failed to download image from GCS ({gcs_uri}): {err}")
      raise

  def download_image_by_token(self, file_token: str) -> tuple[bytes, str]:
    """Downloads image bytes and returns (bytes, original_filename) using the file_token prefix."""
    bucket_name = self.config.gcs_bucket
    prefix = f"assets/{file_token}_"

    logger.info(f"Listing blobs in {bucket_name} with prefix {prefix}")
    try:
      bucket = self.client.bucket(bucket_name)
      blobs = list(bucket.list_blobs(prefix=prefix))
      if not blobs:
        logger.error(f"No blobs found matching prefix: {prefix}")
        raise ValueError(f"No image found for token {file_token}")

      blob = blobs[0]
      # Extract filename by removing the prefix
      filename = blob.name.split(prefix, 1)[1]

      logger.info(
          f"Downloading image bytes from gs://{bucket_name}/{blob.name}"
      )
      data = blob.download_as_bytes()
      return data, filename
    except Exception as err:
      logger.error(f"Failed to download image by token {file_token}: {err}")
      raise


# Singleton instance
default_gcs_service = GCSService()
