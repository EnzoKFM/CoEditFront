import { useEffect, useRef } from 'react'
import { Button } from './Button'

interface UnsavedChangesDialogProps {
    callActive?: boolean
    hasPendingChanges?: boolean
    waiting: boolean
    canWait: boolean
    message?: string
    onWait: () => void
    onDiscard: () => void
    onCancel: () => void
}

export function UnsavedChangesDialog({ callActive = false, hasPendingChanges = true, waiting, canWait, message, onWait, onDiscard, onCancel }: UnsavedChangesDialogProps) {
    const dialog = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        dialog.current?.showModal()
    }, [])

    return (
        <dialog ref={dialog} aria-labelledby="unsaved-title" onCancel={(event) => { event.preventDefault(); if (!waiting) onCancel() }} className="m-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/40">
            <h2 id="unsaved-title" className="text-lg font-semibold text-slate-900">
                {callActive ? 'Quitter le document ?' : 'Modifications en cours d’envoi'}
            </h2>
            {callActive && (
                <p className="mt-3 text-sm text-slate-600">
                    Quitter ce document terminera votre appel et coupera votre microphone.
                </p>
            )}
            {hasPendingChanges && <p className="mt-3 text-sm text-slate-600">
                Certaines modifications ne sont pas encore confirmées par le serveur. Attendez leur transmission avant de quitter.
            </p>}
            {message && (
                <p role="status" className="mt-3 text-sm text-amber-800">
                    {message}
                </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button onClick={onCancel} disabled={waiting}>
                    Rester
                </Button>
                {hasPendingChanges && <Button variant="danger" onClick={onDiscard} disabled={waiting}>
                    Quitter quand même
                </Button>}
                <Button variant="primary" onClick={onWait} disabled={!canWait || waiting}>
                    {waiting ? 'Transmission…' : callActive ? 'Continuer et raccrocher' : 'Attendre et continuer'}
                </Button>
            </div>
        </dialog>
    )
}
