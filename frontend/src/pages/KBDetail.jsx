import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account Access', 'General', 'Other'];

export function KBDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAgent = ['agent', 'admin'].includes(user?.role);

  useEffect(() => {
    api.get(`/kb/${id}`).then(res => setArticle(res.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (!article) return <div className="page"><p>Article not found.</p></div>;

  return (
    <div className="page narrow">
      <div className="page-header">
        <div>
          {article.category && <span className="tag">{article.category}</span>}
          <h2>{article.title}</h2>
          <div className="ticket-meta">
            <span>By {article.author_name}</span>
            <span>Updated {new Date(article.updated_at).toLocaleDateString()}</span>
            <span>{article.view_count} views</span>
          </div>
        </div>
        {isAgent && (
  <button className="btn secondary" onClick={() => navigate(`/kb/${id}/edit`)}>Edit</button>
)}
{user?.role === 'admin' && (
  <button className="btn danger" onClick={async () => {
    if (!window.confirm('Delete this article? This cannot be undone.')) return;
    await api.delete(`/kb/${id}`);
    navigate('/kb');
  }}>Delete</button>
)}
      </div>
      <div className="card markdown-body">
        <ReactMarkdown>{article.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export function KBEditor() {
  const { id } = useParams(); // undefined = new article
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '', is_public: true });
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/kb/${id}`).then(res => {
        const a = res.data;
        setForm({ title: a.title, content: a.content, category: a.category || '',
          tags: (a.tags || []).join(', '), is_public: a.is_public });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    try {
      const res = id
        ? await api.patch(`/kb/${id}`, payload)
        : await api.post('/kb', payload);
      navigate(`/kb/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><p>Loading…</p></div>;

  return (
    <div className="page narrow">
      <div className="page-header">
        <h2>{id ? 'Edit Article' : 'New Article'}</h2>
        <button className="btn secondary" onClick={() => setPreview(!preview)}>
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {preview ? (
        <div className="card markdown-body">
          <h1>{form.title}</h1>
          <ReactMarkdown>{form.content}</ReactMarkdown>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form-card">
          <label>Title *
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </label>
          <div className="form-row">
            <label>Category
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Tags <span className="optional">(comma separated)</span>
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                placeholder="wifi, vpn, password" />
            </label>
          </div>
          <label>
            <input type="checkbox" checked={form.is_public}
              onChange={e => setForm({ ...form, is_public: e.target.checked })} />
            &nbsp; Public (visible to all users)
          </label>
          <label>Content * <span className="optional">(Markdown supported)</span>
            <textarea rows={16} value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="Write article content in Markdown…" required
              style={{ fontFamily: 'monospace' }} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : id ? 'Update Article' : 'Publish Article'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
