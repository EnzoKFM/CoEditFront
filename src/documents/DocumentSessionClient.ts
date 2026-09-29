import type { JSONContent } from '@tiptap/react'
import type { Socket } from 'socket.io-client'
import { applyDocumentOperation, decodeDocument, encodeDocument, replaceDocument, type TextOperation } from './documentContent.ts'

interface JoinReply {
    content: string
    revision: number
    capabilities?: { snapshotSave?: boolean }
    error?: string
}

interface SaveReply {
    revision?: number
    persisted?: boolean
    error?: string
    isConflict?: boolean
    isResyncRequired?: boolean
}

interface RemoteOperation {
    revision: number
    operation: TextOperation
}

export interface DocumentState {
    status: 'loading' | 'ready' | 'offline' | 'error'
    content: JSONContent | null
    editorVersion: number
    dirty: boolean
    saving: boolean
    conflict: boolean
    saved: boolean
    message: string
}

export class DocumentSessionClient {
    private socket: Socket
    private fileId: number
    private userName: string
    private listeners = new Set<() => void>()
    private generation = 0
    private disposed = false
    private serverContent = ''
    private revision = 0
    private baseline = ''
    private supportsSave = false
    private discardOnJoin = false
    private pendingRemote: RemoteOperation[] = []
    private state: DocumentState = {
        status: 'loading', content: null, editorVersion: 0, dirty: false,
        saving: false, conflict: false, saved: false, message: '',
    }

    constructor(socket: Socket, fileId: number, userName: string) {
        this.socket = socket
        this.fileId = fileId
        this.userName = userName
    }

    getSnapshot = () => this.state
    subscribe = (listener: () => void) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    private update(patch: Partial<DocumentState>) {
        if (this.disposed) return
        this.state = { ...this.state, ...patch }
        this.listeners.forEach((listener) => listener())
    }

    connect() {
        this.disposed = false
        this.socket.on('connect', this.join)
        this.socket.on('disconnect', this.disconnect)
        this.socket.on('connect_error', this.connectionError)
        this.socket.on('document:operation', this.receiveOperation)
        this.socket.connect()
    }

    private disconnect = () => {
        this.generation += 1
        this.pendingRemote = []
        this.update({ status: 'offline', saving: false, saved: false, message: 'Connexion perdue. Vos modifications restent dans cette page. Ne la fermez pas.' })
    }

    private connectionError = () => {
        this.update({ status: 'offline', message: 'Connexion impossible. Vérifiez le serveur ou reconnectez-vous à votre compte.' })
    }

    private join = () => {
        const generation = ++this.generation
        this.socket.timeout(10000).emit('document:join', { fileId: this.fileId, user: { name: this.userName } }, (failure: Error | null, reply?: JoinReply) => {
            if (this.disposed || generation !== this.generation || !this.socket.connected) return
            if (failure || reply?.error || typeof reply?.content !== 'string') {
                this.update({ status: 'error', message: reply?.error || 'Impossible de charger le document.' })
                return
            }
            try {
                const content = decodeDocument(reply.content)
                const changedWhileOffline = this.state.dirty && (this.state.conflict || this.serverContent !== reply.content)
                this.supportsSave = reply.capabilities?.snapshotSave === true
                this.serverContent = reply.content
                this.revision = reply.revision
                this.pendingRemote = []
                if (this.state.dirty && !this.discardOnJoin) {
                    this.update({ status: 'ready', conflict: changedWhileOffline, message: changedWhileOffline ? 'Le document a changé sur le serveur. Rechargez sa version avant de continuer.' : '' })
                } else {
                    this.baseline = encodeDocument(content)
                    this.update({ status: 'ready', content, dirty: false, conflict: false, editorVersion: this.state.editorVersion + 1, message: '' })
                }
                this.discardOnJoin = false
                if (!this.supportsSave) this.update({ status: 'error', message: 'Le back doit être mis à jour pour sécuriser la sauvegarde des documents mis en forme.' })
            } catch {
                this.update({ status: 'error', message: 'Ce document contient un format non reconnu. Son contenu n’a pas été modifié.' })
            }
        })
    }

    retry = () => {
        if (this.socket.connected) this.join()
        else this.socket.connect()
    }

    change = (content: JSONContent) => {
        this.update({ content, dirty: encodeDocument(content) !== this.baseline, saved: false })
    }

    private receiveOperation = (incoming: RemoteOperation) => {
        if (this.state.saving) {
            this.pendingRemote.push(incoming)
            return
        }
        this.applyRemote(incoming)
    }

    private applyRemote(incoming: RemoteOperation) {
        try {
            if (incoming.revision !== this.revision + 1) throw new Error('Révision inattendue')
            this.serverContent = applyDocumentOperation(this.serverContent, incoming.operation)
            this.revision = incoming.revision
            if (this.state.dirty) {
                this.update({ conflict: true, saved: false, message: 'Une autre personne a modifié ce fichier. Votre version est conservée ici ; rechargez la version du serveur pour reprendre.' })
                return
            }
            const content = decodeDocument(this.serverContent)
            this.baseline = encodeDocument(content)
            this.update({ content, conflict: false, editorVersion: this.state.editorVersion + 1, saved: false, message: 'Document mis à jour depuis le serveur.' })
        } catch {
            this.update({ conflict: true, saved: false, message: 'Le document doit être rechargé avant une nouvelle sauvegarde.' })
        }
    }

    reload = () => {
        if (this.state.saving) return
        this.discardOnJoin = true
        this.update({ status: 'loading', saved: false })
        this.retry()
    }

    save = (): Promise<boolean> => {
        if (!this.state.dirty) return Promise.resolve(true)
        if (!this.state.content || this.state.saving || this.state.conflict || this.state.status !== 'ready' || !this.supportsSave) return Promise.resolve(false)
        const content = encodeDocument(this.state.content)
        const request = {
            revision: this.revision,
            expectedRevision: this.revision,
            persist: true,
            operation: replaceDocument(this.serverContent, content),
        }
        if (new TextEncoder().encode(JSON.stringify(request)).length > 900000) {
            this.update({ message: 'Le document est trop volumineux pour être envoyé en une sauvegarde.' })
            return Promise.resolve(false)
        }
        const generation = this.generation
        this.update({ saving: true, message: '', saved: false })
        return new Promise((resolve) => {
            this.socket.timeout(15000).emit('document:operation', request, (failure: Error | null, reply?: SaveReply) => {
                if (this.disposed || generation !== this.generation) { resolve(false); return }
                if (typeof reply?.revision === 'number') {
                    this.serverContent = content
                    this.revision = reply.revision
                }
                const succeeded = !failure && !reply?.error && reply?.persisted === true
                if (succeeded) this.baseline = content
                this.update({ saving: false, dirty: !succeeded, saved: succeeded, message: succeeded ? '' : reply?.error || 'Sauvegarde non confirmée. Votre texte reste disponible ici.' })
                for (const incoming of this.pendingRemote.splice(0)) this.applyRemote(incoming)
                if (failure || reply?.isConflict || reply?.isResyncRequired) {
                    this.update({ conflict: true, message: reply?.error || 'La sauvegarde n’a pas été confirmée. Rechargez le serveur pour vérifier son contenu.' })
                }
                resolve(succeeded)
            })
        })
    }

    dispose() {
        this.disposed = true
        this.generation += 1
        if (this.socket.connected) this.socket.emit('document:leave')
        this.socket.removeAllListeners()
        this.socket.disconnect()
    }
}
