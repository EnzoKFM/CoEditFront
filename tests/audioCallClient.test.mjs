import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AudioCallClient } from '../src/audio/AudioCallClient.ts'

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

    on(event, handler) { this.handlers.set(event, handler) }
    receive(event, payload) { this.handlers.get(event)?.(payload) }
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
