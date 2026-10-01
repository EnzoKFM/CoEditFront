import { MAX_CALL_MEMBERS, type AudioCallClient, type AudioCallState, type Collaborator } from '../../audio/AudioCallClient'
import { useCallAlerts, useRingtonesPreference } from '../../audio/useCallAlerts'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { ChatPanel } from '../chat/ChatPanel'
import { CallMiniBar, CallStage } from './CallStage'
import { MicrophoneIcon } from './callIcons'
import { getInitials } from './getInitials'
import { RemoteAudio } from './RemoteAudio'
import { Button } from '../shared/Button'

const ACTIVE_CALL_STATUSES = ['incoming', 'outgoing', 'connecting', 'connected']
const JOINED_CALL_STATUSES = ['outgoing', 'connecting', 'connected']

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

function getCallStatusText(state: AudioCallState) {
    switch (state.status) {
        case 'outgoing': return 'Appel en cours…'
        case 'incoming': return 'Vous invite à un appel'
        case 'connecting': return 'Connexion…'
        case 'connected': {
            const details = [`En communication à ${state.callMembers.length + 1}`]
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

export function AudioCallRoom({ client, documentName, onRetry }: {
    client: AudioCallClient
    documentName: string
    onRetry: () => void
}) {
    const state = useSyncExternalStore(client.subscribe, client.getSnapshot)
    const { ringtonesMuted, toggleRingtones } = useRingtonesPreference()
    useCallAlerts({ status: state.status, callerName: state.participant?.user.name ?? '', ringtonesMuted })
    const busy = ACTIVE_CALL_STATUSES.includes(state.status)
    const isInCall = JOINED_CALL_STATUSES.includes(state.status)
    const isCallFull = state.callMembers.length + state.invitedClientIds.length + 1 >= MAX_CALL_MEMBERS
    const canCall = state.connection === 'ready' && (isInCall ? !isCallFull : !busy)
    const [isStageMinimized, setIsStageMinimized] = useState(false)
    const [wasInCall, setWasInCall] = useState(isInCall)
    if (wasInCall !== isInCall) {
        setWasInCall(isInCall)
        if (isInCall) setIsStageMinimized(false)
    }
    const incomingCaller = state.status === 'incoming' ? state.participant : null
    const isIncomingCallerPresent = state.collaborators.some((collaborator) => collaborator.clientId === incomingCaller?.clientId)
    const listedParticipants = [...state.collaborators]
    if (incomingCaller && !isIncomingCallerPresent) listedParticipants.push(incomingCaller)
    listedParticipants.sort((first, second) =>
        first.user.name.localeCompare(second.user.name, 'fr', { sensitivity: 'base' })
        || first.clientId.localeCompare(second.clientId)
    )

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
                            const callMember = state.callMembers.find((member) => member.collaborator.clientId === collaborator.clientId)
                            if (callMember) {
                                return (
                                    <ParticipantRow key={collaborator.clientId} collaborator={collaborator} highlight={callMember.connected ? 'connected' : 'other'} isMicrophoneMuted={callMember.muted}>
                                        <p className={`mt-1 pl-11 text-xs font-medium ${callMember.connected ? 'text-green-700' : 'text-slate-600'}`}>
                                            {callMember.connected ? 'En communication' : 'Connexion…'}
                                        </p>
                                    </ParticipantRow>
                                )
                            }
                            if (state.invitedClientIds.includes(collaborator.clientId)) {
                                return (
                                    <ParticipantRow key={collaborator.clientId} collaborator={collaborator} highlight="other">
                                        <p className="mt-1 pl-11 text-xs font-medium text-slate-600">
                                            Appel en cours…
                                        </p>
                                    </ParticipantRow>
                                )
                            }
                            if (state.status === 'incoming' && collaborator.clientId === state.participant?.clientId) {
                                return (
                                    <ParticipantRow key={collaborator.clientId} collaborator={collaborator} highlight="incoming">
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-11">
                                            <p role="status" className="text-xs font-medium text-slate-600">
                                                {getCallStatusText(state)}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <CallControls client={client} state={state} />
                                            </div>
                                        </div>
                                    </ParticipantRow>
                                )
                            }
                            const callLabel = isInCall ? `Ajouter ${collaborator.user.name} à l’appel` : `Appeler ${collaborator.user.name}`
                            return (
                                <ParticipantRow key={collaborator.clientId} collaborator={collaborator}>
                                    <button
                                        type="button"
                                        disabled={!canCall}
                                        onClick={() => void client.start(collaborator)}
                                        aria-label={callLabel}
                                        title={isInCall && isCallFull ? `Appel complet (${MAX_CALL_MEMBERS} personnes maximum)` : callLabel}
                                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {isInCall ? <span aria-hidden="true" className="text-base font-semibold leading-none">+</span> : <PhoneIcon />}
                                    </button>
                                </ParticipantRow>
                            )
                        })}
                    </ul>
                )}
                {state.status !== 'idle' && state.status !== 'incoming' && (
                    <div className={`mt-3 rounded-lg border px-3 py-2 ${state.status === 'connected' ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
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
                        {state.message && isInCall && (
                            <p className="mt-1 text-xs text-slate-500">
                                {state.message}
                            </p>
                        )}
                    </div>
                )}
            </section>
            {state.callMembers.map((member) => member.stream && <RemoteAudio key={member.collaborator.clientId} stream={member.stream} />)}
            {isInCall && !isStageMinimized && (
                <CallStage client={client} state={state} documentName={documentName} statusText={getCallStatusText(state)} onMinimize={() => setIsStageMinimized(true)} />
            )}
            {isInCall && isStageMinimized && (
                <CallMiniBar client={client} state={state} statusText={getCallStatusText(state)} onExpand={() => setIsStageMinimized(false)} />
            )}
            <ChatPanel socket={client.socket} isJoined={state.connection === 'ready'} />
        </div>
    )
}
