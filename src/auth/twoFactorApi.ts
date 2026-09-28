import { apiFetch } from '../lib/api';
import type { User } from './authApi';

// QR code (image en data URL, pour un <img>) et secret pour une saisie manuelle
export type TwoFactorSetup = {
  qrCode: string;
  secret: string;
};

type UserResponse = { user: User };

/**
 * Génère un secret et son QR code. La 2FA n'est pas encore active.
 * Le mot de passe est exigé : une session volée ne suffit pas à activer la 2FA.
 * @param password mot de passe actuel
 * @returns {Promise<TwoFactorSetup>}
 */
export async function setupTwoFactor(password: string): Promise<TwoFactorSetup> {
  return apiFetch<TwoFactorSetup>('/api/users/me/2fa/setup', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

/**
 * Active la 2FA : le code prouve que l'application est bien configurée
 * @param code code à 6 chiffres
 * @returns l'utilisateur mis à jour
 */
export async function enableTwoFactor(code: string): Promise<User> {
  const { user } = await apiFetch<UserResponse>('/api/users/me/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return user;
}

/**
 * Désactive la 2FA (mot de passe + code exigés)
 * @param password mot de passe actuel
 * @param code code à 6 chiffres
 * @returns l'utilisateur mis à jour
 */
export async function disableTwoFactor(password: string, code: string): Promise<User> {
  const { user } = await apiFetch<UserResponse>('/api/users/me/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, code }),
  });
  return user;
}
