import { useEffect, useState } from 'react';
import api from '../api/client';

const TYPE_COLORS = {
  info:     { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  warning:  { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  critical: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
};

const EMPTY_FORM = { message: '', type: 'info', expires_at: '' };

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/announcements/all')
      .then(res => setAnnouncements(res.data))
      .catch(() => setError('Failed to load announcements'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const startEdit = (a) => {
    setEditId(a.id);
    setForm({
      message:    a.message,
      type:       a.type,
      expires_at: a.expires_at ? new Date(a.expires_at).toISOString().slice(0, 16) : '',
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) { setError('Message is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        message:    form.message.trim(),
        type:       form.type,
        expires_at: form.expires_at || '',
      };
      if (editId) {
        await api.patch(`/announcements/${editId}`, payload);
        flash('Announcement updated.');
        setEditId(null);
      } else {
        await api.post('/announcements', payload);
        flash('Announcement created.');
      }
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a) => {
    try {
      await api.patch(`/announcements/${a.id}`, { is_active: !a.is_active });
      load();
    } catch { setError('Failed to update.'); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete announcement "${a.message.slice(0, 60)}…"? This cannot be undone.`)) return;
    try {
      await api.delete(`/announcements/${a.id}`);
      flash('Announcement deleted.');
      if (editId === a.id) cancelEdit();
      load();
    } catch { setError('Delete failed.'); }
  };

  const isExpired = (a) => a.expires_at && new Date(a.expires_at) < new Date();

  const statusLabel = (a) => {
    if (!a.is_active) return { label: 'Inactive', style: { background: '#f1f5f9', color: '#64748b' } };
    if (isExpired(a))  return { label: 'Expired',  style: { background: '#fef2f2', color: '#dc2626' } };
    return { label: 'Live', style: { background: '#f0fdf4', color: '#16a34a' } };
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Announcements</h2>
          <p className="page-subtitle">Site-wide banners shown at the top of every page for all logged-in users.</p>
        </div>
      </div>

      {error   && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {/* ── Create / Edit form ── */}
      <div className="admin-form-card">
        <h3>{editId ? 'Edit Announcement' : 'New Announcement'}</h3>
        <form onSubmit={handleSubmit}>
          <label>
            Message
            <textarea
              rows={3}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="e.g. We'll be performing maintenance tonight from 10pm–midnight."
              required
            />
          </label>
          <div className="form-row">
            <label>
              Type
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="info">ℹ️ Info</option>
                <option value="warning">⚠️ Warning</option>
                <option value="critical">🚨 Critical</option>
              </select>
            </label>
            <label>
              Expires at <span className="optional">(leave blank for no expiry)</span>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              />
            </label>
          </div>
          <div className="form-actions">
            {editId && (
              <button type="button" className="btn secondary" onClick={cancelEdit}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Post Announcement'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Announcement list ── */}
      {loading ? <p>Loading…</p> : announcements.length === 0 ? (
        <div className="empty-state">No announcements yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Message</th>
                <th>Type</th>
                <th>Status</th>
                <th>Expires</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {announcements.map(a => {
                const typeCfg = TYPE_COLORS[a.type] || TYPE_COLORS.info;
                const status  = statusLabel(a);
                return (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 380 }}>
                      <div style={{
                        background: typeCfg.bg,
                        border: `1px solid ${typeCfg.border}`,
                        borderLeft: `4px solid ${typeCfg.border}`,
                        borderRadius: 6,
                        padding: '8px 12px',
                        color: typeCfg.color,
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}>
                        {a.message}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: typeCfg.bg,
                        color: typeCfg.color,
                        border: `1px solid ${typeCfg.border}`,
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}>
                        {a.type}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        ...status.style,
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {a.expires_at
                        ? new Date(a.expires_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{a.created_by_name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => startEdit(a)}>
                          Edit
                        </button>
                        <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => toggle(a)}>
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => remove(a)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
