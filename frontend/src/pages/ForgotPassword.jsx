import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-box confirm-box">
          <div className="confirm-icon" style={{ color: '#10b981' }}>📬</div>
          <h1>Check your inbox</h1>
          <p className="confirm-body">
            If an account exists for <strong>{email}</strong>, we've sent a password-reset link.
            It expires in 60 minutes.
          </p>
          <p className="confirm-body" style={{ fontSize: 13, color: '#94a3b8' }}>
            Didn't get it? Check your spam folder, or try again with a different email.
          </p>
          <div className="confirm-cta">
            <Link to="/login" className="btn secondary">Back to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>Forgot Password</h1>
        <p className="subtitle">Enter the email on your account and we'll send you a reset link.</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <button type="submit" disabled={loading} className="btn primary full">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="auth-link">Remembered it? <Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}
