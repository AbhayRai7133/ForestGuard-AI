// ForestGuard AI – Temporal verification engine
// Tracks consecutive detections over a sliding window and decides
// when a detection is confirmed vs. still under verification.

import type { DetectionClass, VerificationStatus } from './types';

export interface VerificationState {
  class: DetectionClass;
  windowHits: boolean[];   // last N frames: true = detected, false = not
  status: VerificationStatus;
  maxConfidence: number;
}

export interface VerificationConfig {
  framesNeeded: number;  // detections required within window (e.g. 3)
  windowSize: number;    // sliding window size (e.g. 5)
}

export class VerificationEngine {
  private states: Map<DetectionClass, VerificationState> = new Map();
  private config: VerificationConfig;

  constructor(config: VerificationConfig) {
    this.config = config;
  }

  /** Update config (e.g., user adjusts thresholds) */
  updateConfig(config: VerificationConfig) {
    this.config = config;
  }

  /**
   * Feed one frame's detections for a given class.
   * Returns the new VerificationStatus for that class.
   */
  processFrame(cls: DetectionClass, detected: boolean, confidence: number): VerificationState {
    if (!this.states.has(cls)) {
      this.states.set(cls, {
        class: cls,
        windowHits: [],
        status: 'detecting',
        maxConfidence: 0,
      });
    }

    const state = this.states.get(cls)!;

    // Don't re-verify already-confirmed incidents unless reset
    if (state.status === 'confirmed' || state.status === 'dismissed' || state.status === 'reviewed') {
      return state;
    }

    // Slide the window
    state.windowHits.push(detected);
    if (state.windowHits.length > this.config.windowSize) {
      state.windowHits.shift();
    }

    if (detected && confidence > state.maxConfidence) {
      state.maxConfidence = confidence;
    }

    const hits = state.windowHits.filter(Boolean).length;

    if (hits >= this.config.framesNeeded) {
      state.status = 'confirmed';
    } else if (hits > 0) {
      state.status = 'verifying';
    } else {
      state.status = 'detecting';
    }

    return { ...state };
  }

  /** Get current state for a class */
  getState(cls: DetectionClass): VerificationState | undefined {
    return this.states.get(cls);
  }

  /** Reset a class (e.g., after dismissal) */
  reset(cls: DetectionClass) {
    this.states.delete(cls);
  }

  /** Reset all states */
  resetAll() {
    this.states.clear();
  }
}
