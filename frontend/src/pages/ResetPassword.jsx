import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/auth/reset/${token}`, { new_password: form.password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const status = err.response?.status;
      if (status === 410) setError(err.response.data.error || 'This reset link has expired. Please request a new one.');
      else if (status === 404) setError(err.response.data.error || 'Invalid or already used reset link.');
      else setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-box confirm-box">
          <div className="confirm-icon" style={{ color: '#64748b' }}>🔗</div>
          <h1>Invalid link</h1>
          <p className="confirm-body">No reset token found in this link.</p>
          <div className="confirm-cta">
            <Link to="/forgot-password" className="btn primary">Request a new link</Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-box confirm-box">
          <div className="confirm-icon" style={{ color: '#10b981' }}>✅</div>
          <h1>Password updated</h1>
          <p className="confirm-body">Your password has been changed. Redirecting you to login…</p>
          <div className="confirm-cta">
            <Link to="/login" className="btn primary">Go to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>Set a new password</h1>
        <p className="subtitle">Choose a new password for your account.</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>New password
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </label>
          <label>Confirm new password
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              required
              minLength={8}
            />
          </label>
          <button type="submit" disabled={loading} className="btn primary full">
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>
        <p className="auth-link"><Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}
