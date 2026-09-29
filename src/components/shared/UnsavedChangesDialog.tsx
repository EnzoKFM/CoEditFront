import { useEffect, useRef } from 'react'
import { Button } from './Button'

interface UnsavedChangesDialogProps {
    saving: boolean
    canSave: boolean
    message?: string
    onSave: () => void
    onDiscard: () => void
    onCancel: () => void
}

export function UnsavedChangesDialog({ saving, canSave, message, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
    const dialog = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        dialog.current?.showModal()
    }, [])

    return (
        <dialog ref={dialog} aria-labelledby="unsaved-title" onCancel={(event) => { event.preventDefault(); if (!saving) onCancel() }} className="m-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/40">
            <h2 id="unsaved-title" className="text-lg font-semibold text-slate-900">
                Modifications non enregistrées
            </h2>
            <p className="mt-3 text-sm text-slate-600">
                Enregistrez votre document avant de quitter, ou abandonnez vos modifications.
            </p>
            {message && (
                <p role="status" className="mt-3 text-sm text-amber-800">
                    {message}
                </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button onClick={onCancel} disabled={saving}>
                    Rester
                </Button>
                <Button variant="danger" onClick={onDiscard} disabled={saving}>
                    Abandonner
                </Button>
                <Button variant="primary" onClick={onSave} disabled={!canSave || saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer et continuer'}
                </Button>
            </div>
        </dialog>
    )
}
