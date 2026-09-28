import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { TotpCodeInput } from '../components/TotpCodeInput';
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/formStyles';
import { getErrorMessage } from '../lib/api';

// Étape 1 : email + mot de passe. 
// Étape 2 (si la 2FA est active) : code à 6 chiffres.
type LoginStep = 'credentials' | 'twoFactor';

export function LoginPage() {
  const { user, isLoading, login, verifyTwoFactorCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return null;
  }

  // Déjà connecté : inutile d'afficher le formulaire (on le redirige directement)
  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { twoFactorRequired } = await login(email, password);
      if (twoFactorRequired) {
        setStep('twoFactor');
        setIsSubmitting(false);
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      setError(getErrorMessage(loginError));
      setIsSubmitting(false);
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await verifyTwoFactorCode(code);
      navigate(redirectTo, { replace: true });
    } catch (codeError) {
      setError(getErrorMessage(codeError));
      setCode('');
      setIsSubmitting(false);
    }
  }

  // Retour à l'étape 1 (ex : délai de 5 min dépassé)
  function backToCredentials() {
    setStep('credentials');
    setCode('');
    setPassword('');
    setError(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-indigo-600">CoEdit</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {step === 'credentials' ? 'Connexion' : 'Vérification en deux étapes'}
          </h1>
        </header>

        {step === 'credentials' ? (
          <form
            onSubmit={handleCredentialsSubmit}
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            noValidate
          >
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Mot de passe
              </label>
              <input
                id="password"
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

            <button type="submit" disabled={isSubmitting} className={`w-full ${primaryButtonClass}`}>
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleCodeSubmit}
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            noValidate
          >
            <p className="text-sm text-slate-600">
              Saisissez le code affiché dans votre application d'authentification.
            </p>

            <TotpCodeInput id="code" value={code} onChange={setCode} autoFocus />

            {error && (
              <p role="alert" className={errorClass}>
                {error}
              </p>
            )}

            <button type="submit" disabled={isSubmitting} className={`w-full ${primaryButtonClass}`}>
              {isSubmitting ? 'Vérification…' : 'Valider'}
            </button>
            <button type="button" onClick={backToCredentials} className={`w-full ${secondaryButtonClass}`}>
              Retour
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
