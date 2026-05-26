import { useEffect, useState } from 'react';
import api from '../api/client';

const TYPE_CONFIG = {
  info:     { bg: '#eff6ff', border: '#3b82f6', color: '#1d4ed8', icon: 'ℹ️' },
  warning:  { bg: '#fffbeb', border: '#f59e0b', color: '#92400e', icon: '⚠️' },
  critical: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', icon: '🚨' },
};

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem('hd_dismissed_announcements') || '[]'));
    } catch { return new Set(); }
  });

  useEffect(() => {
    api.get('/announcements')
      .then(res => setAnnouncements(res.data))
      .catch(() => {});
  }, []);

  const dismiss = (id) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    sessionStorage.setItem('hd_dismissed_announcements', JSON.stringify([...next]));
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="announcement-stack">
      {visible.map(a => {
        const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.info;
        return (
          <div
            key={a.id}
            className="announcement-banner"
            style={{ background: cfg.bg, borderLeftColor: cfg.border }}
          >
            <span className="announcement-icon">{cfg.icon}</span>
            <span className="announcement-message" style={{ color: cfg.color }}>
              {a.message}
            </span>
            <button
              className="announcement-dismiss"
              style={{ color: cfg.color }}
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss announcement"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
