// ForestGuard AI – Main application
// Orchestrates webcam capture, backend communication, verification logic and UI state.

import { useRef, useState, useEffect, useCallback } from 'react';
import './App.css';

import Header       from './components/Header';
import CameraFeed   from './components/CameraFeed';
import StatusPanel  from './components/StatusPanel';
import IncidentLog  from './components/IncidentLog';
import SummaryBar   from './components/SummaryBar';

import { getHealth, detectFrame, reviewIncident, dismissIncident } from './api';
import { generateMockDetection } from './mockDetection';
import { VerificationEngine }   from './verificationEngine';
import type {
  HealthResponse, Detection, Incident, SessionStats,
  FireStatus, SmokeStatus, CameraStatus,
  DetectionConfig,
} from './types';
import { DEFAULT_CONFIG } from './types';
import { AlertTriangle } from 'lucide-react';

function uuid() {
  return crypto.randomUUID();
}

export default function App() {
  // Backend / mode
  const [health,     setHealth]     = useState<HealthResponse | null>(null);
  const [backendErr, setBackendErr] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);

  // Camera
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('offline');

  // Detection state
  const [detections,      setDetections]      = useState<Detection[]>([]);
  const [fireStatus,      setFireStatus]       = useState<FireStatus>('none');
  const [smokeStatus,     setSmokeStatus]      = useState<SmokeStatus>('none');
  const [fireFrameCount,  setFireFrameCount]   = useState(0);
  const [smokeFrameCount, setSmokeFrameCount]  = useState(0);

  // Incidents & stats
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats,     setStats]     = useState<SessionStats>({
    totalEvents: 0, fireDetections: 0, smokeDetections: 0, confirmedIncidents: 0,
  });

  // Config
  const [config] = useState<DetectionConfig>(DEFAULT_CONFIG);

  // Verification engine
  const engineRef = useRef(new VerificationEngine({
    framesNeeded: DEFAULT_CONFIG.verificationFramesNeeded,
    windowSize:   DEFAULT_CONFIG.verificationWindowSize,
  }));

  // Inference loop
  const inferenceRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmedFired = useRef({ fire: false, smoke: false });

  // ── Health check ──────────────────────────────────────────────────────────

  const checkHealth = useCallback(async () => {
    try {
      const h = await getHealth();
      setHealth(h);
      setBackendErr(null);
      setIsMockMode(!h.modelLoaded);
    } catch {
      setHealth(null);
      setBackendErr('Backend unavailable. Detection is not operational.');
      setIsMockMode(true);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 10_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  // ── Frame processing ──────────────────────────────────────────────────────

  const processFrameRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const c = document.createElement('canvas');
    c.width  = video.videoWidth  || 640;
    c.height = video.videoHeight || 480;
    c.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);

    let result;
    try {
      result = isMockMode ? generateMockDetection() : await detectFrame(dataUrl);
    } catch (err) {
      console.warn('[ForestGuard] Inference error:', err);
      return;
    }

    const rawDets = result.detections.filter(d =>
      d.confidence >= (d.class === 'fire' ? config.fireConfidenceThreshold : config.smokeConfidenceThreshold)
    );
    setDetections(rawDets);

    const fireHit  = rawDets.some(d => d.class === 'fire');
    const smokeHit = rawDets.some(d => d.class === 'smoke');
    const fireConf  = rawDets.find(d => d.class === 'fire')?.confidence ?? 0;
    const smokeConf = rawDets.find(d => d.class === 'smoke')?.confidence ?? 0;

    const fState = engineRef.current.processFrame('fire',  fireHit,  fireConf);
    const sState = engineRef.current.processFrame('smoke', smokeHit, smokeConf);

    const fHits = fState.windowHits.filter(Boolean).length;
    const sHits = sState.windowHits.filter(Boolean).length;
    setFireFrameCount(fHits);
    setSmokeFrameCount(sHits);

    setFireStatus(
      fState.status === 'confirmed' ? 'confirmed' :
      fState.status === 'verifying' ? 'potential' : 'none'
    );
    setSmokeStatus(
      sState.status === 'confirmed' ? 'confirmed' :
      sState.status === 'verifying' ? 'detected'  : 'none'
    );

    const log = (cls: 'fire' | 'smoke', confirmed: boolean, conf: number) => {
      if (confirmed && !confirmedFired.current[cls]) {
        confirmedFired.current[cls] = true;
        const inc: Incident = {
          id: uuid(), timestamp: new Date(), detectionType: cls,
          confidence: conf, status: 'confirmed', capturedFrame: dataUrl,
          framesSeen: cls === 'fire' ? fHits : sHits,
        };
        setIncidents(prev => [inc, ...prev]);
        setStats(prev => ({
          totalEvents:        prev.totalEvents + 1,
          fireDetections:     cls === 'fire'  ? prev.fireDetections + 1  : prev.fireDetections,
          smokeDetections:    cls === 'smoke' ? prev.smokeDetections + 1 : prev.smokeDetections,
          confirmedIncidents: prev.confirmedIncidents + 1,
        }));
      }
      if (!confirmed) confirmedFired.current[cls] = false;
    };

    log('fire',  fState.status === 'confirmed', fireConf);
    log('smoke', sState.status === 'confirmed', smokeConf);
  }, [isMockMode, config]);

  useEffect(() => { processFrameRef.current = processFrame; }, [processFrame]);

  // ── Camera ────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraStatus('initializing');
    engineRef.current.resetAll();
    confirmedFired.current = { fire: false, smoke: false };
    setDetections([]); setFireStatus('none'); setSmokeStatus('none');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus('monitoring');
    } catch (err) {
      console.error('[ForestGuard] Camera error:', err);
      setCameraStatus('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (inferenceRef.current) clearInterval(inferenceRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus('offline');
    setDetections([]); setFireStatus('none'); setSmokeStatus('none');
    engineRef.current.resetAll();
    confirmedFired.current = { fire: false, smoke: false };
  }, []);

  // Inference loop – runs when monitoring
  useEffect(() => {
    if (cameraStatus !== 'monitoring') return;
    if (inferenceRef.current) clearInterval(inferenceRef.current);
    inferenceRef.current = setInterval(() => processFrameRef.current?.(), config.inferenceIntervalMs);
    return () => { if (inferenceRef.current) clearInterval(inferenceRef.current); };
  }, [cameraStatus, config.inferenceIntervalMs]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { return () => { stopCamera(); }; }, []);

  // ── Incident actions ──────────────────────────────────────────────────────

  const handleReview = async (id: string) => {
    if (!isMockMode) { try { await reviewIncident(id); } catch { /* fallback */ } }
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'reviewed' as const } : i));
  };

  const handleDismiss = async (id: string) => {
    if (!isMockMode) { try { await dismissIncident(id); } catch { /* fallback */ } }
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'dismissed' as const } : i));
    const target = incidents.find(i => i.id === id);
    if (target) confirmedFired.current[target.detectionType] = false;
  };

  const handleClear = () => {
    setIncidents([]);
    setStats({ totalEvents: 0, fireDetections: 0, smokeDetections: 0, confirmedIncidents: 0 });
    engineRef.current.resetAll();
    confirmedFired.current = { fire: false, smoke: false };
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Header health={health} isMockMode={isMockMode} />
      <main className="main-content">

        {backendErr && (
          <div className="banner error">
            <AlertTriangle size={16} />
            <span>
              <strong>Backend unavailable.</strong> {backendErr}&nbsp;
              UI is operating in mock mode for layout evaluation only.
            </span>
          </div>
        )}

        {isMockMode && !backendErr && (
          <div className="banner mock">
            <AlertTriangle size={16} />
            <span>
              <strong>Mock mode active.</strong> The model is not yet loaded.
              Detections are simulated for UI evaluation and are not real incidents.
            </span>
          </div>
        )}

        <div className="monitoring-grid">
          <CameraFeed
            isRunning={cameraStatus === 'monitoring' || cameraStatus === 'initializing'}
            isMockMode={isMockMode}
            detections={detections}
            onStart={startCamera}
            onStop={stopCamera}
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
            ref={null}
          />
          <StatusPanel
            fireStatus={fireStatus}
            smokeStatus={smokeStatus}
            cameraStatus={cameraStatus}
            fireFrameCount={fireFrameCount}
            smokeFrameCount={smokeFrameCount}
            verifyNeeded={config.verificationFramesNeeded}
            verifyWindow={config.verificationWindowSize}
          />
        </div>

        <IncidentLog
          incidents={incidents}
          onReview={handleReview}
          onDismiss={handleDismiss}
          onClear={handleClear}
        />

        <SummaryBar stats={stats} />

      </main>
    </>
  );
}
