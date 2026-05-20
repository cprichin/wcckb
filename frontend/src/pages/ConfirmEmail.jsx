import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading | success | expired | invalid | error
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('No confirmation token found in this link.');
      return;
    }

    api.get(`/auth/confirm/${token}`)
      .then(() => setStatus('success'))
      .catch(err => {
        const status = err.response?.status;
        const msg = err.response?.data?.error || 'Something went wrong.';
        if (status === 410) setStatus('expired');
        else if (status === 404) setStatus('invalid');
        else setStatus('error');
        setMessage(msg);
      });
  }, [token]);

  const content = {
    loading: {
      icon: '⏳',
      title: 'Confirming your email…',
      body: 'Please wait a moment.',
      color: '#3b82f6',
    },
    success: {
      icon: '✅',
      title: 'Email confirmed!',
      body: 'Your account is now active. You can log in.',
      color: '#10b981',
      cta: <Link to="/login" className="btn primary">Go to Login</Link>,
    },
    expired: {
      icon: '⏰',
      title: 'Link expired',
      body: message || 'Your confirmation link has expired. Your account has been removed — please register again.',
      color: '#f59e0b',
      cta: <Link to="/register" className="btn primary">Register Again</Link>,
    },
    invalid: {
      icon: '🔗',
      title: 'Invalid link',
      body: message || 'This confirmation link is invalid or has already been used.',
      color: '#64748b',
      cta: <Link to="/login" className="btn secondary">Back to Login</Link>,
    },
    error: {
      icon: '❌',
      title: 'Something went wrong',
      body: message || 'An unexpected error occurred. Please try again or contact an administrator.',
      color: '#ef4444',
      cta: <Link to="/login" className="btn secondary">Back to Login</Link>,
    },
  }[status];

  return (
    <div className="auth-page">
      <div className="auth-box confirm-box">
        <div className="confirm-icon" style={{ color: content.color }}>{content.icon}</div>
        <h1>{content.title}</h1>
        <p className="confirm-body">{content.body}</p>
        {content.cta && <div className="confirm-cta">{content.cta}</div>}
      </div>
    </div>
  );
}
