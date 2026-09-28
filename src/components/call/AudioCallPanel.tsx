import { useId } from 'react'
import { Button } from '../shared/Button'
import type { AudioCallPanelProps, CallStatus } from './types'

const statusText: Record<CallStatus, string> = {
    idle: 'Prêt à échanger',
    outgoing: 'Appel en cours…',
    incoming: 'Appel entrant',
    connecting: 'Connexion en cours…',
    connected: 'En communication',
    ended: 'Appel terminé',
    error: 'Appel interrompu',
}

export function AudioCallPanel({
    participantName, documentName, status, muted, errorMessage,
    onStart, onAccept, onDecline, onHangUp, onToggleMute, onReset,
}: AudioCallPanelProps) {
    const titleId = useId()
    const initials = participantName.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?'

    return (
        <section aria-labelledby={titleId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-6 py-5">
                <h2 id={titleId} className="text-base font-semibold text-slate-900">
                    Appel audio
                </h2>
                <p className="mt-1 break-words text-sm text-slate-500">
                    {documentName}
                </p>
            </header>
            <div className="px-6 py-8 text-center">
                <div aria-hidden="true" className="mx-auto flex size-16 items-center justify-center rounded-full bg-indigo-50 text-xl font-semibold text-indigo-700">
                    {initials}
                </div>
                <p className="mt-4 break-words text-lg font-semibold text-slate-900">
                    {participantName}
                </p>
                <p role="status" className="mt-2 text-sm text-slate-600">
                    {statusText[status]}
                </p>
                {status === 'idle' && <p className="mt-4 text-sm leading-6 text-slate-500">
                    Échangez à deux autour de ce document.
                </p>}
                {status === 'outgoing' && <p className="mt-4 text-sm text-slate-500">
                    En attente d’une réponse.
                </p>}
                {status === 'incoming' && <p className="mt-4 text-sm text-slate-500">
                    Souhaite discuter avec vous de ce document.
                </p>}
                {status === 'connected' && <p role="status" className="mt-4 text-sm text-slate-500">
                    {muted ? 'Votre micro est coupé' : 'Votre micro est activé'}
                </p>}
                {status === 'error' && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {errorMessage || 'La connexion a été interrompue. Vous pouvez réessayer.'}
                </p>}
            </div>
            <div className="flex flex-wrap justify-center gap-3 border-t border-slate-100 px-5 py-5">
                {status === 'idle' && <Button onClick={onStart} variant="primary">
                    Démarrer un appel
                </Button>}
                {status === 'incoming' && <>
                    <Button onClick={onAccept} variant="primary">
                        Accepter
                    </Button>
                    <Button onClick={onDecline} variant="danger">
                        Refuser
                    </Button>
                </>}
                {status === 'connected' && <Button aria-pressed={muted} onClick={onToggleMute} variant={muted ? 'primary' : 'secondary'}>
                    Micro coupé
                </Button>}
                {(status === 'outgoing' || status === 'connecting' || status === 'connected') && <Button onClick={onHangUp} variant="danger">
                    {status === 'connected' ? 'Raccrocher' : 'Annuler l’appel'}
                </Button>}
                {(status === 'ended' || status === 'error') && <Button onClick={onReset} variant="secondary">
                    Revenir à l’appel
                </Button>}
            </div>
        </section>
    )
}
