// ForestGuard AI – Camera panel with live feed + canvas overlay
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Video, VideoOff } from 'lucide-react';
import type { Detection } from '../types';

export interface CameraHandle {
  captureFrame(): string | null;
}

interface CameraFeedProps {
  isRunning: boolean;
  isMockMode: boolean;
  detections: Detection[];
  onStart(): void;
  onStop(): void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/** Draws detection bounding boxes onto a canvas overlay */
function drawDetections(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Keep canvas dimensions in sync with the video's rendered size
  canvas.width  = video.videoWidth  || video.clientWidth;
  canvas.height = video.videoHeight || video.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;

  for (const det of detections) {
    const { x1, y1, x2, y2 } = det.bbox;
    const px1 = x1 * W;
    const py1 = y1 * H;
    const pw  = (x2 - x1) * W;
    const ph  = (y2 - y1) * H;

    const isFire = det.class === 'fire';
    const color  = isFire ? '#A34E40' : '#777B55';

    // Box
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.strokeRect(px1, py1, pw, ph);

    // Label background
    const label = `${det.class.toUpperCase()}  ${(det.confidence * 100).toFixed(0)}%`;
    ctx.font = 'bold 12px "IBM Plex Sans", system-ui';
    const textW = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(px1, py1 - 20, textW + 10, 20);

    // Label text
    ctx.fillStyle = '#fff';
    ctx.fillText(label, px1 + 5, py1 - 5);
  }
}

const CameraFeed = forwardRef<CameraHandle, CameraFeedProps>(
  ({ isRunning, isMockMode, detections, onStart, onStop, videoRef }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Expose captureFrame to parent
    useImperativeHandle(ref, () => ({
      captureFrame(): string | null {
        const video = videoRef.current;
        if (!video || !isRunning) return null;
        const c = document.createElement('canvas');
        c.width  = video.videoWidth;
        c.height = video.videoHeight;
        c.getContext('2d')?.drawImage(video, 0, 0);
        return c.toDataURL('image/jpeg', 0.85);
      },
    }));

    // Redraw boxes whenever detections change
    useEffect(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (!isRunning) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      drawDetections(canvas, video, detections);
    }, [detections, isRunning, videoRef]);

    return (
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Live Camera Feed</span>
          <div className="panel-controls">
            {!isRunning ? (
              <button className="btn btn-primary btn-sm" onClick={onStart}>
                <Video size={14} />
                Start Camera
              </button>
            ) : (
              <button className="btn btn-sm" onClick={onStop}>
                <VideoOff size={14} />
                Stop Camera
              </button>
            )}
          </div>
        </div>

        <div className="video-wrapper">
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            muted
            style={{ display: isRunning ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} style={{ display: isRunning ? 'block' : 'none' }} />

          {/* Placeholder when camera is off */}
          {!isRunning && (
            <div className="camera-placeholder">
              <div className="camera-placeholder-icon">
                <VideoOff size={48} color="#888" />
              </div>
              <h3>Camera feed inactive</h3>
              <p>Start the camera to begin real-time fire and smoke monitoring.</p>
            </div>
          )}

          {/* Mock mode badge */}
          {isRunning && isMockMode && (
            <div className="mock-badge">⚠ Simulated — Mock Mode</div>
          )}
        </div>

        <div className="camera-statusbar">
          <div className="cam-info">
            <span className={`status-dot ${isRunning ? 'green' : 'grey'}`} />
            <span>{isRunning ? 'Live' : 'Offline'}</span>
          </div>
          {isRunning && (
            <span style={{ fontSize: 11 }}>
              {detections.length > 0
                ? `${detections.length} detection${detections.length !== 1 ? 's' : ''} in frame`
                : 'No detections in current frame'}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CameraFeed.displayName = 'CameraFeed';
export default CameraFeed;
