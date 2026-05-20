import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      navigate('/login?registered=1');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

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
          <label>Department <span className="optional">(optional)</span>
            <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
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
