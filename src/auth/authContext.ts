import { createContext, use } from 'react';
import type { User } from './authApi';

export type AuthContextValue = {
  user: User | null;
  // true tant qu'on ne sait pas encore si l'utilisateur est connecté (appel à /me en cours)
  isLoading: boolean;
  // Renvoie twoFactorRequired: true si la 2FA est active : il faut alors appeler verifyTwoFactorCode
  login: (email: string, password: string) => Promise<{ twoFactorRequired: boolean }>;
  verifyTwoFactorCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  // Remplace l'utilisateur en mémoire après une modification (ex : activation de la 2FA)
  updateUser: (user: User) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

// Donne accès à l'utilisateur connecté depuis n'importe quel composant
export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un <AuthProvider>');
  }
  return context;
}
