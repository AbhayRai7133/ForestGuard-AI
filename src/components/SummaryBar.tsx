// ForestGuard AI – Session summary bar
import type { SessionStats } from '../types';

export default function SummaryBar({ stats }: { stats: SessionStats }) {
  return (
    <div className="summary-bar">
      <div className="summary-cell">
        <span className="summary-label">Total Events</span>
        <span className="summary-value">{stats.totalEvents}</span>
      </div>
      <div className="summary-cell">
        <span className="summary-label">Fire Detections</span>
        <span className="summary-value fire">{stats.fireDetections}</span>
      </div>
      <div className="summary-cell">
        <span className="summary-label">Smoke Detections</span>
        <span className="summary-value smoke">{stats.smokeDetections}</span>
      </div>
      <div className="summary-cell">
        <span className="summary-label">Confirmed Incidents</span>
        <span className="summary-value confirm">{stats.confirmedIncidents}</span>
      </div>
    </div>
  );
}
