// ForestGuard AI – Incident log table
import { useState } from 'react';
import { Flame, Wind, Eye, XCircle } from 'lucide-react';
import type { Incident } from '../types';

interface IncidentLogProps {
  incidents: Incident[];
  onReview(id: string): void;
  onDismiss(id: string): void;
  onClear(): void;
}

function ConfidenceValue({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls  = pct >= 80 ? 'conf-high' : pct >= 60 ? 'conf-medium' : 'conf-low';
  return <span className={`conf-value ${cls}`}>{pct}%</span>;
}

function StatusBadge({ status }: { status: Incident['status'] }) {
  return (
    <span className={`status-badge ${status}`}>
      {status === 'confirmed'  ? 'Confirmed'    :
       status === 'verifying'  ? 'Under review' :
       status === 'reviewed'   ? 'Reviewed'     :
       status === 'dismissed'  ? 'Dismissed'    :
       'Detecting'}
    </span>
  );
}

function TypeBadge({ type }: { type: Incident['detectionType'] }) {
  return (
    <span className={`type-badge ${type}`}>
      {type === 'fire' ? <Flame size={12} /> : <Wind size={12} />}
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

export default function IncidentLog({ incidents, onReview, onDismiss, onClear }: IncidentLogProps) {
  const [lightbox, setLightbox] = useState<Incident | null>(null);

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Incident Alert Log</span>
        {incidents.length > 0 && (
          <button className="btn btn-sm" onClick={onClear}>
            Clear session history
          </button>
        )}
      </div>

      {incidents.length === 0 ? (
        <div className="incident-empty">
          No incidents recorded during this session.
        </div>
      ) : (
        <div className="incident-table-wrapper">
          <table className="incident-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Frame</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {inc.timestamp.toLocaleTimeString('en-IN', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                    })}
                  </td>
                  <td><TypeBadge type={inc.detectionType} /></td>
                  <td><ConfidenceValue value={inc.confidence} /></td>
                  <td><StatusBadge status={inc.status} /></td>
                  <td>
                    {inc.capturedFrame ? (
                      <img
                        className="thumb-img"
                        src={inc.capturedFrame}
                        alt={`${inc.detectionType} capture`}
                        onClick={() => setLightbox(inc)}
                      />
                    ) : (
                      <span className="thumb-none">—</span>
                    )}
                  </td>
                  <td>
                    {inc.status !== 'reviewed' && inc.status !== 'dismissed' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm"
                          title="Mark as reviewed"
                          onClick={() => onReview(inc.id)}
                        >
                          <Eye size={12} />
                          Review
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          title="Dismiss as false alarm"
                          onClick={() => onDismiss(inc.id)}
                        >
                          <XCircle size={12} />
                          Dismiss
                        </button>
                      </div>
                    )}
                    {(inc.status === 'reviewed' || inc.status === 'dismissed') && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.capturedFrame} alt="Captured frame" />
            <div className="lightbox-meta">
              <span>
                {lightbox.detectionType.toUpperCase()} ·{' '}
                {Math.round(lightbox.confidence * 100)}% confidence ·{' '}
                {lightbox.timestamp.toLocaleTimeString('en-IN', { hour12: false })}
              </span>
              <button className="btn btn-sm" onClick={() => setLightbox(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
