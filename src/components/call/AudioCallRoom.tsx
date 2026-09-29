import { useEffect, useState, useSyncExternalStore } from 'react'
import { createAudioCallClient } from '../../audio/createAudioCallClient'
import { AudioCallPanel } from './AudioCallPanel'
import { RemoteAudio } from './RemoteAudio'
import { Button } from '../shared/Button'

export function AudioCallRoom({ fileId, documentName, userName }: {
    fileId: number
    documentName: string
    userName: string
}) {
    const [client] = useState(() => createAudioCallClient(fileId, userName))
    const state = useSyncExternalStore(client.subscribe, client.getSnapshot)

    useEffect(() => {
        client.connect()
        return () => client.dispose()
    }, [client])

    useEffect(() => {
        function warnBeforeLeaving(event: BeforeUnloadEvent) {
            if (['incoming', 'outgoing', 'connecting', 'connected'].includes(client.getSnapshot().status)) {
                event.preventDefault()
            }
        }
        window.addEventListener('beforeunload', warnBeforeLeaving)
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
    }, [client])

    const busy = ['incoming', 'outgoing', 'connecting', 'connected'].includes(state.status)

    return (
        <div className="grid items-start gap-6 md:grid-cols-2">
            <section aria-labelledby="participants-title" className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 id="participants-title" className="text-lg font-semibold text-slate-900">
                    Personnes présentes
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                    Ouvrez le salon de ce document avec un collègue pour vous appeler.
                </p>
                {state.connection === 'connecting' && (
                    <p role="status" className="mt-4 text-sm text-slate-600">
                        Connexion au salon…
                    </p>
                )}
                {state.connection === 'error' && (
                    <div className="mt-4 space-y-3">
                        <p role="alert" className="text-sm text-red-700">
                            {state.connectionError}
                        </p>
                        <Button onClick={client.retry}>
                            Réessayer la connexion
                        </Button>
                    </div>
                )}
                {state.connection === 'ready' && state.collaborators.length === 0 && (
                    <p role="status" className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                        Vous êtes seul dans ce salon pour le moment.
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
        </div>
    )
}
