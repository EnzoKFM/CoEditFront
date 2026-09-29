import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './authContext';

// Protège les routes enfants : redirige vers /login si personne n'est connecté,
// en mémorisant la page demandée pour y revenir après la connexion.
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
