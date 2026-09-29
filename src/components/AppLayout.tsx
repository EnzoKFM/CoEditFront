import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

// Style d'un lien du menu : surligné quand c'est la page courante
function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'font-medium text-indigo-600' : 'text-slate-600 hover:text-slate-900';
}

// Header avec le nom de l'utilisateur connecté et un bouton de déconnexion
export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
          <nav className="flex items-center gap-6 text-sm">
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
