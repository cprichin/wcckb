import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const STATUS_COLOR = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  pending: '#8b5cf6',
  resolved: '#10b981',
  closed: '#6b7280',
};

export default function AdminTrash() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/tickets/trash')
      .then(res => { setTickets(res.data); setError(null); })
      .catch(err => setError(err.response?.data?.error || 'Failed to load trash'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const restore = async (id) => {
    await api.post(`/tickets/${id}/restore`);
    load();
  };

  const purge = async (ticket) => {
    if (!window.confirm(`Permanently delete ticket #${ticket.id} ("${ticket.title}")? This removes the ticket, all its comments, attachments (including uploaded files), and KB links. This cannot be undone.`)) return;
    await api.delete(`/tickets/${ticket.id}/purge`);
    load();
  };

  if (loading) return <div className="page"><p>Loading trash…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Trash</h2>
          <p className="muted-note" style={{ marginTop: 4 }}>
            Tickets soft-deleted by admins. Restore to bring them back, or permanently delete to remove forever.
          </p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {tickets.length === 0 ? (
        <div className="empty-state">Trash is empty.</div>
      ) : (
        <div className="ticket-list">
          {tickets.map(ticket => (
            <div key={ticket.id} className="ticket-card trash-card">
              <div className="ticket-card-left">
                <span className="ticket-id">#{ticket.id}</span>
                <div className="ticket-title">
                  <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                </div>
                <div className="ticket-meta">
                  {ticket.category && <span className="tag">{ticket.category}</span>}
                  <span>by {ticket.creator_name || 'unknown'}</span>
                  {ticket.assignee_name && <span>→ {ticket.assignee_name}</span>}
                  <span>deleted {new Date(ticket.deleted_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="ticket-card-right">
                <span className="badge" style={{ background: STATUS_COLOR[ticket.status] || '#94a3b8' }}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <button className="btn secondary" onClick={() => restore(ticket.id)}>Restore</button>
                <button className="btn danger" onClick={() => purge(ticket)}>Delete forever</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
