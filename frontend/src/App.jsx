import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ConfirmEmail from './pages/ConfirmEmail';
import TicketList from './pages/TicketList';
import NewTicket from './pages/NewTicket';
import TicketDetail from './pages/TicketDetail';
import { KBList } from './pages/KB';
import { KBDetail, KBEditor } from './pages/KBDetail';
import AdminUsers from './pages/AdminUsers';
import MyAccount from './pages/MyAccount';
import './App.css';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/tickets" />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<PrivateRoute><MyAccount /></PrivateRoute>} />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
          <Route path="/tickets" element={<PrivateRoute><TicketList /></PrivateRoute>} />
          <Route path="/tickets/new" element={<PrivateRoute><NewTicket /></PrivateRoute>} />
          <Route path="/tickets/:id" element={<PrivateRoute><TicketDetail /></PrivateRoute>} />
          <Route path="/kb" element={<PrivateRoute roles={['agent','admin']}><KBList /></PrivateRoute>} />
          <Route path="/kb/new" element={<PrivateRoute roles={['agent','admin']}><KBEditor /></PrivateRoute>} />
          <Route path="/kb/:id" element={<PrivateRoute roles={['agent','admin']}><KBDetail /></PrivateRoute>} />
          <Route path="/kb/:id/edit" element={<PrivateRoute roles={['agent','admin']}><KBEditor /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><AdminUsers /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/tickets" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
