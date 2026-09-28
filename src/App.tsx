import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAdmin } from "./auth/RequireAdmin";
import { RequireAuth } from "./auth/RequireAuth";
import { useAuth } from "./auth/authContext";
import { AppLayout } from "./components/AppLayout";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TwoFactorPage } from "./pages/TwoFactorPage";

function Home() {
  const { user } = useAuth();
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
      Bienvenue {user?.firstName}
    </h1>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Toutes les pages ci-dessous exigent d'être connecté */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {/* Mettre toutes les routes ici */}
              <Route path="/" element={<Home />} />
              <Route path="/a2f" element={<TwoFactorPage />} />
              <Route path="/profil" element={<ProfilePage />} />

              {/* Pages réservées aux administrateurs */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin/utilisateurs" element={<AdminUsersPage />} />
              </Route>

            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
