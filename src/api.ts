// ForestGuard AI – API client
// All communication with the FastAPI backend is centralised here.

import type { HealthResponse, DetectResponse } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/** Check backend availability and model status */
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  const data = await res.json();
  // Normalise snake_case from FastAPI → camelCase expected by the frontend
  return {
    status:      data.status,
    modelLoaded: data.model_loaded ?? data.modelLoaded ?? false,
    modelName:   data.model_name  ?? data.modelName   ?? '',
  };
}

/** Send a webcam frame (base64 JPEG) for detection */
export async function detectFrame(imageDataUrl: string): Promise<DetectResponse> {
  // Strip the data URL prefix – backend expects raw base64
  const base64 = imageDataUrl.split(',')[1];
  const res = await fetch(`${BASE_URL}/api/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Detection failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Retrieve current session incidents from backend */
export async function getIncidents() {
  const res = await fetch(`${BASE_URL}/api/incidents`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.status}`);
  return res.json();
}

/** Mark an incident as reviewed */
export async function reviewIncident(id: string) {
  const res = await fetch(`${BASE_URL}/api/incidents/${id}/review`, {
    method: 'POST',
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Review failed: ${res.status}`);
  return res.json();
}

/** Dismiss a false alarm */
export async function dismissIncident(id: string) {
  const res = await fetch(`${BASE_URL}/api/incidents/${id}/dismiss`, {
    method: 'POST',
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Dismiss failed: ${res.status}`);
  return res.json();
}
