import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

// Header avec le nom de l'utilisateur connecté et un bouton de déconnexion
export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
          <span className="font-semibold text-indigo-600">CoEdit</span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
