# ForestGuard AI

**Real-Time Forest Fire and Smoke Detection System**  
Built with YOLO11 · FastAPI · React · TypeScript

---

## Project Structure

```
ForestGuard-AI/
├── src/                    ← React + Vite + TypeScript frontend
│   ├── App.tsx             ← Main orchestrator
│   ├── types.ts            ← Shared TypeScript types
│   ├── api.ts              ← FastAPI client
│   ├── mockDetection.ts    ← UI-testing mock detections
│   ├── verificationEngine.ts
│   └── components/
│       ├── Header.tsx
│       ├── CameraFeed.tsx
│       ├── StatusPanel.tsx
│       ├── IncidentLog.tsx
│       └── SummaryBar.tsx
├── backend/                ← FastAPI + Ultralytics
│   ├── main.py
│   ├── detector.py
│   ├── verification.py
│   ├── alert_manager.py
│   └── requirements.txt
├── models/
│   └── best.pt             ← place trained model here
├── captured_alerts/        ← auto-created; stores frame screenshots
└── README.md
```

---

## Quick Start (Windows)

### 1 — Frontend

```powershell
# From the ForestGuard-AI directory
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
npm run dev
# Open http://localhost:5173
```

### 2 — Backend (separate terminal)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: **http://localhost:8000/docs**

---

## Mock Mode

If the backend is unavailable or `models/best.pt` does not exist, the
frontend automatically enters **Mock Mode**.

- An amber **"SIMULATED"** badge is shown over the video feed.
- Random fire/smoke detections are generated for UI evaluation only.
- Mock detections are **never** stored as real incident records.

---

## Placing the Trained Model

After Kaggle training completes:

1. Download `best.pt` from the Kaggle run output.
2. Copy it to `ForestGuard-AI/models/best.pt`.
3. Hot-reload the model (no restart needed):

```powershell
Invoke-WebRequest -Method POST http://localhost:8000/api/model/reload
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Backend + model status |
| `POST` | `/api/detect` | Submit a base64 frame for detection |
| `GET`  | `/api/incidents` | List session incidents |
| `POST` | `/api/incidents/{id}/review` | Mark incident as reviewed |
| `POST` | `/api/incidents/{id}/dismiss` | Dismiss as false alarm |
| `DELETE` | `/api/incidents` | Clear session |
| `POST` | `/api/model/reload` | Hot-reload model from disk |

---

## Detection Classes

| ID | Class | Bounding box colour |
|----|-------|---------------------|
| 0  | Smoke | Muted olive `#777B55` |
| 1  | Fire  | Muted brick red `#A34E40` |

---

## Temporal Verification

A detection is **confirmed** when it appears in at least **3 out of 5**
consecutive analysed frames.

Configurable via environment variables:

```powershell
$env:FORESTGUARD_VERIFY_FRAMES = "3"    # detections needed
$env:FORESTGUARD_VERIFY_WINDOW = "5"    # sliding window size
$env:FORESTGUARD_FIRE_CONF     = "0.45"
$env:FORESTGUARD_SMOKE_CONF    = "0.40"
$env:FORESTGUARD_MODEL_PATH    = "..\models\best.pt"
```

---

## Important Notes

- Detection results are **not** scientifically verified fire events.
- Temporal verification reduces false positives but does not eliminate them.
- Confidence scores, frame history, and operator review are tools for human
  judgement, not autonomous decisions.
- This is a college project demonstration system, not a production safety system.
