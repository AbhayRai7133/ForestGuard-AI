"""
ForestGuard AI – Temporal verification engine (backend)
Mirrors the frontend logic so the backend can also independently assess
whether a detection stream constitutes a confirmed incident.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Literal

DetectionClass = Literal["fire", "smoke"]
VerificationStatus = Literal["detecting", "verifying", "confirmed", "dismissed", "reviewed"]


@dataclass
class ClassVerificationState:
    cls: DetectionClass
    window: Deque[bool] = field(default_factory=deque)
    max_confidence: float = 0.0
    status: VerificationStatus = "detecting"


class VerificationEngine:
    """
    Sliding-window temporal verification.

    A detection is *confirmed* when at least `frames_needed` out of the last
    `window_size` frames contain a detection above the confidence threshold.
    """

    def __init__(self, frames_needed: int = 3, window_size: int = 5) -> None:
        self.frames_needed = frames_needed
        self.window_size   = window_size
        self._states: dict[DetectionClass, ClassVerificationState] = {}

    def _get_state(self, cls: DetectionClass) -> ClassVerificationState:
        if cls not in self._states:
            self._states[cls] = ClassVerificationState(
                cls=cls, window=deque(maxlen=self.window_size)
            )
        return self._states[cls]

    def process_frame(
        self, cls: DetectionClass, detected: bool, confidence: float
    ) -> VerificationStatus:
        state = self._get_state(cls)

        # Do not revert a manually resolved status
        if state.status in ("dismissed", "reviewed"):
            return state.status

        state.window.append(detected)
        if detected and confidence > state.max_confidence:
            state.max_confidence = confidence

        hits = sum(state.window)
        if hits >= self.frames_needed:
            state.status = "confirmed"
        elif hits > 0:
            state.status = "verifying"
        else:
            state.status = "detecting"

        return state.status

    def set_status(self, cls: DetectionClass, status: VerificationStatus) -> None:
        """Allow operator overrides (review / dismiss)."""
        state = self._get_state(cls)
        state.status = status
        if status in ("dismissed", "reviewed"):
            state.window.clear()
            state.max_confidence = 0.0

    def get_status(self, cls: DetectionClass) -> VerificationStatus:
        return self._get_state(cls).status

    def get_hit_count(self, cls: DetectionClass) -> int:
        return sum(self._get_state(cls).window)

    def reset(self, cls: DetectionClass) -> None:
        self._states.pop(cls, None)

    def reset_all(self) -> None:
        self._states.clear()
