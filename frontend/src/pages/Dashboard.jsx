import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  pending: '#8b5cf6',
  resolved: '#10b981',
  closed: '#6b7280',
};

const PRIORITY_COLOR = {
  low: '#10b981',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

const PERIODS = [
  { key: '7d',  label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

function StatTile({ label, value, sub }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}

function formatHours(hours) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function statusLabel(s) {
  return s.replace('_', ' ');
}

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/dashboard?period=${period}`)
      .then(res => { setData(res.data); setError(null); })
      .catch(err => setError(err.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [period]);

  const isAdmin = user?.role === 'admin';

  if (loading && !data) return <div className="page"><p>Loading dashboard…</p></div>;
  if (error) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!data) return null;

  const periodLabel = PERIODS.find(p => p.key === period)?.label.toLowerCase() || period;

  const statusChart = data.by_status.map(r => ({
    name: statusLabel(r.status),
    value: r.count,
    color: STATUS_COLOR[r.status] || '#94a3b8',
  }));

  const priorityChart = ['low', 'medium', 'high', 'urgent'].map(p => {
    const row = data.by_priority.find(r => r.priority === p);
    return { name: p, count: row ? row.count : 0, color: PRIORITY_COLOR[p] };
  });

  return (
    <div className="page dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <div className="period-toggle">
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`filter-btn ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-row">
        <StatTile
          label="My active tickets"
          value={data.personal.my_active}
          sub={`${data.personal.my_open} open · ${data.personal.my_in_progress} in progress · ${data.personal.my_pending} pending`}
        />
        <StatTile
          label="My resolved"
          value={data.personal.my_resolved}
          sub={periodLabel}
        />
        <StatTile
          label="Team open queue"
          value={data.team.team_active}
          sub={`${data.team.team_resolved_period} resolved ${periodLabel}`}
        />
        <StatTile
          label="Unassigned"
          value={data.team.team_unassigned}
          sub={data.team.team_unassigned > 0 ? 'awaiting pickup' : 'all caught up'}
        />
      </div>

      <div className="chart-row">
        <div className="card chart-card">
          <h3>Tickets by status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusChart}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {statusChart.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3>Active by priority</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={priorityChart}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count">
                {priorityChart.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3>Top active categories</h3>
          {data.by_category.length === 0 ? (
            <div className="empty-state-sm">No active tickets.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.by_category} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="category" width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <h3>Agent productivity ({periodLabel})</h3>
          {data.agent_stats.length === 0 ? (
            <div className="empty-state-sm">No agents on the roster.</div>
          ) : (
            <div className="table-scroll">
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th className="num">Active</th>
                    <th className="num">Resolved</th>
                    <th className="num">Avg resolution</th>
                    <th className="num">Avg 1st response</th>
                    <th className="num">Avg gap between updates</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agent_stats.map(a => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td className="num">{a.active_count}</td>
                      <td className="num">{a.resolved_count}</td>
                      <td className="num">{formatHours(a.avg_resolution_hours)}</td>
                      <td className="num">{formatHours(a.avg_first_response_hours)}</td>
                      <td className="num">{formatHours(a.avg_update_gap_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted-note">
            "Resolved" and the three averages are scoped to {periodLabel}. "Active" is always the current open queue.
          </p>
        </div>
      )}

      <div className="dashboard-footer">
        <Link to="/tickets" className="btn secondary">Go to ticket list →</Link>
      </div>
    </div>
  );
}
