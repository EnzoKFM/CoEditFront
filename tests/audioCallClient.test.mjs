import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AudioCallClient } from '../src/audio/AudioCallClient.ts'
import { DocumentSessionClient } from '../src/documents/DocumentSessionClient.ts'

class FakeSocket {
    id = 'local'
    connected = false
    handlers = new Map()
    sent = []
    replies = {
        'document:join': { collaborators: [] },
        'call:invite': { callId: 'call-1' },
        'call:accept': { callId: 'call-1' },
    }

    on(event, handler) {
        if (!this.handlers.has(event)) this.handlers.set(event, new Set())
        this.handlers.get(event).add(handler)
    }
    off(event, handler) { this.handlers.get(event)?.delete(handler) }
    receive(event, payload) { this.handlers.get(event)?.forEach(handler => handler(payload)) }
    timeout() { return this }
    emit(event, payload, acknowledge) {
        this.sent.push({ event, payload })
        acknowledge?.(null, this.replies[event])
    }
    connect() { this.connected = true; this.receive('connect') }
    disconnect() { this.connected = false }
    removeAllListeners() { this.handlers.clear() }
}

class FakePeer {
    remoteDescription = null
    candidates = []
    closed = false
    connectionState = 'new'
    addTrack() {}
    async createOffer() { return { type: 'offer', sdp: 'offre' } }
    async createAnswer() { return { type: 'answer', sdp: 'réponse' } }
    async setLocalDescription(description) { this.localDescription = description }
    async setRemoteDescription(description) { this.remoteDescription = description }
    async addIceCandidate(candidate) {
        assert.ok(this.remoteDescription)
        this.candidates.push(candidate)
    }
    close() { this.closed = true }
}

const participant = { clientId: 'remote', user: { name: 'Collègue' } }
const settle = () => new Promise((resolve) => setImmediate(resolve))

function setup(acquireMicrophone) {
    const socket = new FakeSocket()
    const track = { enabled: true, stopped: false, stop() { this.stopped = true } }
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
    const peer = new FakePeer()
    const client = new AudioCallClient(socket, 12, 'Utilisateur', {
        acquireMicrophone: acquireMicrophone ?? (async () => stream),
        createPeer: () => peer,
    })
    client.connect()
    return { client, socket, track, stream, peer }
}

test('rejoint le document et met à jour la présence', (context) => {
    const { client, socket } = setup()
    context.after(() => client.dispose())
    assert.equal(socket.sent[0].payload.fileId, 12)
    socket.receive('presence:update', participant)
    assert.equal(client.getSnapshot().collaborators.length, 1)
    socket.receive('presence:leave', { clientId: 'remote' })
    assert.equal(client.getSnapshot().collaborators.length, 0)
})

test('un micro accordé après annulation est immédiatement arrêté, sans invitation', async (context) => {
    let grantMicrophone
    const permission = new Promise((resolve) => { grantMicrophone = resolve })
    const { client, socket, stream, track } = setup(() => permission)
    context.after(() => client.dispose())
    const pending = client.start(participant)
    client.hangUp()
    grantMicrophone(stream)
    await pending
    assert.equal(track.stopped, true)
    assert.equal(socket.sent.some(({ event }) => event === 'call:invite'), false)
})

test('le refus du micro ne laisse pas une invitation ouverte', async (context) => {
    const { client, socket } = setup(async () => { throw new DOMException('Refus', 'NotAllowedError') })
    context.after(() => client.dispose())
    await client.start(participant)
    assert.equal(client.getSnapshot().status, 'error')
    assert.match(client.getSnapshot().message, /refusé/)
    assert.equal(socket.sent.some(({ event }) => event === 'call:invite'), false)
})

test('stocke les candidats ICE reçus avant la description distante', async (context) => {
    const { client, socket, peer } = setup()
    context.after(() => client.dispose())
    socket.receive('call:incoming', { callId: 'call-1', caller: participant })
    await client.accept()
    socket.receive('call:signal', { clientId: 'remote', candidate: { candidate: 'ice-1' } })
    await settle()
    assert.equal(peer.candidates.length, 0)
    socket.receive('call:signal', { clientId: 'remote', description: { type: 'offer', sdp: 'offre' } })
    await settle()
    assert.equal(peer.candidates.length, 1)
    assert.ok(socket.sent.some(({ event, payload }) => event === 'call:signal' && payload.description?.type === 'answer'))
})

test('coupe réellement la piste puis ferme les ressources au raccrochage', async (context) => {
    const { client, socket, peer, track } = setup()
    context.after(() => client.dispose())
    await client.start(participant)
    socket.receive('call:accepted', { callId: 'call-1', clientId: 'remote' })
    await settle()
    assert.ok(socket.sent.some(({ payload }) => payload?.description?.type === 'offer'))
    peer.connectionState = 'connected'
    peer.onconnectionstatechange()
    client.toggleMute()
    assert.equal(track.enabled, false)
    client.toggleMute()
    assert.equal(track.enabled, true)
    socket.receive('call:ended', { callId: 'call-1', reason: 'hangup' })
    assert.equal(track.stopped, true)
    assert.equal(peer.closed, true)
    assert.equal(client.getSnapshot().status, 'ended')
})

test('refuser un appel ne demande pas le microphone', (context) => {
    let requested = false
    const { client, socket } = setup(async () => { requested = true })
    context.after(() => client.dispose())
    socket.receive('call:incoming', { callId: 'call-1', caller: participant })
    client.hangUp()
    assert.equal(requested, false)
    assert.equal(socket.sent.at(-1).event, 'call:hangup')
})

test('une déconnexion arrête le micro et une reconnexion rejoint le salon', async (context) => {
    const { client, socket, track } = setup()
    context.after(() => client.dispose())
    await client.start(participant)
    socket.connected = false
    socket.receive('disconnect')
    assert.equal(track.stopped, true)
    assert.equal(client.getSnapshot().connection, 'error')
    socket.connect()
    assert.equal(client.getSnapshot().connection, 'ready')
    assert.equal(client.getSnapshot().status, 'error')
})

test('supporte un montage, nettoyage et remontage React StrictMode', (context) => {
    const { client, socket } = setup()
    context.after(() => client.dispose())
    client.dispose()
    client.connect()
    socket.receive('call:incoming', { callId: 'call-2', caller: participant })
    assert.equal(client.getSnapshot().status, 'incoming')
})

function setupSharedSession() {
    const socket = new FakeSocket()
    socket.replies['document:join'] = { content: 'Bonjour', revision: 0, collaborators: [participant] }
    socket.replies['document:operation'] = { revision: 1 }
    const track = { enabled: true, stopped: false, stop() { this.stopped = true } }
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
    const peer = new FakePeer()
    const audio = new AudioCallClient(socket, 12, 'Alice', {
        acquireMicrophone: async () => stream,
        createPeer: () => peer,
    }, false)
    const document = new DocumentSessionClient(socket, 12, 'Alice', {
        joining: audio.joiningDocument,
        joined: audio.joinedDocument,
        failed: audio.documentFailed,
    })
    audio.connect()
    document.connect()
    return { socket, audio, document, track, peer, dispose() { audio.dispose(); document.dispose() } }
}

test('éditeur et audio rejoignent le document une seule fois et partagent sa présence', (context) => {
    const session = setupSharedSession()
    context.after(session.dispose)
    assert.equal(session.socket.sent.filter(message => message.event === 'document:join').length, 1)
    assert.equal(session.document.getSnapshot().content, 'Bonjour')
    assert.deepEqual(session.audio.getSnapshot().collaborators, [participant])
    assert.equal(session.audio.getSnapshot().connection, 'ready')
})

test('détruire le panneau audio arrête le micro sans déconnecter ni désabonner l’éditeur', async (context) => {
    const session = setupSharedSession()
    context.after(session.dispose)
    await session.audio.start(participant)
    session.audio.dispose()
    assert.equal(session.track.stopped, true)
    assert.equal(session.peer.closed, true)
    assert.equal(session.socket.connected, true)
    assert.equal(session.socket.sent.some(message => message.event === 'document:leave'), false)
    session.document.change('Bonjour !')
    assert.equal(session.document.getSnapshot().dirty, false)
    session.socket.receive('document:operation', { revision: 2, operation: [{ insert: 'Salut ' }, { retain: 9 }] })
    assert.equal(session.document.getSnapshot().content, 'Salut Bonjour !')
})

test('une reconnexion rejoint une seule fois le fichier et réinitialise la présence audio', async (context) => {
    const session = setupSharedSession()
    context.after(session.dispose)
    await session.audio.start(participant)
    session.socket.connected = false
    session.socket.receive('disconnect')
    assert.equal(session.document.getSnapshot().status, 'offline')
    assert.equal(session.track.stopped, true)
    assert.deepEqual(session.audio.getSnapshot().collaborators, [])
    session.socket.replies['document:join'].collaborators = []
    session.socket.connect()
    assert.equal(session.socket.sent.filter(message => message.event === 'document:join').length, 2)
    assert.equal(session.document.getSnapshot().status, 'ready')
    assert.equal(session.audio.getSnapshot().connection, 'ready')
    assert.equal(session.audio.getSnapshot().status, 'idle')
})

test('un refus du document ne rend pas le panneau audio disponible', (context) => {
    const session = setupSharedSession()
    context.after(session.dispose)
    session.socket.replies['document:join'] = { error: 'Fichier introuvable' }
    session.document.retry()
    assert.equal(session.document.getSnapshot().status, 'error')
    assert.equal(session.audio.getSnapshot().connection, 'error')
    assert.deepEqual(session.audio.getSnapshot().collaborators, [])
})

test('le remontage StrictMode conserve les abonnés et ne duplique pas les invitations', (context) => {
    const session = setupSharedSession()
    context.after(session.dispose)
    let changes = 0
    session.audio.subscribe(() => { changes += 1 })
    session.dispose()
    session.audio.connect()
    session.document.connect()
    const changesBeforeInvite = changes
    session.socket.receive('call:incoming', { callId: 'call-2', caller: participant })
    assert.equal(changes, changesBeforeInvite + 1)
    assert.equal(session.audio.getSnapshot().status, 'incoming')
})
