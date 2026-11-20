"""
ForestGuard AI – Incident / Alert manager
Manages the in-memory incident store for the current backend session.
Optionally saves captured frame thumbnails to disk.
"""

from __future__ import annotations

import base64
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

VerificationStatus = Literal["confirmed", "verifying", "detecting", "reviewed", "dismissed"]
DetectionClass     = Literal["fire", "smoke"]


class Incident(BaseModel):
    id:             str       = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp:      datetime  = Field(default_factory=datetime.utcnow)
    detection_type: DetectionClass
    confidence:     float
    status:         VerificationStatus = "confirmed"
    frames_seen:    Optional[int]      = None
    frame_path:     Optional[str]      = None   # relative path to saved thumbnail


class AlertManager:
    """
    In-memory incident store with optional frame capture to disk.

    Call `add_incident()` when the verification engine confirms a detection.
    Use `update_status()` for operator review / dismiss actions.
    """

    def __init__(self, capture_dir: str | Path = "captured_alerts") -> None:
        self.capture_dir = Path(capture_dir)
        self.capture_dir.mkdir(parents=True, exist_ok=True)
        self._incidents: dict[str, Incident] = {}

    # ── Add ───────────────────────────────────────────────────────────────────

    def add_incident(
        self,
        detection_type: DetectionClass,
        confidence: float,
        frames_seen: int,
        frame_b64: Optional[str] = None,
    ) -> Incident:
        """Create and store a new incident. Returns the stored Incident."""
        inc = Incident(
            detection_type=detection_type,
            confidence=confidence,
            frames_seen=frames_seen,
        )

        # Optionally save captured frame to disk
        if frame_b64:
            inc.frame_path = self._save_frame(inc.id, frame_b64)

        self._incidents[inc.id] = inc
        logger.info(
            "Incident recorded: %s %s conf=%.2f",
            inc.id[:8], inc.detection_type, inc.confidence,
        )
        return inc

    def _save_frame(self, incident_id: str, frame_b64: str) -> Optional[str]:
        """Save base64 JPEG to disk. Returns the filename or None on failure."""
        try:
            img_bytes = base64.b64decode(frame_b64)
            filename  = f"{incident_id}.jpg"
            path      = self.capture_dir / filename
            path.write_bytes(img_bytes)
            return filename
        except Exception as exc:
            logger.warning("Failed to save frame for incident %s: %s", incident_id[:8], exc)
            return None

    # ── Query ─────────────────────────────────────────────────────────────────

    def all_incidents(self) -> list[Incident]:
        """Return all incidents, newest first."""
        return sorted(self._incidents.values(), key=lambda i: i.timestamp, reverse=True)

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        return self._incidents.get(incident_id)

    # ── Update ────────────────────────────────────────────────────────────────

    def update_status(
        self, incident_id: str, status: VerificationStatus
    ) -> Optional[Incident]:
        inc = self._incidents.get(incident_id)
        if inc is None:
            return None
        inc.status = status
        return inc

    # ── Clear ─────────────────────────────────────────────────────────────────

    def clear(self) -> None:
        self._incidents.clear()
