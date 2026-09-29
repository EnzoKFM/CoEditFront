import { apiFetch } from '../lib/api';

export type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  totpEnabled: boolean;
};

type UserResponse = { user: User };

// Réponse de /login : soit la session est ouverte, soit la 2FA demande un code
export type LoginResult = UserResponse | { twoFactorRequired: true };

/**
 * Appel à l'API pour se connecter
 * @param email
 * @param password
 * @returns l'utilisateur, ou { twoFactorRequired: true } si un code 2FA est attendu
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  return apiFetch<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Appel à l'API pour la deuxième étape de connexion (code 2FA)
 * @param code code à 6 chiffres de l'application d'authentification
 * @returns {Promise<User>}
 */
export async function loginWithTwoFactor(code: string): Promise<User> {
  const { user } = await apiFetch<UserResponse>('/api/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return user;
}

/**
 * Appel à l'API pour se déconnecter
 * @returns {Promise<void>}
 */
export async function logout(): Promise<void> {
  await apiFetch<void>('/api/auth/logout', { method: 'POST' });
}

/**
 * Appel à l'API pour récupérer les informations de l'utilisateur connecté
 * @returns {Promise<User>}
 */
export async function fetchCurrentUser(): Promise<User> {
  const { user } = await apiFetch<UserResponse>('/api/auth/me');
  return user;
}
