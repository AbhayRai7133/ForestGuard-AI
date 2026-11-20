// ForestGuard AI – Detection Status Panel (right column)
import type { FireStatus, SmokeStatus, CameraStatus } from '../types';

interface StatusPanelProps {
  fireStatus: FireStatus;
  smokeStatus: SmokeStatus;
  cameraStatus: CameraStatus;
  fireFrameCount?: number;
  smokeFrameCount?: number;
  verifyNeeded: number;
  verifyWindow: number;
}

function FireStatusBlock({ status, frameCount, verifyNeeded, verifyWindow }: {
  status: FireStatus;
  frameCount?: number;
  verifyNeeded: number;
  verifyWindow: number;
}) {
  const dotClass = status === 'confirmed' ? 'si-confirmed' : status === 'potential' ? 'si-potential' : 'si-none';
  const label =
    status === 'confirmed' ? 'Fire detection confirmed' :
    status === 'potential' ? 'Potential fire detected' :
    'No fire detected';

  return (
    <div className="status-block">
      <div className="status-block-label">Fire Status</div>
      <div className="status-indicator">
        <span className={`status-indicator-dot ${dotClass}`} />
        <span className="status-indicator-text">{label}</span>
      </div>
      {status !== 'none' && frameCount !== undefined && (
        <div className="status-sub">
          {frameCount}/{verifyNeeded} detections in last {verifyWindow} frames
        </div>
      )}
    </div>
  );
}

function SmokeStatusBlock({ status, frameCount, verifyNeeded, verifyWindow }: {
  status: SmokeStatus;
  frameCount?: number;
  verifyNeeded: number;
  verifyWindow: number;
}) {
  const dotClass = status === 'confirmed' ? 'si-confirmed' : status === 'detected' ? 'si-detected' : 'si-none';
  const label =
    status === 'confirmed' ? 'Smoke detection confirmed' :
    status === 'detected'  ? 'Smoke detected' :
    'No smoke detected';

  return (
    <div className="status-block">
      <div className="status-block-label">Smoke Status</div>
      <div className="status-indicator">
        <span className={`status-indicator-dot ${dotClass}`} />
        <span className="status-indicator-text">{label}</span>
      </div>
      {status !== 'none' && frameCount !== undefined && (
        <div className="status-sub">
          {frameCount}/{verifyNeeded} detections in last {verifyWindow} frames
        </div>
      )}
    </div>
  );
}

function CameraStatusBlock({ status }: { status: CameraStatus }) {
  const dotClass =
    status === 'monitoring'   ? 'si-monitoring' :
    status === 'initializing' ? 'si-init'       :
    'si-offline';

  const label =
    status === 'monitoring'   ? 'Monitoring active' :
    status === 'initializing' ? 'Initializing…'    :
    status === 'error'        ? 'Camera error'      :
    'Camera offline';

  return (
    <div className="status-block">
      <div className="status-block-label">Camera Status</div>
      <div className="status-indicator">
        <span className={`status-indicator-dot ${dotClass}`} />
        <span className="status-indicator-text">{label}</span>
      </div>
    </div>
  );
}

export default function StatusPanel({
  fireStatus, smokeStatus, cameraStatus,
  fireFrameCount, smokeFrameCount,
  verifyNeeded, verifyWindow,
}: StatusPanelProps) {
  return (
    <div className="status-panel">
      <FireStatusBlock
        status={fireStatus}
        frameCount={fireFrameCount}
        verifyNeeded={verifyNeeded}
        verifyWindow={verifyWindow}
      />
      <SmokeStatusBlock
        status={smokeStatus}
        frameCount={smokeFrameCount}
        verifyNeeded={verifyNeeded}
        verifyWindow={verifyWindow}
      />
      <CameraStatusBlock status={cameraStatus} />
    </div>
  );
}
