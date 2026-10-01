import { useCallback, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { getErrorMessage } from '../lib/api';

// Style d'un lien du menu : surligné quand c'est la page courante
function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'font-medium text-indigo-600' : 'text-slate-600 hover:text-slate-900';
}

// Header avec le nom de l'utilisateur connecté et un bouton de déconnexion
export function AppLayout() {
  const { user, logout } = useAuth();
  const leaveGuard = useRef<(() => boolean) | null>(null);
  const registerLeaveGuard = useCallback((guard: (() => boolean) | null) => { leaveGuard.current = guard; }, []);
  const [logoutErrorMessage, setLogoutErrorMessage] = useState('');

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function confirmLogout() {
    if (isLoggingOut) {
      return;
    }
    if (leaveGuard.current && !leaveGuard.current()) {
      return;
    }
    setLogoutErrorMessage('');
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      setLogoutErrorMessage(`Déconnexion impossible : ${getErrorMessage(error)}`);
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <span className="font-semibold text-indigo-600">CoEdit</span>
            <NavLink to="/" end className={navLinkClass}>
              Accueil
            </NavLink>
            {/* Le libellé suit l'état : "Activer" serait faux une fois l'A2F active */}
            <NavLink to="/a2f" className={navLinkClass}>
              {user?.totpEnabled ? "Gérer l'A2F" : "Activer l'A2F"}
            </NavLink>
            <NavLink to="/profil" className={navLinkClass}>
              Mon profil
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin/utilisateurs" className={navLinkClass}>
                Utilisateurs
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            {logoutErrorMessage && (
              <span role="alert" className="text-red-600">
                {logoutErrorMessage}
              </span>
            )}
            <span className="text-slate-600">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              type="button"
              onClick={() => void confirmLogout()}
              disabled={isLoggingOut}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
        <Outlet context={{ registerLeaveGuard }} />
      </main>
    </div>
  );
}
