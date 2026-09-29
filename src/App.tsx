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
import Arborescence from "./Arborescence";
import { DocumentEditor } from "./components/editor";
import { AudioCallsPage } from "./pages/AudioCallsPage";

function Home() {
  const { user } = useAuth();
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
      Bienvenue {user?.firstName}
    </h1>
  );
}

function EditorPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Éditeur de document
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    Édition locale · Le contenu est perdu en quittant cette page ou en la rechargeant.
                </p>
            </header>
            <DocumentEditor />
        </div>
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
              <Route path="/arborescence" element={<Arborescence />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/calls" element={<AudioCallsPage />} />
              <Route path="/calls/:fileId" element={<AudioCallsPage />} />
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
