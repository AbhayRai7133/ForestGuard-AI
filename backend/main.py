"""
ForestGuard AI – FastAPI backend
Exposes detection, incident management and health-check endpoints.

Start with:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from alert_manager import AlertManager, Incident
from detector import CLASS_NAMES, Detector
from verification import VerificationEngine

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
)
logger = logging.getLogger("forestguard")

# ── Configuration (override with env vars) ────────────────────────────────────

MODEL_PATH              = Path(os.getenv("FORESTGUARD_MODEL_PATH",  "../models/best.pt"))
CAPTURE_DIR             = Path(os.getenv("FORESTGUARD_CAPTURE_DIR", "../captured_alerts"))
FIRE_THRESHOLD          = float(os.getenv("FORESTGUARD_FIRE_CONF",   "0.45"))
SMOKE_THRESHOLD         = float(os.getenv("FORESTGUARD_SMOKE_CONF",  "0.40"))
VERIFY_FRAMES_NEEDED    = int(os.getenv("FORESTGUARD_VERIFY_FRAMES", "3"))
VERIFY_WINDOW_SIZE      = int(os.getenv("FORESTGUARD_VERIFY_WINDOW", "5"))

# ── Application singletons ────────────────────────────────────────────────────

detector    = Detector(MODEL_PATH)
verifier    = VerificationEngine(VERIFY_FRAMES_NEEDED, VERIFY_WINDOW_SIZE)
alert_mgr   = AlertManager(CAPTURE_DIR)

app = FastAPI(
    title="ForestGuard AI",
    description="Real-Time Forest Fire and Smoke Detection API",
    version="1.0.0",
)

# Allow requests from the Vite dev server and any localhost origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve captured frames as static files
CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/captured", StaticFiles(directory=str(CAPTURE_DIR)), name="captured")

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float

class DetectionResult(BaseModel):
    cls:                 str   = Field(alias="class")
    confidence:          float
    bbox:                BoundingBox
    verification_status: str

    class Config:
        populate_by_name = True

class DetectRequest(BaseModel):
    image:           str    # base64-encoded JPEG
    fire_threshold:  float  = FIRE_THRESHOLD
    smoke_threshold: float  = SMOKE_THRESHOLD

class DetectResponse(BaseModel):
    detections:          list[DetectionResult]
    frame_processed_at:  str
    is_mock:             bool = False

class HealthResponse(BaseModel):
    status:      Literal["ok", "error"]
    model_loaded: bool
    model_name:   str

class IncidentResponse(BaseModel):
    id:             str
    timestamp:      str
    detection_type: str
    confidence:     float
    status:         str
    frames_seen:    Optional[int]
    frame_url:      Optional[str]

class ActionResponse(BaseModel):
    id:     str
    status: str

# ── Helper ────────────────────────────────────────────────────────────────────

def _serialize_incident(inc: Incident, request_base_url: str = "") -> IncidentResponse:
    frame_url = None
    if inc.frame_path:
        frame_url = f"/captured/{inc.frame_path}"
    return IncidentResponse(
        id             = inc.id,
        timestamp      = inc.timestamp.isoformat(),
        detection_type = inc.detection_type,
        confidence     = inc.confidence,
        status         = inc.status,
        frames_seen    = inc.frames_seen,
        frame_url      = frame_url,
    )

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Returns backend and model availability status."""
    return HealthResponse(
        status       = "ok",
        model_loaded = detector.loaded,
        model_name   = MODEL_PATH.name if detector.loaded else "not loaded",
    )


@app.post("/api/detect", response_model=DetectResponse, tags=["Detection"])
async def detect(req: DetectRequest):
    """
    Accept a base64 JPEG frame, run YOLO inference, apply confidence filtering,
    update the temporal verification engine, and return detection results.
    """
    if not detector.loaded:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded. Training may still be in progress.",
        )

    raw = detector.detect(req.image, req.fire_threshold, req.smoke_threshold)

    results: list[DetectionResult] = []
    for det in raw:
        cls_name = det["class"]
        conf     = det["confidence"]
        detected = True

        # Update verification engine
        v_status = verifier.process_frame(cls_name, detected, conf)

        # Auto-create incident on confirmation
        if v_status == "confirmed":
            hits = verifier.get_hit_count(cls_name)
            # Only log once per continuous confirmed period
            existing = [
                i for i in alert_mgr.all_incidents()
                if i.detection_type == cls_name and i.status == "confirmed"
            ]
            if not existing:
                alert_mgr.add_incident(cls_name, conf, hits, req.image)

        results.append(
            DetectionResult(**{
                "class":               cls_name,
                "confidence":          conf,
                "bbox":                BoundingBox(**det["bbox"]),
                "verification_status": v_status,
            })
        )

    # Notify verifier of non-detected classes (sliding window must include misses)
    detected_classes = {d["class"] for d in raw}
    for cls_name in CLASS_NAMES.values():
        if cls_name not in detected_classes:
            verifier.process_frame(cls_name, False, 0.0)

    return DetectResponse(
        detections         = results,
        frame_processed_at = datetime.utcnow().isoformat(),
    )


@app.get("/api/incidents", response_model=list[IncidentResponse], tags=["Incidents"])
async def get_incidents():
    """Return all incidents for the current session."""
    return [_serialize_incident(i) for i in alert_mgr.all_incidents()]


@app.post("/api/incidents/{incident_id}/review", response_model=ActionResponse, tags=["Incidents"])
async def review_incident(incident_id: str):
    """Mark an incident as operator-reviewed."""
    inc = alert_mgr.update_status(incident_id, "reviewed")
    if inc is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    verifier.set_status(inc.detection_type, "reviewed")
    return ActionResponse(id=incident_id, status="reviewed")


@app.post("/api/incidents/{incident_id}/dismiss", response_model=ActionResponse, tags=["Incidents"])
async def dismiss_incident(incident_id: str):
    """Dismiss an incident as a false alarm."""
    inc = alert_mgr.update_status(incident_id, "dismissed")
    if inc is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    verifier.set_status(inc.detection_type, "dismissed")
    # Reset verification for this class so new detections can be processed
    verifier.reset(inc.detection_type)
    return ActionResponse(id=incident_id, status="dismissed")


@app.delete("/api/incidents", tags=["Incidents"])
async def clear_incidents():
    """Clear all session incidents and reset verification state."""
    alert_mgr.clear()
    verifier.reset_all()
    return {"message": "Session cleared."}


@app.post("/api/model/reload", tags=["System"])
async def reload_model():
    """
    Attempt to reload the YOLO model from disk.
    Call this endpoint after Kaggle training finishes and best.pt is copied.
    """
    success = detector.reload()
    return {
        "model_loaded": success,
        "model_path":   str(MODEL_PATH),
        "message":      "Model loaded successfully." if success else "Model file not found.",
    }
