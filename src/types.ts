// ForestGuard AI – Shared TypeScript types

export type DetectionClass = 'smoke' | 'fire';

export type VerificationStatus = 'detecting' | 'verifying' | 'confirmed' | 'dismissed' | 'reviewed';

export type CameraStatus = 'offline' | 'initializing' | 'monitoring' | 'error';

export type FireStatus = 'none' | 'potential' | 'confirmed';
export type SmokeStatus = 'none' | 'detected' | 'confirmed';

/** A single bounding box returned by the model */
export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A single detection result from one frame */
export interface Detection {
  class: DetectionClass;
  confidence: number;
  bbox: BoundingBox;
  verificationStatus: VerificationStatus;
  frameCount?: number; // how many consecutive frames this was seen
}

/** A recorded incident in the session log */
export interface Incident {
  id: string;
  timestamp: Date;
  detectionType: DetectionClass;
  confidence: number;
  status: VerificationStatus;
  capturedFrame?: string; // base64 data URL of captured frame
  framesSeen?: number;    // how many frames triggered this
}

/** Summary stats for the current session */
export interface SessionStats {
  totalEvents: number;
  fireDetections: number;
  smokeDetections: number;
  confirmedIncidents: number;
}

/** Backend health check response */
export interface HealthResponse {
  status: 'ok' | 'error';
  modelLoaded: boolean;
  modelName: string;
}

/** Response from POST /api/detect */
export interface DetectResponse {
  detections: Detection[];
  frameProcessedAt: string;
  isMock?: boolean;
}

/** Config values (tweakable thresholds) */
export interface DetectionConfig {
  fireConfidenceThreshold: number;   // 0–1
  smokeConfidenceThreshold: number;  // 0–1
  verificationFramesNeeded: number;  // e.g. 3
  verificationWindowSize: number;    // e.g. 5
  inferenceIntervalMs: number;       // e.g. 300
}

export const DEFAULT_CONFIG: DetectionConfig = {
  fireConfidenceThreshold: 0.45,
  smokeConfidenceThreshold: 0.40,
  verificationFramesNeeded: 3,
  verificationWindowSize: 5,
  inferenceIntervalMs: 300,
};
