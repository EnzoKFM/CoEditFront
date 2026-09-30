import type { AudioCallClient } from '../../audio/AudioCallClient'
import { useSyncExternalStore } from 'react'
import { ChatPanel } from '../chat/ChatPanel'
import { AudioCallPanel } from './AudioCallPanel'
import { RemoteAudio } from './RemoteAudio'
import { Button } from '../shared/Button'

export function AudioCallRoom({ client, documentName, onRetry }: {
    client: AudioCallClient
    documentName: string
    onRetry: () => void
}) {
    const state = useSyncExternalStore(client.subscribe, client.getSnapshot)
    const busy = ['incoming', 'outgoing', 'connecting', 'connected'].includes(state.status)

    return (
        <div className="space-y-4">
            <section aria-labelledby="participants-title" className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 id="participants-title" className="text-lg font-semibold text-slate-900">
                    Sur ce document
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                    Les personnes qui éditent ce fichier apparaissent ici. Vous pouvez les appeler tout en écrivant.
                </p>
                {state.connection === 'connecting' && (
                    <p role="status" className="mt-4 text-sm text-slate-600">
                        Connexion au document…
                    </p>
                )}
                {state.connection === 'error' && (
                    <div className="mt-4 space-y-3">
                        <p role="alert" className="text-sm text-red-700">
                            {state.connectionError}
                        </p>
                        <Button onClick={onRetry}>
                            Réessayer la connexion
                        </Button>
                    </div>
                )}
                {state.connection === 'ready' && state.collaborators.length === 0 && (
                    <p role="status" className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                        Vous êtes seul sur ce document pour le moment.
                    </p>
                )}
                <ul className="mt-4 space-y-3">
                    {state.collaborators.map((collaborator) => (
                        <li key={collaborator.clientId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                            <span className="min-w-0 break-words text-sm font-medium text-slate-800">
                                {collaborator.user.name}
                            </span>
                            <Button disabled={busy || state.connection !== 'ready'} onClick={() => void client.start(collaborator)} aria-label={`Appeler ${collaborator.user.name}`}>
                                Appeler
                            </Button>
                        </li>
                    ))}
                </ul>
            </section>
            <div>
                {state.participant && state.status !== 'idle' ? (
                    <AudioCallPanel
                        participantName={state.participant.user.name}
                        documentName={documentName}
                        status={state.status}
                        muted={state.muted}
                        errorMessage={state.message}
                        onStart={() => { if (state.participant) void client.start(state.participant) }}
                        onAccept={() => void client.accept()}
                        onDecline={client.hangUp}
                        onHangUp={client.hangUp}
                        onToggleMute={client.toggleMute}
                        onReset={client.reset}
                    />
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-600">
                        Choisissez une personne à appeler. Votre microphone sera demandé au démarrage de l’appel ou quand vous accepterez une invitation.
                    </div>
                )}
                {state.message && state.status !== 'error' && (
                    <p role="status" className="mt-3 text-sm text-slate-600">
                        {state.message}
                    </p>
                )}
                {state.remoteStream && <RemoteAudio stream={state.remoteStream} />}
            </div>
            <div className="md:col-span-2">
                <ChatPanel socket={client.socket} isJoined={state.connection === 'ready'} />
            </div>
        </div>
    )
}
