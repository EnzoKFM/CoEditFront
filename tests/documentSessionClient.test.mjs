import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DocumentSessionClient } from '../src/documents/DocumentSessionClient.ts'
import { applyDocumentOperation, decodeDocument, encodeDocument, replaceDocument } from '../src/documents/documentContent.ts'

class FakeSocket {
    connected = false
    listeners = new Map()
    requests = []
    on(event, listener) { this.listeners.set(event, listener) }
    timeout() { return this }
    emit(event, payload, acknowledge) { this.requests.push({ event, payload, acknowledge }) }
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
    socket.reply({ content, revision: 0, capabilities: { snapshotSave: true } })
    return { socket, client }
}

test('le texte existant reste du texte et la mise en forme fait un aller-retour sans perte', () => {
    const plain = decodeDocument('<b>Texte</b>\nSuite')
    assert.equal(plain.content[0].content[0].text, '<b>Texte</b>')
    const rich = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour', marks: [{ type: 'bold' }] }] }] }
    assert.deepEqual(decodeDocument(encodeDocument(rich)), rich)
    assert.equal(applyDocumentOperation('ancien', replaceDocument('ancien', encodeDocument(rich))), encodeDocument(rich))
    assert.throws(() => decodeDocument('COEDIT_RICH_TEXT_V1\n{"type":"doc","content":[{"type":"inconnu"}]}'))
})

test('une réponse sans persistance confirmée ne marque pas le document enregistré', async () => {
    const { socket, client } = openDocument()
    client.change(decodeDocument('Modification'))
    const saving = client.save()
    socket.reply({ revision: 1, persisted: false, error: 'Base indisponible' })
    assert.equal(await saving, false)
    assert.equal(client.getSnapshot().dirty, true)
    const retry = client.save()
    assert.equal(socket.requests.at(-1).payload.expectedRevision, 1)
    socket.reply({ revision: 2, persisted: true })
    assert.equal(await retry, true)
    assert.equal(client.getSnapshot().dirty, false)
})

test('une modification distante reçue avant notre accusé est appliquée après lui', async () => {
    const { socket, client } = openDocument()
    const local = encodeDocument(decodeDocument('Local'))
    const remote = encodeDocument(decodeDocument('Distant'))
    client.change(decodeDocument('Local'))
    const saving = client.save()
    socket.receive('document:operation', { revision: 2, operation: replaceDocument(local, remote) })
    socket.reply({ revision: 1, persisted: true })
    assert.equal(await saving, true)
    assert.deepEqual(client.getSnapshot().content, decodeDocument(remote))
    assert.equal(client.getSnapshot().conflict, false)
})

test('une reconnexion protège les modifications locales si le serveur a changé', () => {
    const { socket, client } = openDocument()
    const local = decodeDocument('Travail hors ligne')
    client.change(local)
    socket.disconnect()
    socket.connect()
    socket.reply({ content: 'Nouveau contenu', revision: 1, capabilities: { snapshotSave: true } })
    assert.deepEqual(client.getSnapshot().content, local)
    assert.equal(client.getSnapshot().conflict, true)
    assert.equal(client.getSnapshot().dirty, true)
})

test('une réponse tardive après une déconnexion ne confirme pas la sauvegarde', async () => {
    const { socket, client } = openDocument()
    client.change(decodeDocument('Local'))
    const saving = client.save()
    socket.disconnect()
    socket.reply({ revision: 1, persisted: true })
    assert.equal(await saving, false)
    assert.equal(client.getSnapshot().dirty, true)
    assert.equal(client.getSnapshot().status, 'offline')
})

test('une reconnexion ne lève pas un conflit déjà détecté', async () => {
    const { socket, client } = openDocument()
    client.change(decodeDocument('Version locale'))
    socket.receive('document:operation', { revision: 1, operation: replaceDocument('Initial', 'Version distante') })
    assert.equal(client.getSnapshot().conflict, true)
    socket.disconnect()
    socket.connect()
    socket.reply({ content: 'Version distante', revision: 1, capabilities: { snapshotSave: true } })
    assert.equal(client.getSnapshot().conflict, true)
    assert.equal(await client.save(), false)
})

test('un rechargement échoué conserve le brouillon et son avertissement de sortie', () => {
    const { socket, client } = openDocument()
    const local = decodeDocument('À conserver')
    client.change(local)
    client.reload()
    socket.reply({ error: 'Fichier indisponible' })
    assert.equal(client.getSnapshot().dirty, true)
    assert.deepEqual(client.getSnapshot().content, local)
    client.retry()
    socket.reply({ content: 'Serveur', revision: 2, capabilities: { snapshotSave: true } })
    assert.equal(client.getSnapshot().dirty, false)
    assert.deepEqual(client.getSnapshot().content, decodeDocument('Serveur'))
})

test('un serveur ancien ne peut pas recevoir une sauvegarde sans protection', async () => {
    const socket = new FakeSocket()
    const client = new DocumentSessionClient(socket, 12, 'Alice')
    client.connect()
    socket.reply({ content: '', revision: 0 })
    client.change(decodeDocument('Nouveau'))
    assert.equal(await client.save(), false)
    assert.equal(socket.requests.length, 1)
    assert.equal(client.getSnapshot().status, 'error')
})

test('la limite tient compte des caractères échappés dans le message Socket.IO', async () => {
    const { socket, client } = openDocument()
    client.change(decodeDocument('"'.repeat(250000)))
    assert.equal(await client.save(), false)
    assert.equal(socket.requests.length, 1)
    assert.match(client.getSnapshot().message, /volumineux/)
})
