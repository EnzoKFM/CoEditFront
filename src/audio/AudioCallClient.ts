import type { Socket } from 'socket.io-client'
import type { CallStatus } from '../components/call/types'

import type { Collaborator } from '../documents/types'
export type { Collaborator } from '../documents/types'

interface CallSignal {
    clientId: string
    description?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
}

interface CallReply {
    callId?: string
    error?: string
}

interface JoinReply {
    collaborators?: Collaborator[]
    error?: string
}

export interface AudioCallState {
    connection: 'connecting' | 'ready' | 'error'
    connectionError: string
    collaborators: Collaborator[]
    status: CallStatus
    participant: Collaborator | null
    muted: boolean
    message: string
    remoteStream: MediaStream | null
}

interface CallResources {
    acquireMicrophone: () => Promise<MediaStream>
    createPeer: () => RTCPeerConnection
}

export class AudioCallClient {
    readonly socket: Socket
    private resources: CallResources
    private fileId: number
    private userName: string
    private managesDocument: boolean
    private listeners = new Set<() => void>()
    private disposed = false
    private generation = 0
    private callId: string | null = null
    private active = false
    private localStream: MediaStream | null = null
    private peer: RTCPeerConnection | null = null
    private candidates: RTCIceCandidateInit[] = []
    private signalQueue: Promise<void> = Promise.resolve()
    private deadline: ReturnType<typeof setTimeout> | undefined
    private disconnectDeadline: ReturnType<typeof setTimeout> | undefined
    private state: AudioCallState = {
        connection: 'connecting', connectionError: '', collaborators: [],
        status: 'idle', participant: null, muted: false, message: '', remoteStream: null,
    }

    constructor(socket: Socket, fileId: number, userName: string, resources: CallResources, managesDocument = true) {
        this.socket = socket
        this.fileId = fileId
        this.userName = userName
        this.resources = resources
        this.managesDocument = managesDocument
    }

    connect() {
        this.disposed = false
        const socket = this.socket
        if (this.managesDocument) socket.on('connect', this.join)
        socket.on('disconnect', this.disconnected)
        socket.on('connect_error', this.connectionFailed)
        socket.on('presence:update', this.updatePresence)
        socket.on('presence:leave', this.removePresence)
        socket.on('call:incoming', this.incoming)
        socket.on('call:accepted', this.accepted)
        socket.on('call:signal', this.receiveSignal)
        socket.on('call:ended', this.ended)
        if (this.managesDocument) socket.connect()
    }

    joiningDocument = () => {
        this.finish('idle', '')
        this.update({ connection: 'connecting', connectionError: '', collaborators: [], participant: null })
    }

    joinedDocument = (collaborators: Collaborator[]) => {
        this.update({ connection: 'ready', connectionError: '', collaborators: collaborators.filter((collaborator) => collaborator.clientId !== this.socket.id) })
    }

    documentFailed = (message: string) => {
        this.update({ connection: 'error', connectionError: message, collaborators: [] })
    }

    getSnapshot = () => this.state

    subscribe = (listener: () => void) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    private update(patch: Partial<AudioCallState>) {
        if (this.disposed) return
        this.state = { ...this.state, ...patch }
        this.listeners.forEach((listener) => listener())
    }

    private join = () => {
        this.update({ connection: 'connecting', connectionError: '', collaborators: [] })
        const connectionId = this.socket.id
        this.socket.timeout(10000).emit('document:join', {
            fileId: this.fileId, user: { name: this.userName },
        }, (failure: Error | null, reply?: JoinReply) => {
            if (this.disposed || !this.socket.connected || this.socket.id !== connectionId) return
            if (failure || reply?.error || !reply?.collaborators) {
                this.update({ connection: 'error', connectionError: reply?.error || 'Le serveur ne répond pas. Réessayez.' })
                return
            }
            const collaborators = new Map(this.state.collaborators.map((collaborator) => [collaborator.clientId, collaborator]))
            reply.collaborators.forEach((collaborator) => collaborators.set(collaborator.clientId, collaborator))
            this.update({ connection: 'ready', collaborators: [...collaborators.values()] })
        })
    }

    retry = () => {
        if (!this.managesDocument) return
        if (this.socket.connected) this.join()
        else this.socket.connect()
    }

    private disconnected = () => {
        this.finish('error', 'Connexion au serveur perdue. L’appel est terminé.', false)
        this.update({ connection: 'error', connectionError: 'Connexion perdue. Reconnexion en cours…', collaborators: [] })
    }

    private connectionFailed = (failure: Error) => {
        const message = failure.message === 'Non authentifié'
            ? 'Votre session a expiré. Reconnectez-vous.'
            : 'Impossible de joindre le serveur des appels.'
        this.update({ connection: 'error', connectionError: message })
    }

    private updatePresence = (collaborator: Collaborator) => {
        if (collaborator.clientId === this.socket.id) return
        const collaborators = this.state.collaborators.filter((current) => current.clientId !== collaborator.clientId)
        this.update({ collaborators: [...collaborators, collaborator] })
    }

    private removePresence = ({ clientId }: { clientId: string }) => {
        this.update({ collaborators: this.state.collaborators.filter((collaborator) => collaborator.clientId !== clientId) })
        if (this.active && this.state.participant?.clientId === clientId) {
            this.finish('ended', 'Le correspondant a quitté le document.')
        }
    }

    private begin(participant: Collaborator, status: CallStatus) {
        this.generation += 1
        this.active = true
        this.update({ participant, status, muted: false, message: '', remoteStream: null })
        this.setDeadline('L’appel n’a pas abouti. Vous pouvez réessayer.', 60000)
        return this.generation
    }

    private isCurrent(generation: number) {
        return !this.disposed && this.active && generation === this.generation
    }

    private setDeadline(message: string, delay: number) {
        clearTimeout(this.deadline)
        this.deadline = setTimeout(() => this.finish('error', message), delay)
    }

    private async preparePeer(generation: number) {
        const stream = await this.resources.acquireMicrophone()
        if (!this.isCurrent(generation)) {
            stream.getTracks().forEach((track) => track.stop())
            return false
        }
        this.localStream = stream
        const peer = this.resources.createPeer()
        this.peer = peer
        stream.getTracks().forEach((track) => {
            peer.addTrack(track, stream)
            track.onended = () => {
                if (this.isCurrent(generation)) this.finish('error', 'Le microphone a été déconnecté.')
            }
        })
        peer.onicecandidate = ({ candidate }) => {
            if (candidate && this.isCurrent(generation)) this.sendSignal({ candidate: candidate.toJSON() })
        }
        peer.ontrack = ({ streams }) => {
            if (this.isCurrent(generation) && streams[0]) this.update({ remoteStream: streams[0] })
        }
        peer.onconnectionstatechange = () => {
            if (!this.isCurrent(generation)) return
            if (peer.connectionState === 'connected') {
                clearTimeout(this.deadline)
                clearTimeout(this.disconnectDeadline)
                this.update({ status: 'connected', message: '' })
            } else if (peer.connectionState === 'failed') {
                this.finish('error', 'La connexion audio a échoué. Vérifiez votre réseau et réessayez.')
            } else if (peer.connectionState === 'disconnected') {
                this.update({ message: 'Connexion audio interrompue, tentative de récupération…' })
                clearTimeout(this.disconnectDeadline)
                this.disconnectDeadline = setTimeout(() => this.finish('error', 'La connexion audio a été perdue.'), 10000)
            }
        }
        return true
    }

    private mediaFailed(failure: unknown, generation: number) {
        if (!this.isCurrent(generation)) return
        const name = failure instanceof Error ? failure.name : ''
        const message = name === 'NotAllowedError'
            ? 'Accès au micro refusé. Autorisez-le dans les paramètres du navigateur.'
            : name === 'NotFoundError'
                ? 'Aucun microphone trouvé. Branchez un micro puis réessayez.'
                : 'Impossible d’utiliser le microphone ou de démarrer l’audio. Vérifiez le périphérique et la connexion HTTPS.'
        this.finish('error', message)
    }

    start = async (participant: Collaborator) => {
        if (this.active || this.state.connection !== 'ready') return
        const generation = this.begin(participant, 'connecting')
        this.update({ message: 'Autorisez le microphone pour démarrer l’appel.' })
        try {
            if (!await this.preparePeer(generation)) return
            this.update({ status: 'outgoing', message: '' })
            this.socket.timeout(10000).emit('call:invite', { targetClientId: participant.clientId }, (failure: Error | null, reply?: CallReply) => {
                if (!this.isCurrent(generation)) return
                if (failure || reply?.error || !reply?.callId) {
                    this.finish('error', reply?.error || 'L’invitation n’a pas été confirmée par le serveur.')
                    return
                }
                this.callId = reply.callId
            })
        } catch (failure) {
            this.mediaFailed(failure, generation)
        }
    }

    private incoming = ({ callId, caller }: { callId: string; caller: Collaborator }) => {
        if (this.active) {
            this.socket.emit('call:hangup')
            return
        }
        this.begin(caller, 'incoming')
        this.callId = callId
    }

    accept = async () => {
        if (this.state.status !== 'incoming' || !this.callId) return
        const generation = this.generation
        this.update({ status: 'connecting', message: 'Autorisez le microphone pour rejoindre l’appel.' })
        try {
            if (!await this.preparePeer(generation)) return
            this.socket.timeout(10000).emit('call:accept', { callId: this.callId }, (failure: Error | null, reply?: CallReply) => {
                if (!this.isCurrent(generation)) return
                if (failure || reply?.error || !reply?.callId) {
                    this.finish('error', reply?.error || 'Le serveur n’a pas confirmé l’appel.')
                    return
                }
                this.update({ message: '' })
                this.setDeadline('La connexion audio prend trop de temps. Réessayez.', 30000)
            })
        } catch (failure) {
            this.mediaFailed(failure, generation)
        }
    }

    private accepted = ({ callId, clientId }: { callId: string; clientId: string }) => {
        if (!this.active || this.callId !== callId || this.state.participant?.clientId !== clientId) return
        const generation = this.generation
        const peer = this.peer
        if (!peer) return
        this.update({ status: 'connecting', message: '' })
        this.setDeadline('La connexion audio prend trop de temps. Réessayez.', 30000)
        void (async () => {
            const offer = await peer.createOffer()
            if (!this.isCurrent(generation)) return
            await peer.setLocalDescription(offer)
            if (this.isCurrent(generation)) this.sendSignal({ description: offer })
        })().catch(() => {
            if (this.isCurrent(generation)) this.finish('error', 'Impossible de négocier la connexion audio.')
        })
    }

    private sendSignal(signal: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
        if (this.socket.connected && this.state.participant) {
            this.socket.emit('call:signal', { targetClientId: this.state.participant.clientId, ...signal })
        }
    }

    private receiveSignal = (signal: CallSignal) => {
        if (!this.active || signal.clientId !== this.state.participant?.clientId) return
        const generation = this.generation
        this.signalQueue = this.signalQueue.then(async () => {
            const peer = this.peer
            if (!peer || !this.isCurrent(generation)) return
            if (signal.description) {
                await peer.setRemoteDescription(signal.description)
                if (!this.isCurrent(generation)) return
                for (const candidate of this.candidates.splice(0)) {
                    await peer.addIceCandidate(candidate)
                    if (!this.isCurrent(generation)) return
                }
                if (signal.description.type === 'offer') {
                    const answer = await peer.createAnswer()
                    if (!this.isCurrent(generation)) return
                    await peer.setLocalDescription(answer)
                    if (this.isCurrent(generation)) this.sendSignal({ description: answer })
                }
            } else if (signal.candidate) {
                if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate)
                else this.candidates.push(signal.candidate)
            }
        }).catch(() => {
            if (this.isCurrent(generation)) this.finish('error', 'La négociation audio a échoué. Réessayez.')
        })
    }

    private ended = ({ callId, reason }: { callId: string; reason: string }) => {
        if (callId !== this.callId) return
        this.finish('ended', reason === 'declined' ? 'Le correspondant a refusé l’appel.' : 'Le correspondant a terminé l’appel.', false)
    }

    toggleMute = () => {
        if (this.state.status !== 'connected' || !this.localStream) return
        const muted = !this.state.muted
        this.localStream.getAudioTracks().forEach((track) => { track.enabled = !muted })
        this.update({ muted })
    }

    hangUp = () => this.finish('ended', 'Appel terminé.')

    reset = () => {
        if (this.active) return
        this.update({ status: 'idle', participant: null, message: '', muted: false })
    }

    private finish(status: CallStatus, message: string, notifyPeer = true) {
        if (notifyPeer && this.active && this.socket.connected) this.socket.emit('call:hangup')
        this.active = false
        this.generation += 1
        this.callId = null
        clearTimeout(this.deadline)
        clearTimeout(this.disconnectDeadline)
        this.peer?.close()
        this.peer = null
        this.localStream?.getTracks().forEach((track) => { track.onended = null; track.stop() })
        this.localStream = null
        this.candidates = []
        this.signalQueue = Promise.resolve()
        this.update({ status, message, remoteStream: null, muted: false })
    }

    dispose() {
        this.finish('ended', '')
        this.disposed = true
        this.socket.off('connect', this.join)
        this.socket.off('disconnect', this.disconnected)
        this.socket.off('connect_error', this.connectionFailed)
        this.socket.off('presence:update', this.updatePresence)
        this.socket.off('presence:leave', this.removePresence)
        this.socket.off('call:incoming', this.incoming)
        this.socket.off('call:accepted', this.accepted)
        this.socket.off('call:signal', this.receiveSignal)
        this.socket.off('call:ended', this.ended)
        if (this.managesDocument) {
            if (this.socket.connected) this.socket.emit('document:leave')
            this.socket.disconnect()
        }
    }
}
