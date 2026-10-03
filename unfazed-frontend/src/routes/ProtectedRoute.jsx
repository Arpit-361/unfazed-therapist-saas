import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from '../components/common/Loader';

/** Guards a route subtree by role. Authorization is still enforced by the API on every request. */
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    const loginPath = role === 'client' ? '/portal/login' : '/login';
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }
  if (user.role !== role) {
    return <Navigate to={user.role === 'therapist' ? '/dashboard' : '/portal'} replace />;
  }
  return <Outlet />;
}
