"""
ForestGuard AI – Detection engine
Wraps the YOLO11 model and returns structured detection results.
"""

from __future__ import annotations

import base64
import io
import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Class indices as defined in the D-Fire dataset
CLASS_NAMES = {0: "smoke", 1: "fire"}


class Detector:
    """
    Loads a YOLO11 model from *model_path* and runs inference on JPEG frames.

    If the model file is absent the detector stays in an unloaded state and
    returns empty results, so the backend can still start and report its
    status accurately.
    """

    def __init__(self, model_path: str | Path) -> None:
        self.model_path = Path(model_path)
        self.model = None
        self.loaded = False
        self._try_load()

    # ── Loading ───────────────────────────────────────────────────────────────

    def _try_load(self) -> None:
        if not self.model_path.exists():
            logger.warning(
                "Model file not found at '%s'. "
                "Backend will start without detection capability.",
                self.model_path,
            )
            return
        try:
            from ultralytics import YOLO  # type: ignore

            self.model = YOLO(str(self.model_path))
            self.loaded = True
            logger.info("YOLO model loaded from '%s'.", self.model_path)
        except Exception as exc:
            logger.error("Failed to load model: %s", exc)

    def reload(self) -> bool:
        """Attempt to reload the model (useful after Kaggle training completes)."""
        self.model = None
        self.loaded = False
        self._try_load()
        return self.loaded

    # ── Inference ─────────────────────────────────────────────────────────────

    def detect(
        self,
        image_b64: str,
        fire_threshold: float = 0.45,
        smoke_threshold: float = 0.40,
    ) -> list[dict]:
        """
        Run inference on a base64-encoded JPEG image.

        Returns a list of detection dicts:
          {
            "class":      "fire" | "smoke",
            "confidence": float,          # 0–1
            "bbox": {
              "x1": float,  # normalised 0–1
              "y1": float,
              "x2": float,
              "y2": float
            }
          }
        """
        if not self.loaded or self.model is None:
            return []

        # Decode base64 → numpy RGB array
        try:
            img_bytes = base64.b64decode(image_b64)
            pil_img   = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            frame     = np.array(pil_img)
        except Exception as exc:
            logger.warning("Failed to decode image: %s", exc)
            return []

        h, w = frame.shape[:2]

        try:
            results = self.model(frame, verbose=False)[0]
        except Exception as exc:
            logger.error("Inference error: %s", exc)
            return []

        detections: list[dict] = []
        if results.boxes is None:
            return detections

        for box in results.boxes:
            cls_idx = int(box.cls.item())
            conf    = float(box.conf.item())
            cls_name = CLASS_NAMES.get(cls_idx)

            if cls_name is None:
                continue

            threshold = fire_threshold if cls_name == "fire" else smoke_threshold
            if conf < threshold:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append(
                {
                    "class":      cls_name,
                    "confidence": round(conf, 4),
                    "bbox": {
                        "x1": round(x1 / w, 4),
                        "y1": round(y1 / h, 4),
                        "x2": round(x2 / w, 4),
                        "y2": round(y2 / h, 4),
                    },
                }
            )

        return detections
