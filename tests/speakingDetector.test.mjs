import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SpeakingDetector, measureVolume } from '../src/audio/speakingDetector.ts'

test('mesure le volume efficace des échantillons', () => {
    assert.equal(measureVolume(new Float32Array([])), 0)
    assert.equal(measureVolume(new Float32Array(128)), 0)
    assert.ok(Math.abs(measureVolume(new Float32Array([0.5, -0.5, 0.5, -0.5])) - 0.5) < 1e-6)
})

test('s’allume dès que la voix dépasse le seuil et ignore le bruit de fond', () => {
    const detector = new SpeakingDetector(0.02, 300)
    assert.equal(detector.update(0.005, 0), false)
    assert.equal(detector.update(0.019, 100), false)
    assert.equal(detector.update(0.05, 200), true)
})

test('reste allumé pendant les courtes pauses puis s’éteint quand la voix s’arrête', () => {
    const detector = new SpeakingDetector(0.02, 300)
    assert.equal(detector.update(0.08, 0), true)
    assert.equal(detector.update(0.001, 200), true)
    assert.equal(detector.update(0.001, 299), true)
    assert.equal(detector.update(0.001, 300), false)
    assert.equal(detector.update(0.001, 1000), false)
    assert.equal(detector.update(0.06, 1100), true)
})
