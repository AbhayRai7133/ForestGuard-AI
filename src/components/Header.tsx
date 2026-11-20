// ForestGuard AI – Header component
import { useEffect, useState } from 'react';
import type { HealthResponse } from '../types';

interface HeaderProps {
  health: HealthResponse | null;
  isMockMode: boolean;
}

export default function Header({ health, isMockMode }: HeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  const backendOk = health?.status === 'ok';
  const modelOk   = health?.modelLoaded === true;

  return (
    <header className="header">
      <div className="header-left">
        <span className="wordmark">
          Forest<span>Guard</span> AI
        </span>
        <span className="subtitle">Forest Monitoring System</span>
      </div>

      <div className="header-right">
        {/* Backend status */}
        <div className="header-pill">
          <span className={`status-dot ${backendOk ? 'green' : 'red'}`} />
          <span>{backendOk ? 'Backend online' : 'Backend offline'}</span>
        </div>

        {/* Model status */}
        <div className="header-pill">
          <span className={`status-dot ${isMockMode ? 'amber' : modelOk ? 'green' : 'red'}`} />
          <span>
            {isMockMode ? 'Mock mode' : modelOk ? 'Model loaded' : 'Model unavailable'}
          </span>
        </div>

        {/* Date / time */}
        <span className="header-time">{dateStr} &nbsp;·&nbsp; {timeStr}</span>
      </div>
    </header>
  );
}
