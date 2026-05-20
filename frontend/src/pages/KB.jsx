import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export function KBList() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const isAgent = ['agent', 'admin'].includes(user?.role);

  useEffect(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    api.get(`/kb${params}`).then(res => setArticles(res.data)).finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Knowledge Base</h2>
        {isAgent && <Link to="/kb/new" className="btn primary">+ New Article</Link>}
      </div>
      <input className="search-input" placeholder="Search articles…"
        value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? <p>Loading…</p> : articles.length === 0 ? (
        <div className="empty-state">No articles found.</div>
      ) : (
        <div className="kb-list">
          {articles.map(a => (
            <Link to={`/kb/${a.id}`} key={a.id} className="kb-card">
              <div className="kb-card-title">{a.title}</div>
              <div className="kb-card-meta">
                {a.category && <span className="tag">{a.category}</span>}
                {a.tags?.map(t => <span key={t} className="tag muted">{t}</span>)}
                <span>{a.view_count} views</span>
                <span>{new Date(a.updated_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
