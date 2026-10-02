import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../shared/Button'
import { errorClass, inputClass, labelClass } from '../formStyles'
import { getErrorMessage } from '../../lib/api'
import {
    deleteFolderShare,
    listFolderShares,
    shareFolder,
    sharePermissionLabels,
    updateFolderShare,
    type FolderShare,
    type SharePermission,
} from '../../shares/shareApi'

interface ShareFolderDialogProps {
    folderId: number
    folderName: string
    onClose: () => void
}

const sharePermissions = Object.keys(sharePermissionLabels) as SharePermission[]

export function ShareFolderDialog({ folderId, folderName, onClose }: ShareFolderDialogProps) {
    const dialog = useRef<HTMLDialogElement>(null)
    const [shares, setShares] = useState<FolderShare[]>([])
    const [isLoadingShares, setIsLoadingShares] = useState(true)
    const [inviteeEmail, setInviteeEmail] = useState('')
    const [newSharePermission, setNewSharePermission] = useState<SharePermission>('read')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingUserIds, setPendingUserIds] = useState<number[]>([])
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        dialog.current?.showModal()
    }, [])

    useEffect(() => {
        let isCurrentRequest = true
        listFolderShares(folderId)
            .then((loadedShares) => isCurrentRequest && setShares(loadedShares))
            .catch((error) => isCurrentRequest && setErrorMessage(getErrorMessage(error)))
            .finally(() => isCurrentRequest && setIsLoadingShares(false))
        return () => {
            isCurrentRequest = false
        }
    }, [folderId])

    async function submitShare(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsSubmitting(true)
        setErrorMessage('')
        try {
            const createdShare = await shareFolder(folderId, inviteeEmail.trim(), newSharePermission)
            setShares((currentShares) => [...currentShares, createdShare])
            setInviteeEmail('')
            setNewSharePermission('read')
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setIsSubmitting(false)
        }
    }

    async function changeSharePermission(userId: number, permission: SharePermission) {
        setPendingUserIds((currentIds) => [userId, ...currentIds])
        setErrorMessage('')
        try {
            const updatedShare = await updateFolderShare(folderId, userId, permission)
            setShares((currentShares) => currentShares.map((share) => (share.userId === userId ? updatedShare : share)))
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setPendingUserIds((currentIds) => currentIds.filter((pendingUserId) => pendingUserId !== userId))
        }
    }

    async function removeShare(userId: number) {
        const removedShare = shares.find((share) => share.userId === userId)
        if (removedShare && !window.confirm(`Retirer l’accès de ${removedShare.firstName} ${removedShare.lastName} (${removedShare.email}) ?`)) {
            return
        }
        setPendingUserIds((currentIds) => [userId, ...currentIds])
        setErrorMessage('')
        try {
            await deleteFolderShare(folderId, userId)
            setShares((currentShares) => currentShares.filter((share) => share.userId !== userId))
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setPendingUserIds((currentIds) => currentIds.filter((pendingUserId) => pendingUserId !== userId))
        }
    }

    return (
        <dialog ref={dialog} aria-labelledby="share-folder-title" onCancel={(event) => { event.preventDefault(); onClose() }} className="m-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/40">
            <h2 id="share-folder-title" className="text-lg font-semibold text-slate-900">
                Partager « {folderName} »
            </h2>

            <form onSubmit={submitShare} className="mt-4 space-y-3">
                <div>
                    <label htmlFor="share-invitee-email" className={labelClass}>Adresse email</label>
                    <input
                        id="share-invitee-email"
                        type="email"
                        required
                        autoFocus
                        value={inviteeEmail}
                        onChange={(event) => setInviteeEmail(event.target.value)}
                        placeholder="prenom.nom@exemple.fr"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="share-new-permission" className={labelClass}>Permission</label>
                    <select
                        id="share-new-permission"
                        value={newSharePermission}
                        onChange={(event) => setNewSharePermission(event.target.value as SharePermission)}
                        className={inputClass}
                    >
                        {sharePermissions.map((sharePermission) => (
                            <option key={sharePermission} value={sharePermission}>{sharePermissionLabels[sharePermission]}</option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end">
                    <Button type="submit" variant="primary" disabled={isSubmitting || inviteeEmail.trim() === ''}>
                        {isSubmitting ? 'Partage…' : 'Confirmer le partage'}
                    </Button>
                </div>
            </form>

            {errorMessage && <p role="alert" className={`mt-3 ${errorClass}`}>{errorMessage}</p>}

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Utilisateurs ayant accès</h3>
            {isLoadingShares ? (
                <p className="mt-2 text-sm text-slate-500">Chargement…</p>
            ) : shares.length === 0 && !errorMessage ? (
                <p className="mt-2 text-sm text-slate-500">Ce dossier n’est partagé avec personne.</p>
            ) : (
                <ul className="mt-2 divide-y divide-slate-200">
                    {shares.map((share) => (
                        <li key={share.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">{share.firstName} {share.lastName}</p>
                                <p className="truncate text-xs text-slate-500">{share.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    aria-label={`Permission de ${share.email}`}
                                    value={share.permission}
                                    disabled={pendingUserIds.includes(share.userId)}
                                    onChange={(event) => changeSharePermission(share.userId, event.target.value as SharePermission)}
                                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 disabled:opacity-60"
                                >
                                    {sharePermissions.map((sharePermission) => (
                                        <option key={sharePermission} value={sharePermission}>{sharePermissionLabels[sharePermission]}</option>
                                    ))}
                                </select>
                                <Button variant="danger" className="px-3 py-1.5" disabled={pendingUserIds.includes(share.userId)} onClick={() => removeShare(share.userId)}>
                                    Retirer
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-6 flex justify-end">
                <Button onClick={onClose}>Fermer</Button>
            </div>
        </dialog>
    )
}
