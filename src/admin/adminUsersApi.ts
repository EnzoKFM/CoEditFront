import type { User } from '../auth/authApi';
import { apiFetch } from '../lib/api';

// Compte vu par un administrateur : en plus, l'état de blocage et la date de création
export type AdminUser = User & {
  isBlocked: boolean;
  createdAt: string;
};

export type NewUserAccount = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'user' | 'admin';
};

type AdminUserResponse = { user: AdminUser };

/**
 * Liste de tous les comptes
 * @returns {Promise<AdminUser[]>}
 */
export async function listUsers(): Promise<AdminUser[]> {
  const { users } = await apiFetch<{ users: AdminUser[] }>('/api/admin/users');
  return users;
}

/**
 * Crée un compte (il n'y a pas d'inscription publique)
 * @param newUserAccount informations du compte, avec un mot de passe provisoire
 * @returns le compte créé
 */
export async function createUser(newUserAccount: NewUserAccount): Promise<AdminUser> {
  const { user } = await apiFetch<AdminUserResponse>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(newUserAccount),
  });
  return user;
}

/**
 * Bloque ou débloque un compte : un compte bloqué perd sa session et ne peut plus se connecter
 * @param userId identifiant du compte
 * @param isBlocked true pour bloquer, false pour débloquer
 * @returns le compte mis à jour
 */
export async function setUserBlocked(userId: number, isBlocked: boolean): Promise<AdminUser> {
  const action = isBlocked ? 'block' : 'unblock';
  const { user } = await apiFetch<AdminUserResponse>(`/api/admin/users/${userId}/${action}`, { method: 'PATCH' });
  return user;
}
