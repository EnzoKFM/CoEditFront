import type { AudioCallClient, AudioCallState, Collaborator } from '../../audio/AudioCallClient'
import { Button } from '../shared/Button'

export function OngoingCalls({ client, state, canRequest }: { client: AudioCallClient; state: AudioCallState; canRequest: boolean }) {
    const ownClientId = client.socket.id
    const otherCalls = state.ongoingCalls.filter((call) => !ownClientId || !call.participantClientIds.includes(ownClientId))
    const ownJoinRequest = state.ownJoinRequest
    const getName = (clientId: string) => state.collaborators.find((collaborator) => collaborator.clientId === clientId)?.user.name ?? 'Collaborateur'

    if (otherCalls.length === 0 && !ownJoinRequest?.message) return null

    return (
        <div className="mt-3 space-y-2">
            {otherCalls.map((call) => {
                const isRequestPending = ownJoinRequest?.pending === true && ownJoinRequest.callId === call.callId
                return (
                    <div key={call.callId} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                        <p className="text-xs font-semibold text-indigo-900">
                            Appel en cours · {call.participantClientIds.length} personnes
                        </p>
                        <p className="mt-0.5 truncate text-xs text-indigo-800" title={call.participantClientIds.map(getName).join(', ')}>
                            {call.participantClientIds.map(getName).join(', ')}
                        </p>
                        <Button
                            variant="primary"
                            className="mt-2 px-3 py-1.5 text-xs"
                            disabled={!canRequest || Boolean(ownJoinRequest?.pending)}
                            onClick={() => client.requestToJoin(call.callId)}
                        >
                            {isRequestPending ? 'Demande envoyée…' : 'Demander à rejoindre'}
                        </Button>
                    </div>
                )
            })}
            {ownJoinRequest && !ownJoinRequest.pending && ownJoinRequest.message && (
                <div role="status" className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-700">{ownJoinRequest.message}</p>
                    <Button className="px-3 py-1 text-xs" onClick={client.dismissJoinRequestMessage}>OK</Button>
                </div>
            )}
        </div>
    )
}

export function JoinRequestBanner({ client, requests, tone }: { client: AudioCallClient; requests: Collaborator[]; tone: 'light' | 'dark' }) {
    if (requests.length === 0) return null
    const containerClass = tone === 'dark' ? 'bg-slate-800 text-white' : 'border border-indigo-200 bg-indigo-50 text-indigo-950'
    return (
        <ul aria-label="Demandes pour rejoindre l’appel" className="space-y-2">
            {requests.map((requester) => (
                <li key={requester.clientId} role="alert" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${containerClass}`}>
                    <p className="min-w-0 text-sm">
                        <span className="font-semibold">{requester.user.name}</span> demande à rejoindre l’appel
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => client.acceptJoinRequest(requester)}>
                            Accepter
                        </Button>
                        <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => client.declineJoinRequest(requester)}>
                            Refuser
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    )
}
