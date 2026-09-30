import type { Socket } from 'socket.io-client'
import type { CallStatus } from '../components/call/types'

import type { Collaborator } from '../documents/types'
export type { Collaborator } from '../documents/types'

export const MAX_CALL_MEMBERS = 6

interface CallSignal {
    clientId: string
    description?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
}

interface CallReply {
    callId?: string
    participants?: Collaborator[]
    error?: string
}

interface JoinReply {
    collaborators?: Collaborator[]
    error?: string
}

export interface CallMember {
    collaborator: Collaborator
    connected: boolean
    muted: boolean
    stream: MediaStream | null
}

export interface AudioCallState {
    connection: 'connecting' | 'ready' | 'error'
    connectionError: string
    collaborators: Collaborator[]
    status: CallStatus
    participant: Collaborator | null
    callMembers: CallMember[]
    invitedClientIds: string[]
    muted: boolean
    message: string
}

interface CallResources {
    acquireMicrophone: () => Promise<MediaStream>
    createPeer: () => RTCPeerConnection
}

interface PeerLink {
    peer: RTCPeerConnection
    candidates: RTCIceCandidateInit[]
    signalQueue: Promise<void>
    disconnectDeadline?: ReturnType<typeof setTimeout>
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
    private links = new Map<string, PeerLink>()
    private deadline: ReturnType<typeof setTimeout> | undefined
    private state: AudioCallState = {
        connection: 'connecting', connectionError: '', collaborators: [],
        status: 'idle', participant: null, callMembers: [], invitedClientIds: [], muted: false, message: '',
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
        socket.on('call:mute', this.peerMuteChanged)
        socket.on('call:left', this.left)
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
        const name = this.getName(clientId)
        this.update({ collaborators: this.state.collaborators.filter((collaborator) => collaborator.clientId !== clientId) })
        this.dropMember(clientId, `${name} a quitté le document.`)
    }

    private getName(clientId: string) {
        const collaborator = this.state.collaborators.find((current) => current.clientId === clientId)
            ?? this.state.callMembers.find((member) => member.collaborator.clientId === clientId)?.collaborator
        return collaborator?.user.name ?? 'Le correspondant'
    }

    private begin(participant: Collaborator, status: CallStatus) {
        this.generation += 1
        this.active = true
        this.update({ participant, status, muted: false, message: '', callMembers: [], invitedClientIds: [] })
        this.setDeadline('L’appel n’a pas abouti. Vous pouvez réessayer.', 60000)
        return this.generation
    }

    private isCurrent(generation: number) {
        return !this.disposed && this.active && generation === this.generation
    }

    private isLinkCurrent(generation: number, clientId: string, link: PeerLink) {
        return this.isCurrent(generation) && this.links.get(clientId) === link
    }

    private setDeadline(message: string, delay: number) {
        clearTimeout(this.deadline)
        this.deadline = setTimeout(() => this.finish('error', message), delay)
    }

    private async acquireMicrophone(generation: number) {
        const stream = await this.resources.acquireMicrophone()
        if (!this.isCurrent(generation)) {
            stream.getTracks().forEach((track) => track.stop())
            return false
        }
        this.localStream = stream
        stream.getTracks().forEach((track) => {
            track.onended = () => {
                if (this.isCurrent(generation)) this.finish('error', 'Le microphone a été déconnecté.')
            }
        })
        return true
    }

    private createLink(clientId: string, generation: number) {
        const peer = this.resources.createPeer()
        const link: PeerLink = { peer, candidates: [], signalQueue: Promise.resolve() }
        this.links.set(clientId, link)
        const stream = this.localStream
        stream?.getTracks().forEach((track) => peer.addTrack(track, stream))
        peer.onicecandidate = ({ candidate }) => {
            if (candidate && this.isLinkCurrent(generation, clientId, link)) this.sendSignal(clientId, { candidate: candidate.toJSON() })
        }
        peer.ontrack = ({ streams }) => {
            if (this.isLinkCurrent(generation, clientId, link) && streams[0]) this.updateMember(clientId, { stream: streams[0] })
        }
        peer.onconnectionstatechange = () => {
            if (!this.isLinkCurrent(generation, clientId, link)) return
            if (peer.connectionState === 'connected') {
                clearTimeout(this.deadline)
                clearTimeout(link.disconnectDeadline)
                this.updateMember(clientId, { connected: true })
                this.update({ status: 'connected', message: '' })
            } else if (peer.connectionState === 'failed') {
                this.dropMember(clientId, `La connexion audio avec ${this.getName(clientId)} a échoué.`)
            } else if (peer.connectionState === 'disconnected') {
                this.update({ message: `Connexion audio avec ${this.getName(clientId)} interrompue, tentative de récupération…` })
                clearTimeout(link.disconnectDeadline)
                link.disconnectDeadline = setTimeout(() => this.dropMember(clientId, `La connexion audio avec ${this.getName(clientId)} a été perdue.`), 10000)
            }
        }
        return link
    }

    private closeLink(clientId: string) {
        const link = this.links.get(clientId)
        if (!link) return
        clearTimeout(link.disconnectDeadline)
        link.peer.close()
        this.links.delete(clientId)
    }

    private addMember(collaborator: Collaborator) {
        const callMembers = this.state.callMembers.filter((member) => member.collaborator.clientId !== collaborator.clientId)
        this.update({
            callMembers: [...callMembers, { collaborator, connected: false, muted: false, stream: null }],
            invitedClientIds: this.state.invitedClientIds.filter((clientId) => clientId !== collaborator.clientId),
        })
    }

    private updateMember(clientId: string, patch: Partial<CallMember>) {
        this.update({
            callMembers: this.state.callMembers.map((member) => member.collaborator.clientId === clientId ? { ...member, ...patch } : member),
        })
    }

    private dropMember(clientId: string, message: string) {
        const isMember = this.state.callMembers.some((member) => member.collaborator.clientId === clientId)
        if (!this.active || (!isMember && !this.state.invitedClientIds.includes(clientId))) return
        this.closeLink(clientId)
        const callMembers = this.state.callMembers.filter((member) => member.collaborator.clientId !== clientId)
        const invitedClientIds = this.state.invitedClientIds.filter((invitedClientId) => invitedClientId !== clientId)
        if (callMembers.length === 0 && invitedClientIds.length === 0) {
            this.finish('ended', message)
            return
        }
        const status = callMembers.some((member) => member.connected) ? 'connected' : callMembers.length > 0 ? 'connecting' : 'outgoing'
        this.update({ callMembers, invitedClientIds, status, message })
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

    start = async (collaborator: Collaborator) => {
        if (this.state.connection !== 'ready') return
        if (this.active) {
            this.invite(collaborator)
            return
        }
        const generation = this.begin(collaborator, 'connecting')
        this.update({ message: 'Autorisez le microphone pour démarrer l’appel.' })
        try {
            if (!await this.acquireMicrophone(generation)) return
            this.update({ status: 'outgoing', message: '' })
            this.invite(collaborator)
        } catch (failure) {
            this.mediaFailed(failure, generation)
        }
    }

    private invite(collaborator: Collaborator) {
        const { callMembers, invitedClientIds, status } = this.state
        const isAlreadyInCall = invitedClientIds.includes(collaborator.clientId)
            || callMembers.some((member) => member.collaborator.clientId === collaborator.clientId)
        if (!this.active || !this.localStream || status === 'incoming' || isAlreadyInCall) return
        if (callMembers.length + invitedClientIds.length + 1 >= MAX_CALL_MEMBERS) return
        const generation = this.generation
        this.update({ invitedClientIds: [...invitedClientIds, collaborator.clientId] })
        this.socket.timeout(10000).emit('call:invite', { targetClientId: collaborator.clientId }, (failure: Error | null, reply?: CallReply) => {
            if (!this.isCurrent(generation)) return
            if (failure || reply?.error || !reply?.callId) {
                const message = reply?.error || 'L’invitation n’a pas été confirmée par le serveur.'
                if (this.state.callMembers.length === 0 && this.state.invitedClientIds.length <= 1) this.finish('error', message)
                else this.dropMember(collaborator.clientId, message)
                return
            }
            this.callId = reply.callId
        })
    }

    private incoming = ({ callId, caller }: { callId: string; caller: Collaborator }) => {
        if (this.active) return
        this.begin(caller, 'incoming')
        this.callId = callId
    }

    accept = async () => {
        if (this.state.status !== 'incoming' || !this.callId) return
        const generation = this.generation
        this.update({ status: 'connecting', message: 'Autorisez le microphone pour rejoindre l’appel.' })
        try {
            if (!await this.acquireMicrophone(generation)) return
            this.socket.timeout(10000).emit('call:accept', { callId: this.callId }, (failure: Error | null, reply?: CallReply) => {
                if (!this.isCurrent(generation)) return
                if (failure || reply?.error || !reply?.callId || !reply.participants) {
                    this.finish('error', reply?.error || 'Le serveur n’a pas confirmé l’appel.')
                    return
                }
                this.update({ message: '' })
                this.setDeadline('La connexion audio prend trop de temps. Réessayez.', 30000)
                reply.participants.forEach((participant) => {
                    this.addMember(participant)
                    this.sendOffer(participant.clientId, generation)
                })
            })
        } catch (failure) {
            this.mediaFailed(failure, generation)
        }
    }

    private sendOffer(clientId: string, generation: number) {
        const link = this.createLink(clientId, generation)
        void (async () => {
            const offer = await link.peer.createOffer()
            if (!this.isLinkCurrent(generation, clientId, link)) return
            await link.peer.setLocalDescription(offer)
            if (this.isLinkCurrent(generation, clientId, link)) this.sendSignal(clientId, { description: offer })
        })().catch(() => {
            if (this.isLinkCurrent(generation, clientId, link)) this.dropMember(clientId, 'Impossible de négocier la connexion audio.')
        })
    }

    private accepted = ({ callId, clientId }: { callId: string; clientId: string }) => {
        if (!this.active || this.callId !== callId || !this.localStream) return
        const collaborator = this.state.collaborators.find((current) => current.clientId === clientId)
        if (!collaborator) return
        this.addMember(collaborator)
        this.createLink(clientId, this.generation)
        if (this.state.status !== 'connected') {
            this.update({ status: 'connecting', message: '' })
            this.setDeadline('La connexion audio prend trop de temps. Réessayez.', 30000)
        }
    }

    private sendSignal(clientId: string, signal: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
        if (this.socket.connected) this.socket.emit('call:signal', { targetClientId: clientId, ...signal })
    }

    private receiveSignal = (signal: CallSignal) => {
        const clientId = signal.clientId
        const link = this.links.get(clientId)
        if (!this.active || !link) return
        const generation = this.generation
        link.signalQueue = link.signalQueue.then(async () => {
            const peer = link.peer
            if (!this.isLinkCurrent(generation, clientId, link)) return
            if (signal.description) {
                await peer.setRemoteDescription(signal.description)
                if (!this.isLinkCurrent(generation, clientId, link)) return
                for (const candidate of link.candidates.splice(0)) {
                    await peer.addIceCandidate(candidate)
                    if (!this.isLinkCurrent(generation, clientId, link)) return
                }
                if (signal.description.type === 'offer') {
                    const answer = await peer.createAnswer()
                    if (!this.isLinkCurrent(generation, clientId, link)) return
                    await peer.setLocalDescription(answer)
                    if (this.isLinkCurrent(generation, clientId, link)) this.sendSignal(clientId, { description: answer })
                }
            } else if (signal.candidate) {
                if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate)
                else link.candidates.push(signal.candidate)
            }
        }).catch(() => {
            if (this.isLinkCurrent(generation, clientId, link)) this.dropMember(clientId, 'La négociation audio a échoué. Réessayez.')
        })
    }

    private left = ({ callId, clientId, reason }: { callId: string; clientId: string; reason: string }) => {
        if (callId !== this.callId) return
        const name = this.getName(clientId)
        this.dropMember(clientId, reason === 'declined' ? `${name} a refusé l’appel.` : `${name} a quitté l’appel.`)
    }

    private ended = ({ callId, reason }: { callId: string; reason: string }) => {
        if (callId !== this.callId) return
        const message = reason === 'declined'
            ? 'Le correspondant a refusé l’appel.'
            : this.state.callMembers.length > 1 ? 'Les autres participants ont quitté l’appel.' : 'Le correspondant a terminé l’appel.'
        this.finish('ended', message, false)
    }

    toggleMute = () => {
        if (this.state.status !== 'connected' || !this.localStream) return
        const muted = !this.state.muted
        this.localStream.getAudioTracks().forEach((track) => { track.enabled = !muted })
        this.update({ muted })
        if (this.socket.connected) this.socket.emit('call:mute', { muted })
    }

    private peerMuteChanged = ({ clientId, muted }: { clientId: string; muted: boolean }) => {
        if (this.active) this.updateMember(clientId, { muted })
    }

    hangUp = () => this.finish('ended', 'Appel terminé.')

    reset = () => {
        if (this.active) return
        this.update({ status: 'idle', participant: null, message: '', muted: false, callMembers: [], invitedClientIds: [] })
    }

    private finish(status: CallStatus, message: string, notifyPeer = true) {
        if (notifyPeer && this.active && this.socket.connected) this.socket.emit('call:hangup')
        this.active = false
        this.generation += 1
        this.callId = null
        clearTimeout(this.deadline)
        for (const clientId of [...this.links.keys()]) this.closeLink(clientId)
        this.localStream?.getTracks().forEach((track) => { track.onended = null; track.stop() })
        this.localStream = null
        this.update({ status, message, muted: false, callMembers: [], invitedClientIds: [] })
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
        this.socket.off('call:mute', this.peerMuteChanged)
        this.socket.off('call:left', this.left)
        this.socket.off('call:ended', this.ended)
        if (this.managesDocument) {
            if (this.socket.connected) this.socket.emit('document:leave')
            this.socket.disconnect()
        }
    }
}
