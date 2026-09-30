import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RINGTONE_PATTERNS, RingtonePlayer } from '../src/audio/ringtone.ts'

class FakeAudioParam {
    value = 0
    setValueAtTime() {}
    linearRampToValueAtTime() {}
}

class FakeOscillator {
    frequency = new FakeAudioParam()
    type = 'sine'
    onended = null
    startedAt = null
    stoppedAt = null
    stoppedNow = false

    constructor(context) {
        this.context = context
    }

    connect() {}

    start(time) {
        this.startedAt = time
    }

    stop(time) {
        if (time === undefined) this.stoppedNow = true
        else this.stoppedAt = time
    }
}

class FakeAudioContext {
    state = 'running'
    currentTime = 10
    destination = {}
    oscillators = []
    resumeCount = 0

    createOscillator() {
        const oscillator = new FakeOscillator(this)
        this.oscillators.push(oscillator)
        return oscillator
    }

    createGain() {
        return { gain: new FakeAudioParam(), connect() {}, disconnect() {} }
    }

    resume() {
        this.resumeCount += 1
        this.state = 'running'
        return Promise.resolve()
    }
}

function createPlayer() {
    const context = new FakeAudioContext()
    return { context, player: new RingtonePlayer(() => context) }
}

test('joue la tonalité de retour d’appel à 440 Hz pour celui qui appelle', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { context, player } = createPlayer()

    player.start('outgoing')

    assert.deepEqual(context.oscillators.map((oscillator) => oscillator.frequency.value), [440])
    assert.equal(context.oscillators[0].startedAt, 10)
    assert.equal(context.oscillators[0].stoppedAt, 11.5)
    player.stop()
})

test('joue la sonnerie à deux notes pour celui qu’on appelle', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { context, player } = createPlayer()

    player.start('incoming')

    assert.deepEqual(context.oscillators.map((oscillator) => oscillator.frequency.value), [880, 660, 880, 660])
    player.stop()
})

test('répète la sonnerie à chaque cycle tant qu’elle n’est pas arrêtée', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { context, player } = createPlayer()

    player.start('outgoing')
    t.mock.timers.tick(RINGTONE_PATTERNS.outgoing.cycleMs * 2)

    assert.equal(context.oscillators.length, 3)
    player.stop()
})

test('arrête immédiatement les sons en cours et ne relance plus de cycle', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { context, player } = createPlayer()

    player.start('incoming')
    player.stop()
    t.mock.timers.tick(RINGTONE_PATTERNS.incoming.cycleMs * 3)

    assert.equal(context.oscillators.length, 4)
    assert.ok(context.oscillators.every((oscillator) => oscillator.stoppedNow))
})

test('remplace la sonnerie en cours quand une autre démarre', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { context, player } = createPlayer()

    player.start('outgoing')
    player.start('incoming')

    assert.ok(context.oscillators[0].stoppedNow)
    assert.deepEqual(context.oscillators.slice(1).map((oscillator) => oscillator.frequency.value), [880, 660, 880, 660])
    player.stop()
})

test('réveille un contexte audio suspendu (bloqué avant la première interaction)', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { context, player } = createPlayer()
    context.state = 'suspended'

    player.unlock()

    assert.equal(context.resumeCount, 1)
    assert.equal(context.state, 'running')
})

test('ne fait rien sans Web Audio disponible', () => {
    const player = new RingtonePlayer(() => null)

    assert.doesNotThrow(() => {
        player.unlock()
        player.start('incoming')
        player.stop()
    })
})
