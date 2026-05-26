import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function TicketList() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce: update the real query 300ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Re-fetch whenever the debounced query changes
  useEffect(() => {
    setLoading(true);
    const params = searchQuery ? { q: searchQuery } : {};
    api.get('/tickets', { params })
      .then(res => setTickets(res.data))
      .finally(() => setLoading(false));
  }, [searchQuery]);

  const filtered = searchQuery
    ? tickets  // already ranked by relevance from the server; keep order
    : filter === 'all'
      ? tickets.filter(t => t.status !== 'closed')
      : tickets.filter(t => t.status === filter);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Tickets</h2>
        <Link to="/tickets/new" className="btn primary">+ New Ticket</Link>
      </div>

      <div className="search-bar">
        <input
          type="search"
          placeholder="Search tickets..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="search-input"
        />
      </div>

      {!searchQuery && (
        <div className="filter-bar">
          {['all', 'open', 'in_progress', 'pending', 'resolved', 'closed'].map(s => (
            <button key={s} className={`filter-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {loading ? <p>Loading...</p> : filtered.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `No tickets found for "${searchQuery}".` : 'No tickets found.'}
        </div>
      ) : (
        <div className="ticket-list">
          {filtered.map(ticket => (
            <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="ticket-card">
              <div className="ticket-card-left">
                <span className="ticket-id">#{ticket.id}</span>
                <div className="ticket-title">{ticket.title}</div>
                <div className="ticket-meta">
                  {ticket.category && <span className="tag">{ticket.category}</span>}
                  <span>by {ticket.creator_name}</span>
                  {ticket.assignee_name && <span>→ {ticket.assignee_name}</span>}
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="ticket-card-right">
                <span className="badge" style={{ background: PRIORITY_COLOR[ticket.priority] }}>
                  {ticket.priority}
                </span>
                <span className="badge" style={{ background: STATUS_COLOR[ticket.status] }}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
