import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './authContext';

// Protège les pages d'administration : un non-admin est renvoyé à l'accueil.
export function RequireAdmin() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
