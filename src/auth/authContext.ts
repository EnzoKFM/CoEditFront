import { createContext, use } from 'react';
import type { User } from './authApi';

export type AuthContextValue = {
  user: User | null;
  // true tant qu'on ne sait pas encore si l'utilisateur est connecté (appel à /me en cours)
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
