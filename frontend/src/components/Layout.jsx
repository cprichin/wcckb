import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAgent = ['agent', 'admin'].includes(user?.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🎫</span>
          <span>HelpDesk</span>
        </div>
        <div className="sidebar-nav">
          <NavLink to="/tickets" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            🎟 Tickets
          </NavLink>
          <NavLink to="/kb" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            📚 Knowledge Base
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              👥 Users
            </NavLink>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
