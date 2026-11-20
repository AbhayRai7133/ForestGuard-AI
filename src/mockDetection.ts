// ForestGuard AI – Mock detection for UI testing
// Mock detections are ALWAYS visibly labelled as simulated.
// They are never stored as real incident records.

import type { DetectResponse } from './types';

/** Probability of generating a mock detection per frame */
const MOCK_FIRE_PROB  = 0.08;
const MOCK_SMOKE_PROB = 0.14;

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * Returns a simulated DetectResponse for UI testing.
 * Always has `isMock: true` so the UI can display a SIMULATED banner.
 */
export function generateMockDetection(): DetectResponse {
  const detections: DetectResponse['detections'] = [];

  if (Math.random() < MOCK_FIRE_PROB) {
    const x1 = randomInRange(0.1, 0.5);
    const y1 = randomInRange(0.1, 0.5);
    detections.push({
      class: 'fire',
      confidence: randomInRange(0.45, 0.95),
      bbox: { x1, y1, x2: x1 + randomInRange(0.1, 0.3), y2: y1 + randomInRange(0.1, 0.3) },
      verificationStatus: 'detecting',
    });
  }

  if (Math.random() < MOCK_SMOKE_PROB) {
    const x1 = randomInRange(0.05, 0.6);
    const y1 = randomInRange(0.05, 0.4);
    detections.push({
      class: 'smoke',
      confidence: randomInRange(0.40, 0.88),
      bbox: { x1, y1, x2: x1 + randomInRange(0.15, 0.4), y2: y1 + randomInRange(0.15, 0.35) },
      verificationStatus: 'detecting',
    });
  }

  return {
    detections,
    frameProcessedAt: new Date().toISOString(),
    isMock: true,
  };
}
