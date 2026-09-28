import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { useAuth } from "./auth/authContext";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";

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
              <Route path="/" element={<Home />} />

              {/* Mettre toutes les routes ici */}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
