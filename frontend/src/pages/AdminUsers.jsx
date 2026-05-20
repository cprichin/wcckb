import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_COLOR = { admin: '#7c3aed', agent: '#0369a1', user: '#374151' };
const ROLE_BG   = { admin: '#f3e8ff', agent: '#e0f2fe', user: '#f1f5f9' };

const BLANK = { name: '', email: '', password: '', role: 'user', department: '' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // user id pending delete

  // Guard: non-admins bounced out
  useEffect(() => {
    if (me && me.role !== 'admin') navigate('/tickets');
  }, [me]);

  const load = () => {
    api.get('/users').then(res => setUsers(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      await api.post('/users', form);
      setFormSuccess(`Account created for ${form.email}`);
      setForm(BLANK);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDelete = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p className="page-subtitle">Admin only — create and manage all accounts</p>
        </div>
        <button className="btn primary" onClick={() => { setShowForm(!showForm); setFormError(''); setFormSuccess(''); }}>
          {showForm ? '✕ Cancel' : '+ Create Account'}
        </button>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="admin-form-card">
          <h3>New Account</h3>
          {formError && <div className="alert error">{formError}</div>}
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <label>Full Name *
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label>Email *
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </label>
            </div>
            <div className="form-row">
              <label>Password *
                <input type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="They can change this after login" required />
              </label>
              <label>Department <span className="optional">(optional)</span>
                <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
              </label>
            </div>
            <label style={{ maxWidth: 200 }}>Role *
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="user">User</option>
                <option value="agent">Agent (TA)</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={formLoading}>
                {formLoading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {formSuccess && <div className="alert success">{formSuccess}</div>}

      {/* Users Table */}
      {loading ? <p>Loading…</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={u.id === me?.id ? 'row-self' : ''}>
                  <td>
                    <strong>{u.name}</strong>
                    {u.id === me?.id && <span className="you-badge">you</span>}
                  </td>
                  <td className="email-cell">{u.email}</td>
                  <td>{u.department || <span className="muted">—</span>}</td>
                  <td>
                    {u.id === me?.id ? (
                      <span className="role-pill" style={{ background: ROLE_BG.admin, color: ROLE_COLOR.admin }}>
                        admin
                      </span>
                    ) : (
                      <select
                        className="role-select"
                        value={u.role}
                        style={{ color: ROLE_COLOR[u.role] }}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="user">user</option>
                        <option value="agent">agent</option>
                        <option value="admin">admin</option>
                      </select>
                    )}
                  </td>
                  <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    {u.id !== me?.id && (
                      deleteConfirm === u.id ? (
                        <span className="delete-confirm">
                          Sure?&nbsp;
                          <button className="btn-link danger" onClick={() => handleDelete(u.id)}>Yes, delete</button>
                          &nbsp;·&nbsp;
                          <button className="btn-link" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button className="btn-link danger" onClick={() => setDeleteConfirm(u.id)}>Delete</button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
