"""
Native Aspect Ratio Inspector & Dimension Validator.

Enforces strict Google Ads PMax image aspect ratio rules without automatic resizing:
- Landscape (1.91:1, ±0.02) -> MARKETING_IMAGE
- Square (1:1, ±0.01) -> SQUARE_MARKETING_IMAGE
- Portrait (4:5, ±0.01) -> PORTRAIT_MARKETING_IMAGE
- Tall Portrait (9:16, ±0.01) -> TALL_PORTRAIT_MARKETING_IMAGE
"""

import io
import logging
from typing import Final, NamedTuple
from PIL import Image

logger = logging.getLogger("adios.campaign.aspect_ratio_validator")


class AspectRatioInfo(NamedTuple):
    ratio_type: str
    field_type: str
    width: int
    height: int
    aspect_ratio: float


class UnsupportedAspectRatioError(ValueError):
    """Raised when an uploaded image does not conform to 1.91:1, 1:1, or 4:5 native ratios."""

    pass


# Target ratios and allowed tolerances
LANDSCAPE_RATIO: Final[float] = 1.91
SQUARE_RATIO: Final[float] = 1.0
PORTRAIT_RATIO: Final[float] = 0.8  # 4/5 = 0.8
TALL_PORTRAIT_RATIO: Final[float] = 0.5625  # 9/16 = 0.5625

LANDSCAPE_TOLERANCE: Final[float] = 0.02
SQUARE_TOLERANCE: Final[float] = 0.01
PORTRAIT_TOLERANCE: Final[float] = 0.01
TALL_PORTRAIT_TOLERANCE: Final[float] = 0.01


def inspect_image_aspect_ratio(image_bytes: bytes) -> AspectRatioInfo:
    """Inspects raw image binary data and determines its aspect ratio classification.

    Args:
        image_bytes: Raw bytes of the image file.

    Returns:
        AspectRatioInfo tuple with ratio_type, field_type, width, height, aspect_ratio.

    Raises:
        UnsupportedAspectRatioError: If aspect ratio is outside allowed limits.
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            width, height = img.size
    except Exception as exc:
        raise UnsupportedAspectRatioError(f"Failed to read image header: {exc}") from exc

    if width <= 0 or height <= 0:
        raise UnsupportedAspectRatioError("Invalid image dimensions (width or height <= 0).")

    ratio = width / height

    # Check 1.91:1 Landscape
    if abs(ratio - LANDSCAPE_RATIO) <= LANDSCAPE_TOLERANCE:
        return AspectRatioInfo(
            ratio_type="LANDSCAPE",
            field_type="MARKETING_IMAGE",
            width=width,
            height=height,
            aspect_ratio=round(ratio, 4),
        )

    # Check 1:1 Square
    if abs(ratio - SQUARE_RATIO) <= SQUARE_TOLERANCE:
        return AspectRatioInfo(
            ratio_type="SQUARE",
            field_type="SQUARE_MARKETING_IMAGE",
            width=width,
            height=height,
            aspect_ratio=round(ratio, 4),
        )

    # Check 4:5 Portrait (0.8)
    if abs(ratio - PORTRAIT_RATIO) <= PORTRAIT_TOLERANCE:
        return AspectRatioInfo(
            ratio_type="PORTRAIT",
            field_type="PORTRAIT_MARKETING_IMAGE",
            width=width,
            height=height,
            aspect_ratio=round(ratio, 4),
        )

    # Check 9:16 Tall Portrait (0.5625)
    if abs(ratio - TALL_PORTRAIT_RATIO) <= TALL_PORTRAIT_TOLERANCE:
        return AspectRatioInfo(
            ratio_type="TALL_PORTRAIT",
            field_type="TALL_PORTRAIT_MARKETING_IMAGE",
            width=width,
            height=height,
            aspect_ratio=round(ratio, 4),
        )

    err_msg = (
        f"Unsupported aspect ratio [{width}:{height} -> ratio {ratio:.2f}]. "
        "No automatic resizing is allowed; please upload native 1.91:1, 1:1, 4:5, or 9:16 images."
    )
    logger.warning(err_msg)
    raise UnsupportedAspectRatioError(err_msg)
