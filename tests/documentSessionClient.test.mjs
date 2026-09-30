import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DocumentSessionClient } from '../src/documents/DocumentSessionClient.ts'
import { operationFromChange } from '../src/documents/documentContent.ts'
import { applyOperation, transformOperation } from '../src/documents/textOperation.ts'
import { renderMarkdown } from '../src/components/editor/markdown.ts'

class FakeSocket {
    connected = false
    listeners = new Map()
    requests = []
    on(event, listener) { this.listeners.set(event, listener) }
    timeout() { return this }
    emit(event, payload, acknowledge) { this.requests.push({ event, payload: structuredClone(payload), acknowledge }) }
    connect() { this.connected = true; this.receive('connect') }
    disconnect() { this.connected = false; this.receive('disconnect') }
    removeAllListeners() { this.listeners.clear() }
    receive(event, payload) { this.listeners.get(event)?.(payload) }
    reply(reply, failure = null) { this.requests.at(-1).acknowledge(failure, reply) }
}

function openDocument(content = 'Initial') {
    const socket = new FakeSocket()
    const client = new DocumentSessionClient(socket, 12, 'Alice')
    client.connect()
    socket.reply({ content, revision: 0 })
    return { socket, client }
}

function createNetwork(initial = '', count = 2) {
    const peers = Array.from({ length: count }, () => ({ ...openDocument(initial), messages: [], handled: 1 }))
    let content = initial
    const history = []
    function send(peer) {
        const request = peer.socket.requests[peer.handled++]
        if (!request || request.event !== 'document:operation') throw new Error('Requête inattendue')
        assert.deepEqual(Object.keys(request.payload).sort(), ['operation', 'revision'])
        let operation = request.payload.operation
        for (const previous of history.slice(request.payload.revision)) [operation] = transformOperation(operation, previous)
        content = applyOperation(content, operation)
        history.push(operation)
        const revision = history.length
        for (const recipient of peers) {
            recipient.messages.push(() => {
                if (recipient === peer) request.acknowledge(null, { revision })
                else recipient.socket.receive('document:operation', { revision, operation })
            })
        }
    }
    function deliver(peer) { peer.messages.shift()?.() }
    function flush() {
        let steps = 0
        while (peers.some(peer => peer.handled < peer.socket.requests.length || peer.messages.length)) {
            if (steps++ > 10000) throw new Error('Synchronisation bloquée')
            for (const peer of peers) {
                if (peer.handled < peer.socket.requests.length) send(peer)
                deliver(peer)
            }
        }
        for (const peer of peers) {
            assert.equal(peer.client.getSnapshot().content, content)
            assert.equal(peer.client.getSnapshot().dirty, false)
            assert.equal(peer.client.getSnapshot().status, 'ready')
        }
    }
    return { peers, send, deliver, flush, content: () => content }
}

test('chaque modification produit une opération texte, sans option de sauvegarde spéciale', () => {
    const { socket, client } = openDocument('bonjour')
    client.change('bonXjour', 3)
    assert.deepEqual(socket.requests.at(-1).payload, { revision: 0, operation: [{ retain: 3 }, { insert: 'X' }, { retain: 4 }] })
    socket.reply({ revision: 1 })
    assert.equal(client.getSnapshot().dirty, false)
})

test('la position de frappe est respectée pour des caractères identiques', () => {
    assert.deepEqual(operationFromChange('aaa', 'aaaa', 1), [{ retain: 1 }, { insert: 'a' }, { retain: 2 }])
})

test('deux insertions au même endroit et des frappes en attente convergent', () => {
    const network = createNetwork('Bonjour')
    const [alice, bob] = network.peers
    alice.client.change('A Bonjour')
    alice.client.change('AA Bonjour')
    bob.client.change('B Bonjour')
    network.send(bob)
    network.deliver(alice)
    network.flush()
    assert.match(network.content(), /AA /)
    assert.match(network.content(), /B /)
})

test('annuler et rétablir ne retire pas le texte ajouté par une autre personne', () => {
    const network = createNetwork('Bonjour')
    const [alice, bob] = network.peers
    alice.client.change('Bonjour Alice')
    network.flush()
    bob.client.change('Salut Bonjour Alice')
    network.flush()
    alice.client.undo()
    network.flush()
    assert.equal(network.content(), 'Salut Bonjour')
    alice.client.redo()
    network.flush()
    assert.equal(network.content(), 'Salut Bonjour Alice')
})

test('une suppression concurrente et une insertion dans la zone supprimée convergent', () => {
    const network = createNetwork('abcdef')
    network.peers[0].client.change('af')
    network.peers[1].client.change('abcXdef')
    network.flush()
    assert.equal(network.content(), 'aXf')
})

test('trois clients convergent malgré les retards, les suppressions et les annulations', () => {
    const network = createNetwork('Départ', 3)
    let seed = 173
    const random = (maximum) => { seed = (seed * 16807) % 2147483647; return seed % maximum }
    for (let step = 0; step < 1500; step += 1) {
        const peer = network.peers[random(3)]
        const action = random(6)
        if (action < 2) {
            const content = peer.client.getSnapshot().content
            const position = random(content.length + 1)
            const next = action === 0 ? content.slice(0, position) + 'abc'[random(3)] + content.slice(position) : content.slice(0, position) + content.slice(position + 1)
            peer.client.change(next, position)
        } else if (action === 2 && peer.handled < peer.socket.requests.length) network.send(peer)
        else if (action === 3) network.deliver(peer)
        else if (action === 4) peer.client.undo()
        else peer.client.redo()
    }
    network.flush()
})

test('les événements distants attendent la fin de la composition', () => {
    const network = createNetwork('Texte')
    const [alice, bob] = network.peers
    alice.client.startComposition()
    alice.client.change('Texte é')
    bob.client.change('Mon Texte')
    network.send(bob)
    network.deliver(alice)
    assert.equal(alice.client.getSnapshot().content, 'Texte é')
    alice.client.endComposition()
    network.flush()
    assert.equal(network.content(), 'Mon Texte é')
})

test('une réponse perdue ne provoque pas un renvoi qui dupliquerait la frappe', async () => {
    const { socket, client } = openDocument()
    client.change('Initial!')
    const confirmation = client.waitForSync()
    socket.disconnect()
    assert.equal(await confirmation, false)
    socket.connect()
    socket.reply({ content: 'Initial', revision: 0 })
    assert.equal(client.getSnapshot().status, 'recovery')
    assert.equal(client.getSnapshot().content, 'Initial!')
    assert.equal(socket.requests.filter(request => request.event === 'document:operation').length, 1)
    client.reload()
    socket.reply({ content: 'Serveur', revision: 1 })
    assert.equal(client.getSnapshot().content, 'Serveur')
    assert.equal(client.getSnapshot().dirty, false)
})

test('une reconnexion retrouve une frappe déjà acceptée sans la rejouer', () => {
    const { socket, client } = openDocument()
    client.change('Initial!')
    socket.disconnect()
    socket.connect()
    socket.reply({ content: 'Initial!', revision: 1 })
    assert.equal(client.getSnapshot().status, 'ready')
    assert.equal(client.getSnapshot().dirty, false)
})

test('un refus conserve le texte et interdit de continuer avec une révision incertaine', () => {
    const { socket, client } = openDocument()
    client.change('Mon travail')
    socket.reply({ error: 'Révision trop ancienne', isResyncRequired: true })
    assert.equal(client.getSnapshot().status, 'recovery')
    assert.equal(client.getSnapshot().content, 'Mon travail')
    assert.equal(client.getSnapshot().dirty, true)
})

test('le Markdown est rendu sans exécuter le HTML ni les liens javascript', () => {
    const preview = renderMarkdown('# Titre\n\n**Gras**\n\n<script>alert(1)</script>\n\n[piège](javascript:alert(1))')
    assert.match(preview, /<h1>Titre<\/h1>/)
    assert.match(preview, /<strong>Gras<\/strong>/)
    assert.doesNotMatch(preview, /<script>|href="javascript:/)
})
