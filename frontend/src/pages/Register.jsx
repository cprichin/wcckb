import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-box confirm-box">
          <div className="confirm-icon" style={{ color: '#10b981' }}>📬</div>
          <h1>Check your email</h1>
          <p className="confirm-body">
            We sent a confirmation link to <strong>{form.email}</strong>.
            Click the link in the email to activate your account.
          </p>
          <p className="confirm-body" style={{ color: '#94a3b8', fontSize: 13 }}>
            The link expires in 6 hours. If you don't confirm in time, your account will be removed and you'll need to register again.
          </p>
          <p className="auth-link" style={{ marginTop: 20 }}>
            Already confirmed? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>Create Account</h1>
        <p className="subtitle">Submit and track support tickets</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Full Name
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>Password
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </label>
          <button type="submit" disabled={loading} className="btn primary full">
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>
        <p className="auth-link">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}

