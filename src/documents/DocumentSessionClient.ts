import type { Socket } from 'socket.io-client'
import { invertOperation, operationFromChange } from './documentContent.ts'
import type { Collaborator, CollaboratorSelection, DocumentSessionObserver } from './types'
import { applyOperation, transformIndex, transformOperation, type TextOperation } from './textOperation.ts'

interface JoinReply {
    collaborators?: Collaborator[]
    content: string
    revision: number
    error?: string
}

interface OperationReply {
    revision?: number
    error?: string
}

interface RemoteOperation {
    revision: number
    operation: TextOperation
}

export interface DocumentState {
    status: 'loading' | 'ready' | 'offline' | 'error' | 'recovery'
    content: string | null
    dirty: boolean
    message: string
    canUndo: boolean
    canRedo: boolean
    collaborators: Collaborator[]
}

export class DocumentSessionClient {
    private socket: Socket
    private fileId: number
    private userName: string
    private observer?: DocumentSessionObserver
    private listeners = new Set<() => void>()
    private remoteListeners = new Set<(operation: TextOperation) => void>()
    private generation = 0
    private disposed = false
    private serverContent = ''
    private revision = 0
    private pending: TextOperation | null = null
    private queue: TextOperation[] = []
    private undoStack: TextOperation[] = []
    private redoStack: TextOperation[] = []
    private discardOnJoin = false
    private composing = false
    private deferredEvents: (() => void)[] = []
    private syncWaiters = new Set<(success: boolean) => void>()
    private state: DocumentState = {
        status: 'loading', content: null, dirty: false, message: '', canUndo: false, canRedo: false, collaborators: [],
    }

    constructor(socket: Socket, fileId: number, userName: string, observer?: DocumentSessionObserver) {
        this.socket = socket
        this.fileId = fileId
        this.userName = userName
        this.observer = observer
    }

    getSnapshot = () => this.state
    subscribe = (listener: () => void) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }
    subscribeRemote = (listener: (operation: TextOperation) => void) => {
        this.remoteListeners.add(listener)
        return () => { this.remoteListeners.delete(listener) }
    }

    private update(patch: Partial<DocumentState>) {
        if (this.disposed) return
        this.state = { ...this.state, ...patch, canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 }
        this.listeners.forEach((listener) => listener())
    }

    connect() {
        this.disposed = false
        this.socket.on('connect', this.join)
        this.socket.on('disconnect', this.disconnect)
        this.socket.on('connect_error', this.connectionError)
        this.socket.on('document:operation', this.receiveOperation)
        this.socket.on('presence:update', this.receivePresence)
        this.socket.on('presence:leave', this.receivePresenceLeave)
        this.socket.connect()
    }

    private resolveWaiters(success: boolean) {
        for (const resolve of this.syncWaiters) resolve(success)
        this.syncWaiters.clear()
    }

    private disconnect = () => {
        this.generation += 1
        this.deferredEvents = []
        this.composing = false
        this.update({ status: 'offline', message: 'Connexion perdue. Gardez cette page ouverte pour conserver le texte non transmis.' })
        this.resolveWaiters(false)
    }

    private connectionError = () => {
        this.update({ status: 'offline', message: 'Connexion impossible. Vérifiez le serveur ou reconnectez-vous à votre compte.' })
        this.resolveWaiters(false)
    }

    private join = () => {
        const generation = ++this.generation
        this.observer?.joining()
        this.update({ status: 'loading' })
        this.socket.timeout(10000).emit('document:join', { fileId: this.fileId, user: { name: this.userName } }, (failure: Error | null, reply?: JoinReply) => {
            if (this.disposed || generation !== this.generation || !this.socket.connected) return
            if (failure || reply?.error || typeof reply?.content !== 'string' || !Number.isInteger(reply.revision)) {
                this.observer?.failed(reply?.error || 'Impossible de rejoindre le document.')
                this.update({ status: 'error', message: reply?.error || 'Impossible de charger le document.' })
                return
            }
            this.serverContent = reply.content
            this.revision = reply.revision
            this.observer?.joined(reply.collaborators ?? [])
            if (this.state.dirty && !this.discardOnJoin && this.state.content !== reply.content) {
                this.update({ status: 'recovery', message: 'La connexion a été interrompue avant confirmation de toutes les modifications. Copiez ou téléchargez votre texte, puis rechargez la version du serveur. Il n’est pas renvoyé automatiquement pour éviter les doublons.' })
                return
            }
            this.pending = null
            this.queue = []
            this.undoStack = []
            this.redoStack = []
            this.discardOnJoin = false
            this.update({ status: 'ready', content: reply.content, dirty: false, message: '', collaborators: reply.collaborators ?? [] })
            this.resolveWaiters(true)
        })
    }

    updatePresence = (selection: CollaboratorSelection | null) => {
        if (this.state.status !== 'ready' || !this.socket.connected) return
        this.socket.emit('presence:update', { selection, pointer: null })
    }

    retry = () => {
        if (this.socket.connected) this.join()
        else this.socket.connect()
    }

    reload = () => {
        this.discardOnJoin = true
        this.retry()
    }

    private defer(action: () => void) {
        if (this.composing) this.deferredEvents.push(action)
        else action()
    }

    startComposition = () => { this.composing = true }
    endComposition = () => {
        this.composing = false
        for (const action of this.deferredEvents.splice(0)) action()
    }

    change = (content: string, preferredStart?: number) => {
        if (this.state.status !== 'ready' || this.state.content === null || content === this.state.content) return
        const operation = operationFromChange(this.state.content, content, preferredStart)
        if (!this.canSend(operation)) return
        this.undoStack.push(invertOperation(this.state.content, operation))
        if (this.undoStack.length > 100) this.undoStack.shift()
        this.redoStack = []
        this.applyLocal(operation)
    }

    private canSend(operation: TextOperation) {
        if (new TextEncoder().encode(JSON.stringify(operation)).length > 900000) {
            this.update({ message: 'Cet ajout est trop volumineux. Collez le texte en plusieurs parties.' })
            return false
        }
        return true
    }

    private applyLocal(operation: TextOperation) {
        const content = applyOperation(this.state.content ?? '', operation)
        this.queue.push(operation)
        this.transformCollaborators(operation)
        this.update({ content, dirty: true, message: '' })
        this.sendNext()
    }

    private sendNext() {
        if (this.pending || this.state.status !== 'ready' || !this.socket.connected) return
        this.pending = this.queue.shift() ?? null
        if (!this.pending) {
            this.update({ dirty: false })
            this.resolveWaiters(true)
            return
        }
        const generation = this.generation
        this.socket.timeout(15000).emit('document:operation', { revision: this.revision, operation: this.pending }, (failure: Error | null, reply?: OperationReply) => {
            this.defer(() => {
                if (this.disposed || generation !== this.generation || this.state.status !== 'ready') return
                if (failure || reply?.error || reply?.revision !== this.revision + 1 || !this.pending) {
                    this.recover(reply?.error || 'La transmission n’a pas été confirmée. Conservez votre texte avant de recharger le serveur.')
                    return
                }
                this.serverContent = applyOperation(this.serverContent, this.pending)
                this.revision = reply.revision
                this.pending = null
                this.sendNext()
            })
        })
    }

    private recover(message: string) {
        this.update({ status: 'recovery', message })
        this.resolveWaiters(false)
    }

    private transformHistory(stack: TextOperation[], remote: TextOperation) {
        for (let index = stack.length - 1; index >= 0; index -= 1) {
            [stack[index], remote] = transformOperation(stack[index], remote)
        }
    }

    private receiveOperation = (incoming: RemoteOperation) => {
        this.defer(() => {
            if (this.state.status !== 'ready') return
            try {
                if (incoming.revision !== this.revision + 1) throw new Error('Révision inattendue')
                this.serverContent = applyOperation(this.serverContent, incoming.operation)
                this.revision = incoming.revision
                let remote = incoming.operation
                if (this.pending) [this.pending, remote] = transformOperation(this.pending, remote)
                this.queue = this.queue.map((operation) => {
                    const [transformedLocal, transformedRemote] = transformOperation(operation, remote)
                    remote = transformedRemote
                    return transformedLocal
                })
                const content = applyOperation(this.state.content ?? '', remote)
                this.transformHistory(this.undoStack, remote)
                this.transformHistory(this.redoStack, remote)
                this.remoteListeners.forEach((listener) => listener(remote))
                this.transformCollaborators(remote)
                this.update({ content })
            } catch {
                this.recover('La synchronisation a été interrompue. Conservez votre texte avant de recharger la version du serveur.')
            }
        })
    }

    private receivePresence = (collaborator: Collaborator) => {
        if (this.disposed) return
        const collaborators = this.state.collaborators.filter((item) => item.clientId !== collaborator.clientId)
        collaborators.push(collaborator)
        this.update({ collaborators })
    }

    private receivePresenceLeave = ({ clientId }: { clientId: string }) => {
        this.update({ collaborators: this.state.collaborators.filter((collaborator) => collaborator.clientId !== clientId) })
    }

    private transformCollaborators(operation: TextOperation) {
        if (!this.state.collaborators.length) return
        this.update({
            collaborators: this.state.collaborators.map((collaborator) => {
                if (!collaborator.selection) return collaborator
                return {
                    ...collaborator,
                    selection: {
                        anchor: transformIndex(collaborator.selection.anchor, operation),
                        head: transformIndex(collaborator.selection.head, operation),
                    },
                }
            }),
        })
    }

    undo = () => this.applyHistory(this.undoStack, this.redoStack)
    redo = () => this.applyHistory(this.redoStack, this.undoStack)

    private applyHistory(source: TextOperation[], destination: TextOperation[]) {
        if (this.state.status !== 'ready' || this.composing || this.state.content === null) return
        const operation = source.at(-1)
        if (!operation || !this.canSend(operation)) return
        source.pop()
        destination.push(invertOperation(this.state.content, operation))
        this.remoteListeners.forEach((listener) => listener(operation))
        this.applyLocal(operation)
    }

    waitForSync = (): Promise<boolean> => {
        if (!this.state.dirty) return Promise.resolve(true)
        if (this.state.status !== 'ready') return Promise.resolve(false)
        return new Promise((resolve) => { this.syncWaiters.add(resolve) })
    }

    dispose() {
        this.resolveWaiters(false)
        this.disposed = true
        this.generation += 1
        this.deferredEvents = []
        if (this.socket.connected) this.socket.emit('document:leave')
        this.socket.off('connect', this.join)
        this.socket.off('disconnect', this.disconnect)
        this.socket.off('connect_error', this.connectionError)
        this.socket.off('document:operation', this.receiveOperation)
        this.socket.off('presence:update', this.receivePresence)
        this.socket.off('presence:leave', this.receivePresenceLeave)
        this.socket.disconnect()
    }
}
