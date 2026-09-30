import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from './authApi';
import { setUnauthorizedListener } from '../lib/api';
import type { User } from './authApi';
import { AuthContext } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Au chargement : le cookie httpOnly n'est pas lisible en JS,
  // on demande donc à l'API si une session est ouverte.
  useEffect(() => {
    authApi
      .fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    setUnauthorizedListener(() => setUser(null));
    return () => setUnauthorizedListener(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    // 2FA active : la session n'est pas encore ouverte, on attend le code
    if ('twoFactorRequired' in result) {
      return { twoFactorRequired: true };
    }
    setUser(result.user);
    return { twoFactorRequired: false };
  }, []);

  const verifyTwoFactorCode = useCallback(async (code: string) => {
    setUser(await authApi.loginWithTwoFactor(code));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, verifyTwoFactorCode, logout, updateUser: setUser }),
    [user, isLoading, login, verifyTwoFactorCode, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
