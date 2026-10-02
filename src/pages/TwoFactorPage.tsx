import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/authContext';
import { disableTwoFactor, enableTwoFactor, setupTwoFactor, type TwoFactorSetup } from '../auth/twoFactorApi';
import { TotpCodeInput } from '../components/TotpCodeInput';
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/formStyles';
import { getErrorMessage } from '../lib/api';

// Page "A2F" : activation et désactivation de la double authentification
export function TwoFactorPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-xl">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Double authentification (A2F)</h1>
          {user?.totpEnabled ? (
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Activée</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Désactivée</span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          En plus du mot de passe, un code à 6 chiffres généré par une application (Google Authenticator,
          Authy…) est demandé à chaque connexion.
        </p>

        <div className="mt-6">{user?.totpEnabled ? <DisableTwoFactorForm /> : <EnableTwoFactor />}</div>
      </section>
    </div>
  );
}

// Activation en deux temps : générer le QR code, puis confirmer avec un code
function EnableTwoFactor() {
  const { updateUser } = useAuth();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Le mot de passe est exigé par l'API avant de générer le QR code
  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      setSetup(await setupTwoFactor(password));
      setPassword('');
    } catch (setupError) {
      setError(getErrorMessage(setupError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // L'utilisateur mis à jour (totpEnabled: true) fait basculer la page sur la désactivation
      updateUser(await enableTwoFactor(code));
    } catch (enableError) {
      setError(getErrorMessage(enableError));
      setCode('');
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setSetup(null);
    setCode('');
    setError(null);
  }

  if (!setup) {
    return (
      <form onSubmit={handleStart} className="space-y-5" noValidate>
        <div>
          <label htmlFor="setup-password" className={labelClass}>
            Mot de passe
          </label>
          <input
            id="setup-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className={errorClass}>
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? 'Préparation…' : 'Activer la double authentification'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-5" noValidate>
      <div>
        <p className="text-sm font-medium text-slate-700">1. Scannez ce QR code avec votre application</p>
        <img
          src={setup.qrCode}
          alt="QR code à scanner avec l'application d'authentification"
          width={200}
          height={200}
          className="mt-3 rounded-lg border border-slate-200"
        />
        <p className="mt-3 text-sm text-slate-600">Scan impossible ? Saisissez cette clé dans l'application :</p>
        <code className="mt-1 block break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">
          {setup.secret}
        </code>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">2. Saisissez le code affiché pour confirmer</p>
        <TotpCodeInput id="enable-code" value={code} onChange={setCode} />
      </div>

      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? 'Vérification…' : 'Confirmer'}
        </button>
        <button type="button" onClick={handleCancel} disabled={isSubmitting} className={secondaryButtonClass}>
          Annuler
        </button>
      </div>
    </form>
  );
}

// Désactivation : mot de passe + code exigés par l'API
function DisableTwoFactorForm() {
  const { updateUser } = useAuth();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      updateUser(await disableTwoFactor(password, code));
    } catch (disableError) {
      setError(getErrorMessage(disableError));
      setCode('');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <p className="text-sm text-slate-600">Pour désactiver la double authentification, confirmez votre identité.</p>

      <div>
        <label htmlFor="disable-password" className={labelClass}>
          Mot de passe
        </label>
        <input
          id="disable-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </div>

      <TotpCodeInput id="disable-code" value={code} onChange={setCode} />

      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
        {isSubmitting ? 'Désactivation…' : 'Désactiver la double authentification'}
      </button>
    </form>
  );
}
