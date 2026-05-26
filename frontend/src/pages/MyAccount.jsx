import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function MyAccount() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.new_password !== form.confirm_password)
      return setError('New passwords do not match');
    if (form.new_password.length < 8)
      return setError('New password must be at least 8 characters');

    setLoading(true);
    try {
      await api.patch('/auth/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess('Password updated successfully');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page narrow">
      <div className="page-header">
        <h2>My Account</h2>
      </div>

      <div className="card">
        <h3>Profile</h3>
        <div className="profile-grid">
          <span className="profile-label">Name</span>
          <span>{user?.name}</span>
          <span className="profile-label">Email</span>
          <span>{user?.email}</span>
          <span className="profile-label">Role</span>
          <span className="role-pill" style={{
            background: user?.role === 'admin' ? '#f3e8ff' : user?.role === 'agent' ? '#e0f2fe' : '#f1f5f9',
            color: user?.role === 'admin' ? '#7c3aed' : user?.role === 'agent' ? '#0369a1' : '#374151',
            display: 'inline-block'
          }}>{user?.role}</span>
        </div>
      </div>

      <div className="card">
        <h3>Change Password</h3>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <label>Current Password
            <input type="password" value={form.current_password}
              onChange={e => setForm({ ...form, current_password: e.target.value })} required />
          </label>
          <label>New Password <span className="optional">(min 8 characters)</span>
            <input type="password" value={form.new_password}
              onChange={e => setForm({ ...form, new_password: e.target.value })} required />
          </label>
          <label>Confirm New Password
            <input type="password" value={form.confirm_password}
              onChange={e => setForm({ ...form, confirm_password: e.target.value })} required />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}