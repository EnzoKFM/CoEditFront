import { apiFetch } from '../lib/api';
import type { User } from './authApi';

export type ProfileChanges = {
  firstName?: string;
  lastName?: string;
  email?: string;
  // Obligatoire uniquement pour changer l'email
  currentPassword?: string;
};

type UserResponse = { user: User };

/**
 * Modifie le prénom, le nom et/ou l'email du compte connecté
 * @param profileChanges champs à modifier
 * @returns l'utilisateur mis à jour
 */
export async function updateProfile(profileChanges: ProfileChanges): Promise<User> {
  const { user } = await apiFetch<UserResponse>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profileChanges),
  });
  return user;
}

/**
 * Change le mot de passe. Les autres appareils sont déconnectés, celui-ci reste connecté.
 * @param currentPassword mot de passe actuel
 * @param newPassword nouveau mot de passe
 * @returns l'utilisateur
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<User> {
  const { user } = await apiFetch<UserResponse>('/api/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return user;
}
