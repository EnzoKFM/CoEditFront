const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Erreur renvoyée par l'API : status HTTP + message lisible
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Message à afficher à l'utilisateur : ceux des erreurs 4xx de l'API lui sont destinés,
// pas ceux des 5xx (erreur interne) ni des erreurs inconnues.
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) {
    return error.message;
  }
  return 'Une erreur est survenue, réessayez plus tard';
}

// Appel à l'API : envoie le cookie de session et transforme les erreurs en ApiError
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? 'Une erreur inattendue est survenue');
  }
  return data as T;
}
