import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAdmin } from './auth/RequireAdmin';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { TwoFactorPage } from './pages/TwoFactorPage';
import { WorkspacePage } from './pages/WorkspacePage';

const router = createBrowserRouter(createRoutesFromElements(
    <>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
                <Route path="/" element={<WorkspacePage />} />
                <Route path="/arborescence" element={<Navigate to="/" replace />} />
                <Route path="/editor" element={<Navigate to="/" replace />} />
                <Route path="/calls" element={<Navigate to="/" replace />} />
                <Route path="/calls/:fileId" element={<Navigate to="/" replace />} />
                <Route path="/a2f" element={<TwoFactorPage />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route element={<RequireAdmin />}>
                    <Route path="/admin/utilisateurs" element={<AdminUsersPage />} />
                </Route>
            </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
    </>
));

function App() {
    return (
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>
    );
}

export default App;
