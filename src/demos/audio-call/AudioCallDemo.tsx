import { useState } from 'react'
import { Button } from '../../components/shared/Button'
import { AudioCallPanel, type CallStatus } from '../../components/call'

export function AudioCallDemo() {
    const [status, setStatus] = useState<CallStatus>('idle')
    const [muted, setMuted] = useState(false)
    const [error, setError] = useState('')

    function reset() {
        setStatus('idle')
        setMuted(false)
        setError('')
    }

    function fail(message: string) {
        setError(message)
        setStatus('error')
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
            <div className="mx-auto max-w-4xl">
                <header className="mb-8">
                    <p className="text-sm font-semibold tracking-wide text-indigo-600">
                        CoEdit · Démonstration
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                        Discuter autour d’un document
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                        Les appels et les commandes micro sont simulés. Aucun microphone n’est utilisé et aucune personne n’est contactée.
                    </p>
                </header>
                <div className="grid items-start gap-6 md:grid-cols-2">
                    <AudioCallPanel
                        participantName="Camille Martin"
                        documentName="Présentation du projet"
                        status={status}
                        muted={muted}
                        errorMessage={error}
                        onStart={() => setStatus('outgoing')}
                        onAccept={() => setStatus('connecting')}
                        onDecline={() => setStatus('ended')}
                        onHangUp={() => setStatus('ended')}
                        onToggleMute={() => setMuted((current) => !current)}
                        onReset={reset}
                    />
                    <aside className="rounded-2xl border border-dashed border-slate-300 p-6">
                        <h2 className="text-base font-semibold text-slate-900">
                            Simuler le correspondant
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Utilisez le panneau d’appel, puis ces commandes pour faire avancer le scénario. Elles restent propres à cette démonstration.
                        </p>
                        <div className="mt-5 flex flex-col items-start gap-3">
                            <Button disabled={status !== 'idle'} onClick={() => setStatus('incoming')}>
                                Recevoir un appel
                            </Button>
                            <Button disabled={status !== 'outgoing'} onClick={() => setStatus('connecting')}>
                                Le correspondant accepte
                            </Button>
                            <Button disabled={status !== 'connecting'} onClick={() => setStatus('connected')}>
                                Connexion établie
                            </Button>
                            <Button disabled={status !== 'outgoing'} onClick={() => fail('Le correspondant est indisponible. Réessayez plus tard.')}>
                                Correspondant indisponible
                            </Button>
                            <Button disabled={status !== 'connecting'} onClick={() => fail('L’accès au microphone a été refusé. Vérifiez les autorisations du navigateur avant de réessayer.')}>
                                Microphone refusé
                            </Button>
                            <Button disabled={status !== 'connected'} onClick={() => fail('La connexion a été perdue. Vous pouvez relancer l’appel.')}>
                                Connexion interrompue
                            </Button>
                            <Button disabled={status !== 'connected'} onClick={() => setStatus('ended')}>
                                Le correspondant raccroche
                            </Button>
                            <Button onClick={reset}>
                                Réinitialiser la démonstration
                            </Button>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}
