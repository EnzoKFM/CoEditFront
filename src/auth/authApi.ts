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

/**
 * Appel à l'API pour se connecter
 * @param email 
 * @param password 
 * @returns 
 */
export async function login(email: string, password: string): Promise<User> {
  const { user } = await apiFetch<UserResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
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
