"""Unit tests for Image Aspect Ratio Validator."""

import io
import pytest
from PIL import Image
from src.campaign.aspect_ratio_validator import (
    inspect_image_aspect_ratio,
    UnsupportedAspectRatioError,
)


def create_test_image(width: int, height: int, fmt: str = "PNG") -> bytes:
    """Helper function creating in-memory image bytes."""
    img = Image.new("RGB", (width, height), color="green")
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_square_aspect_ratio_1_to_1() -> None:
    img_bytes = create_test_image(1000, 1000)
    info = inspect_image_aspect_ratio(img_bytes)
    assert info.ratio_type == "SQUARE"
    assert info.field_type == "SQUARE_MARKETING_IMAGE"
    assert info.width == 1000
    assert info.height == 1000


def test_landscape_aspect_ratio_1_91_to_1() -> None:
    img_bytes = create_test_image(1200, 628)  # 1200/628 = 1.9108
    info = inspect_image_aspect_ratio(img_bytes)
    assert info.ratio_type == "LANDSCAPE"
    assert info.field_type == "MARKETING_IMAGE"


def test_portrait_aspect_ratio_4_to_5() -> None:
    img_bytes = create_test_image(1000, 1250)  # 1000/1250 = 0.8
    info = inspect_image_aspect_ratio(img_bytes)
    assert info.ratio_type == "PORTRAIT"
    assert info.field_type == "PORTRAIT_MARKETING_IMAGE"


def test_unsupported_aspect_ratio_raises_error() -> None:
    img_bytes = create_test_image(1920, 1080)  # 16:9 banner ratio
    with pytest.raises(UnsupportedAspectRatioError) as exc_info:
        inspect_image_aspect_ratio(img_bytes)

    assert "Unsupported aspect ratio" in str(exc_info.value)
    assert "No automatic resizing is allowed" in str(exc_info.value)
