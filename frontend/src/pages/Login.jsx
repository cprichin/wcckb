import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'user' ? '/tickets' : '/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.unconfirmed) {
        setError('Your email address hasn\'t been confirmed yet. Please check your inbox for the confirmation link.');
      } else {
        setError(data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>HelpDesk</h1>
        <p className="subtitle">Sign in to your account</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Email
            <input type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>Password
            <input type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} required />
          </label>
          <button type="submit" disabled={loading} className="btn primary full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="auth-link"><Link to="/forgot-password">Forgot password?</Link></p>
        <p className="auth-link">No account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
}
