import { useState, type FormEvent } from 'react';
import type { User } from '../auth/authApi';
import { useAuth } from '../auth/authContext';
import { changePassword, updateProfile, type ProfileChanges } from '../auth/profileApi';
import {
  cardClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  successClass,
} from '../components/formStyles';
import { getErrorMessage } from '../lib/api';

// Page "Mon profil" : informations personnelles et mot de passe
export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mon profil</h1>
      <ProfileInfoForm user={user} />
      <PasswordForm />
    </div>
  );
}

// Prénom, nom, email. Seuls les champs modifiés sont envoyés à l'API.
function ProfileInfoForm({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // L'API exige le mot de passe actuel pour changer l'email (identifiant de connexion)
  const isEmailChanged = email.trim().toLowerCase() !== user.email;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const profileChanges: ProfileChanges = {};
    if (firstName.trim() !== user.firstName) profileChanges.firstName = firstName;
    if (lastName.trim() !== user.lastName) profileChanges.lastName = lastName;
    if (isEmailChanged) {
      profileChanges.email = email;
      profileChanges.currentPassword = currentPassword;
    }

    if (Object.keys(profileChanges).length === 0) {
      setError('Aucune modification à enregistrer');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await updateProfile(profileChanges);
      updateUser(updatedUser);
      // Les champs reprennent les valeurs enregistrées (espaces retirés, email en minuscules)
      setFirstName(updatedUser.firstName);
      setLastName(updatedUser.lastName);
      setEmail(updatedUser.email);
      setCurrentPassword('');
      setSuccess('Profil mis à jour');
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-5`} noValidate>
      <h2 className="font-semibold text-slate-900">Informations</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-first-name" className={labelClass}>
            Prénom
          </label>
          <input
            id="profile-first-name"
            type="text"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="profile-last-name" className={labelClass}>
            Nom
          </label>
          <input
            id="profile-last-name"
            type="text"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="profile-email" className={labelClass}>
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />
      </div>

      {isEmailChanged && (
        <div>
          <label htmlFor="profile-current-password" className={labelClass}>
            Mot de passe actuel
          </label>
          <p className="text-xs text-slate-500">Obligatoire pour changer l'email, qui sert à vous connecter.</p>
          <input
            id="profile-current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" className={successClass}>
          {success}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}

// Changement de mot de passe, avec confirmation du nouveau
function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmedPassword, setConfirmedPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmedPassword) {
      setError('Les deux nouveaux mots de passe ne correspondent pas');
      return;
    }

    if (newPassword === currentPassword) {
      setError("Le nouveau mot de passe doit être différent de l'actuel");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmedPassword('');
      setSuccess('Mot de passe modifié. Vos autres appareils ont été déconnectés.');
    } catch (changeError) {
      setError(getErrorMessage(changeError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-5`} noValidate>
      <h2 className="font-semibold text-slate-900">Mot de passe</h2>

      <div>
        <label htmlFor="password-current" className={labelClass}>
          Mot de passe actuel
        </label>
        <input
          id="password-current"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password-new" className={labelClass}>
          Nouveau mot de passe
        </label>
        <p id="password-rules" className="text-xs text-slate-500">
          Au moins 8 caractères, dont une minuscule, une majuscule, un chiffre et un caractère spécial.
        </p>
        <input
          id="password-new"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-rules"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password-confirm" className={labelClass}>
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="password-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmedPassword}
          onChange={(event) => setConfirmedPassword(event.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" className={successClass}>
          {success}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        {isSubmitting ? 'Modification…' : 'Changer le mot de passe'}
      </button>
    </form>
  );
}
