import { useEffect, useState, type FormEvent } from 'react';
import { createUser, listUsers, setUserBlocked, type AdminUser, type NewUserAccount } from '../admin/adminUsersApi';
import { useAuth } from '../auth/authContext';
import {
  cardClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successClass,
} from '../components/formStyles';
import { getErrorMessage } from '../lib/api';

// Page "Utilisateurs" (admin) : création de comptes, blocage et déblocage
export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    // Évite de mettre à jour l'état si la page a été quittée avant la réponse
    let isStillDisplayed = true;
    listUsers()
      .then((loadedUsers) => isStillDisplayed && setUsers(loadedUsers))
      .catch((loadError) => isStillDisplayed && setListError(getErrorMessage(loadError)))
      .finally(() => isStillDisplayed && setIsLoading(false));
    return () => {
      isStillDisplayed = false;
    };
  }, []);

  function addUser(createdUser: AdminUser) {
    setUsers((currentUsers) => [...currentUsers, createdUser]);
  }

  function replaceUser(updatedUser: AdminUser) {
    setUsers((currentUsers) => currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Utilisateurs</h1>
      <CreateUserForm onCreated={addUser} />

      <section className={cardClass}>
        <h2 className="font-semibold text-slate-900">Comptes</h2>
        {isLoading && <p className="mt-4 text-sm text-slate-500">Chargement…</p>}
        {listError && (
          <p role="alert" className={`mt-4 ${errorClass}`}>
            {listError}
          </p>
        )}
        {!isLoading && !listError && <UsersTable users={users} onUserUpdated={replaceUser} />}
      </section>
    </div>
  );
}

const EMPTY_ACCOUNT: NewUserAccount = { email: '', firstName: '', lastName: '', password: '', role: 'user' };

// Création d'un compte avec un mot de passe provisoire, à transmettre à la personne
function CreateUserForm({ onCreated }: { onCreated: (createdUser: AdminUser) => void }) {
  const [account, setAccount] = useState<NewUserAccount>(EMPTY_ACCOUNT);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<Field extends keyof NewUserAccount>(field: Field, value: NewUserAccount[Field]) {
    setAccount((currentAccount) => ({ ...currentAccount, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const createdUser = await createUser(account);
      onCreated(createdUser);
      setAccount(EMPTY_ACCOUNT);
      setSuccess(`Compte créé pour ${createdUser.email}. Transmettez-lui son mot de passe provisoire.`);
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-5`} noValidate>
      <h2 className="font-semibold text-slate-900">Nouveau compte</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="new-user-first-name" className={labelClass}>
            Prénom
          </label>
          <input
            id="new-user-first-name"
            type="text"
            required
            value={account.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="new-user-last-name" className={labelClass}>
            Nom
          </label>
          <input
            id="new-user-last-name"
            type="text"
            required
            value={account.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="new-user-email" className={labelClass}>
            Email
          </label>
          <input
            id="new-user-email"
            type="email"
            autoComplete="off"
            required
            value={account.email}
            onChange={(event) => updateField('email', event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="new-user-role" className={labelClass}>
            Rôle
          </label>
          <select
            id="new-user-role"
            value={account.role}
            onChange={(event) => updateField('role', event.target.value as NewUserAccount['role'])}
            className={inputClass}
          >
            <option value="user">Utilisateur</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="new-user-password" className={labelClass}>
          Mot de passe provisoire
        </label>
        <p id="new-user-password-rules" className="text-xs text-slate-500">
          Au moins 8 caractères, dont une minuscule, une majuscule, un chiffre et un caractère spécial.
        </p>
        <input
          id="new-user-password"
          type="password"
          autoComplete="new-password"
          aria-describedby="new-user-password-rules"
          required
          value={account.password}
          onChange={(event) => updateField('password', event.target.value)}
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
        {isSubmitting ? 'Création…' : 'Créer le compte'}
      </button>
    </form>
  );
}

type UsersTableProps = {
  users: AdminUser[];
  onUserUpdated: (updatedUser: AdminUser) => void;
};

// Liste des comptes avec leur statut et le bouton de blocage
function UsersTable({ users, onUserUpdated }: UsersTableProps) {
  const { user: currentUser } = useAuth();
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleBlocked(user: AdminUser) {
    setError(null);
    setPendingUserId(user.id);
    try {
      onUserUpdated(await setUserBlocked(user.id, !user.isBlocked));
    } catch (blockError) {
      setError(getErrorMessage(blockError));
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}

      {/* Défilement horizontal sur mobile */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Nom</th>
              <th scope="col" className="py-2 pr-4 font-medium">Email</th>
              <th scope="col" className="py-2 pr-4 font-medium">Rôle</th>
              <th scope="col" className="py-2 pr-4 font-medium">A2F</th>
              <th scope="col" className="py-2 pr-4 font-medium">Statut</th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="py-3 pr-4 text-slate-900">
                  {user.firstName} {user.lastName}
                </td>
                <td className="py-3 pr-4 text-slate-600">{user.email}</td>
                <td className="py-3 pr-4 text-slate-600">{user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}</td>
                <td className="py-3 pr-4 text-slate-600">{user.totpEnabled ? 'Activée' : '—'}</td>
                <td className="py-3 pr-4">
                  {user.isBlocked ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Bloqué</span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Actif</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {/* L'admin connecté ne peut pas se bloquer lui même */}
                  {user.id === currentUser?.id ? (
                    <span className="text-xs text-slate-400">Vous</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleBlocked(user)}
                      disabled={pendingUserId === user.id}
                      className={`${secondaryButtonClass} px-3 py-1 text-xs`}
                    >
                      {user.isBlocked ? 'Débloquer' : 'Bloquer'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
