import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account Access', 'Other'];

export default function NewTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', category: '' });
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/tickets', form);
      const ticketId = res.data.id;

      // Upload image if selected
      if (image) {
        const fd = new FormData();
        fd.append('image', image);
        await api.post(`/tickets/${ticketId}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate(`/tickets/${ticketId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page narrow">
      <div className="page-header">
        <h2>New Ticket</h2>
      </div>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={handleSubmit} className="form-card">
        <label>Title *
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Brief summary of the issue" required />
        </label>
        <label>Description *
          <textarea rows={6} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the issue in detail…" required />
        </label>
        <div className="form-row">
          <label>Priority
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>Category
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label>Attach Image <span className="optional">(optional, max 5MB)</span>
          <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
