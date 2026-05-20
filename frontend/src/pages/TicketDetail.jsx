import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || '';

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [image, setImage] = useState(null);
  const [agents, setAgents] = useState([]);
  const [kbArticles, setKbArticles] = useState([]);
  const [linkArticleId, setLinkArticleId] = useState('');
  const [loading, setLoading] = useState(true);
  const isAgent = ['agent', 'admin'].includes(user?.role);

  const load = () => {
    api.get(`/tickets/${id}`).then(res => setTicket(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (isAgent) {
      api.get('/users/agents').then(res => setAgents(res.data));
      api.get('/kb').then(res => setKbArticles(res.data));
    }
  }, [id]);

  const postComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await api.post(`/tickets/${id}/comments`, { body: comment, is_internal: isInternal });
    setComment('');
    load();
  };

  const uploadImage = async (e) => {
    e.preventDefault();
    if (!image) return;
    const fd = new FormData();
    fd.append('image', image);
    await api.post(`/tickets/${id}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setImage(null);
    load();
  };

  const updateTicket = async (field, value) => {
    await api.patch(`/tickets/${id}`, { [field]: value });
    load();
  };

  const linkKb = async () => {
    if (!linkArticleId) return;
    await api.post(`/tickets/${id}/kb-links`, { article_id: linkArticleId });
    setLinkArticleId('');
    load();
  };

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (!ticket) return <div className="page"><p>Ticket not found.</p></div>;

  return (
    <div className="page">
      <div className="ticket-detail-header">
        <div>
          <span className="ticket-id">#{ticket.id}</span>
          <h2>{ticket.title}</h2>
          <div className="ticket-meta">
            <span>Submitted by {ticket.creator_name}</span>
            <span>{new Date(ticket.created_at).toLocaleString()}</span>
            {ticket.category && <span className="tag">{ticket.category}</span>}
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {/* Main content */}
        <div className="detail-main">
          <div className="card">
            <h3>Description</h3>
            <p className="description-text">{ticket.description}</p>
          </div>

          {/* Attachments */}
          {ticket.attachments?.length > 0 && (
            <div className="card">
              <h3>Attachments</h3>
              <div className="attachment-grid">
                {ticket.attachments.map(a => (
                  <a key={a.id} href={`${API_BASE}/uploads/${a.filename}`} target="_blank" rel="noreferrer">
                    <img src={`${API_BASE}/uploads/${a.filename}`} alt={a.original_name} className="attachment-thumb" />
                    <span>{a.original_name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Upload more images */}
          <div className="card">
            <h3>Add Attachment</h3>
            <form onSubmit={uploadImage} className="inline-form">
              <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
              <button type="submit" className="btn secondary" disabled={!image}>Upload</button>
            </form>
          </div>

          {/* Comments */}
          <div className="card">
            <h3>Comments ({ticket.comments?.length || 0})</h3>
            <div className="comments">
              {ticket.comments?.map(c => (
                <div key={c.id} className={`comment ${c.is_internal ? 'internal' : ''}`}>
                  <div className="comment-header">
                    <strong>{c.author_name}</strong>
                    <span className="role-badge">{c.author_role}</span>
                    {c.is_internal && <span className="internal-tag">Internal Note</span>}
                    <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
            <form onSubmit={postComment} className="comment-form">
              <textarea rows={3} value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…" required />
              {isAgent && (
                <label className="checkbox-label">
                  <input type="checkbox" checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)} />
                  Internal note (not visible to user)
                </label>
              )}
              <button type="submit" className="btn primary">Post Comment</button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          <div className="card">
            <h3>Status</h3>
            {isAgent ? (
              <select value={ticket.status} onChange={e => updateTicket('status', e.target.value)}>
                {['open','in_progress','pending','resolved','closed'].map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            ) : <span className="badge-lg">{ticket.status.replace('_', ' ')}</span>}
          </div>

          <div className="card">
            <h3>Priority</h3>
            {isAgent ? (
              <select value={ticket.priority} onChange={e => updateTicket('priority', e.target.value)}>
                {['low','medium','high','urgent'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : <span className="badge-lg">{ticket.priority}</span>}
          </div>

          {isAgent && (
            <div className="card">
              <h3>Assigned To</h3>
              <select value={ticket.assigned_to || ''}
                onChange={e => updateTicket('assigned_to', e.target.value || null)}>
                <option value="">Unassigned</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* KB Links */}
          <div className="card">
            <h3>Knowledge Base</h3>
            {ticket.kb_links?.length > 0 && (
              <ul className="kb-link-list">
                {ticket.kb_links.map(a => (
                  <li key={a.id}>
                    <a href={`/kb/${a.id}`}>{a.title}</a>
                  </li>
                ))}
              </ul>
            )}
            {isAgent && (
              <div className="inline-form mt">
                <select value={linkArticleId} onChange={e => setLinkArticleId(e.target.value)}>
                  <option value="">Link KB article…</option>
                  {kbArticles.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
                <button className="btn secondary" onClick={linkKb} disabled={!linkArticleId}>Link</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
