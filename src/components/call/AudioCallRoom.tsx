import type { AudioCallClient, AudioCallState, Collaborator } from '../../audio/AudioCallClient'
import { useCallAlerts, useRingtonesPreference } from '../../audio/useCallAlerts'
import { useSyncExternalStore, type ReactNode } from 'react'
import { ChatPanel } from '../chat/ChatPanel'
import { RemoteAudio } from './RemoteAudio'
import { Button } from '../shared/Button'

const ACTIVE_CALL_STATUSES = ['incoming', 'outgoing', 'connecting', 'connected']

function getInitials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?'
}

function PhoneIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    )
}

function BellIcon({ muted }: { muted: boolean }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            {muted && <line x1="3" x2="21" y1="3" y2="21" />}
        </svg>
    )
}

function MicrophoneIcon({ muted }: { muted: boolean }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
            {muted && <line x1="3" x2="21" y1="3" y2="21" />}
        </svg>
    )
}

function getCallStatusText(state: AudioCallState) {
    switch (state.status) {
        case 'outgoing': return 'Appel en cours…'
        case 'incoming': return 'Vous appelle'
        case 'connecting': return 'Connexion…'
        case 'connected': {
            const details = ['En communication']
            if (state.peerMuted) details.push(`${state.participant?.user.name ?? 'Votre interlocuteur'} a coupé son micro`)
            if (state.muted) details.push('votre micro est coupé')
            return details.join(' · ')
        }
        case 'ended': return state.message || 'Appel terminé'
        case 'error': return state.message || 'Appel interrompu'
        default: return ''
    }
}

function CallControls({ client, state }: { client: AudioCallClient; state: AudioCallState }) {
    const compact = 'px-3 py-1.5 text-xs'
    switch (state.status) {
        case 'incoming':
            return (
                <>
                    <Button variant="primary" className={compact} onClick={() => void client.accept()}>Accepter</Button>
                    <Button variant="danger" className={compact} onClick={client.hangUp}>Refuser</Button>
                </>
            )
        case 'outgoing':
        case 'connecting':
            return <Button variant="danger" className={compact} onClick={client.hangUp}>Annuler</Button>
        case 'connected':
            return (
                <>
                    <button
                        type="button"
                        onClick={client.toggleMute}
                        aria-pressed={state.muted}
                        aria-label={state.muted ? 'Réactiver le micro' : 'Couper le micro'}
                        title={state.muted ? 'Réactiver le micro' : 'Couper le micro'}
                        className={`grid h-8 w-8 place-items-center rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${state.muted ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                        <MicrophoneIcon muted={state.muted} />
                    </button>
                    <Button variant="danger" className={compact} onClick={client.hangUp}>Raccrocher</Button>
                </>
            )
        case 'ended':
        case 'error':
            return <Button className={compact} onClick={client.reset}>OK</Button>
        default:
            return null
    }
}

function ParticipantRow({ collaborator, children, highlight, isMicrophoneMuted = false }: { collaborator: Collaborator; children?: ReactNode; highlight?: 'incoming' | 'connected' | 'other'; isMicrophoneMuted?: boolean }) {
    const highlightClass = highlight === 'incoming'
        ? 'border-indigo-300 bg-indigo-50'
        : highlight === 'connected'
            ? 'border-green-300 bg-green-50'
            : highlight === 'other'
                ? 'border-slate-200 bg-slate-50'
                : 'border-transparent hover:bg-slate-50'
    return (
        <li className={`rounded-lg border px-2 py-1.5 ${highlightClass}`}>
            <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                    {getInitials(collaborator.user.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800" title={collaborator.user.name}>
                    {collaborator.user.name}
                </span>
                {isMicrophoneMuted && (
                    <span title={`${collaborator.user.name} a coupé son micro`} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                        <MicrophoneIcon muted />
                    </span>
                )}
                {!highlight && children}
            </div>
            {highlight && children}
        </li>
    )
}

export function AudioCallRoom({ client, onRetry }: {
    client: AudioCallClient
    documentName: string
    onRetry: () => void
}) {
    const state = useSyncExternalStore(client.subscribe, client.getSnapshot)
    const { ringtonesMuted, toggleRingtones } = useRingtonesPreference()
    useCallAlerts({ status: state.status, callerName: state.participant?.user.name ?? '', ringtonesMuted })
    const busy = ACTIVE_CALL_STATUSES.includes(state.status)
    const callParticipant = state.status !== 'idle' ? state.participant : null
    const isCallParticipantPresent = state.collaborators.some((collaborator) => collaborator.clientId === callParticipant?.clientId)
    const listedParticipants = callParticipant && !isCallParticipantPresent ? [...state.collaborators, callParticipant] : state.collaborators

    return (
        <div className="flex flex-col gap-4 xl:h-[calc(100vh-8rem)]">
            <section aria-labelledby="participants-title" className="shrink-0 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                    <h2 id="participants-title" className="text-base font-semibold text-slate-900">
                        Sur ce document
                    </h2>
                    <div className="flex items-center gap-2">
                        {state.connection === 'ready' && (
                            <span className="text-xs text-slate-500">
                                {state.collaborators.length === 0 ? 'Vous seul' : `${state.collaborators.length + 1} personnes`}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={toggleRingtones}
                            aria-pressed={ringtonesMuted}
                            aria-label={ringtonesMuted ? 'Réactiver les sonneries d’appel' : 'Couper les sonneries d’appel'}
                            title={ringtonesMuted ? 'Sonneries coupées' : 'Sonneries activées'}
                            className={`grid h-7 w-7 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${ringtonesMuted ? 'bg-slate-100 text-slate-500' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <BellIcon muted={ringtonesMuted} />
                        </button>
                    </div>
                </div>
                {state.connection === 'connecting' && (
                    <p role="status" className="mt-3 text-sm text-slate-600">
                        Connexion au document…
                    </p>
                )}
                {state.connection === 'error' && (
                    <div className="mt-3 space-y-3">
                        <p role="alert" className="text-sm text-red-700">
                            {state.connectionError}
                        </p>
                        <Button onClick={onRetry}>
                            Réessayer la connexion
                        </Button>
                    </div>
                )}
                {state.connection === 'ready' && listedParticipants.length === 0 && (
                    <p className="mt-3 text-sm text-slate-500">
                        Personne d’autre n’édite ce document pour le moment.
                    </p>
                )}
                {listedParticipants.length > 0 && (
                    <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                        {listedParticipants.map((collaborator) => {
                            const isInCall = collaborator.clientId === callParticipant?.clientId
                            if (!isInCall) {
                                return (
                                    <ParticipantRow key={collaborator.clientId} collaborator={collaborator}>
                                        <button
                                            type="button"
                                            disabled={busy || state.connection !== 'ready'}
                                            onClick={() => void client.start(collaborator)}
                                            aria-label={`Appeler ${collaborator.user.name}`}
                                            title={`Appeler ${collaborator.user.name}`}
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <PhoneIcon />
                                        </button>
                                    </ParticipantRow>
                                )
                            }
                            const highlight = state.status === 'incoming' ? 'incoming' : state.status === 'connected' ? 'connected' : 'other'
                            return (
                                <ParticipantRow key={collaborator.clientId} collaborator={collaborator} highlight={highlight} isMicrophoneMuted={state.status === 'connected' && state.peerMuted}>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-11">
                                        <p
                                            role={state.status === 'error' ? 'alert' : 'status'}
                                            className={`text-xs font-medium ${state.status === 'error' ? 'text-red-700' : state.status === 'connected' ? 'text-green-700' : 'text-slate-600'}`}
                                        >
                                            {getCallStatusText(state)}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <CallControls client={client} state={state} />
                                        </div>
                                    </div>
                                    {state.message && ACTIVE_CALL_STATUSES.includes(state.status) && (
                                        <p className="mt-1 pl-11 text-xs text-slate-500">
                                            {state.message}
                                        </p>
                                    )}
                                </ParticipantRow>
                            )
                        })}
                    </ul>
                )}
            </section>
            {state.remoteStream && <RemoteAudio stream={state.remoteStream} />}
            <ChatPanel socket={client.socket} isJoined={state.connection === 'ready'} />
        </div>
    )
}
