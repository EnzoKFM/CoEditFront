import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatRelativeTime } from '../src/lib/formatDate.ts'

const now = new Date('2026-09-30T12:00:00.000Z')

function secondsBefore(seconds) {
    return new Date(now.getTime() - seconds * 1000).toISOString()
}

test('affiche « à l’instant » pour moins d’une minute', () => {
    assert.equal(formatRelativeTime(secondsBefore(0), now), 'à l’instant')
    assert.equal(formatRelativeTime(secondsBefore(59), now), 'à l’instant')
})

test('choisit l’unité la plus grande qui convient', () => {
    assert.equal(formatRelativeTime(secondsBefore(5 * 60), now), 'il y a 5 minutes')
    assert.equal(formatRelativeTime(secondsBefore(3 * 3600), now), 'il y a 3 heures')
    assert.equal(formatRelativeTime(secondsBefore(24 * 3600), now), 'hier')
    assert.equal(formatRelativeTime(secondsBefore(3 * 24 * 3600), now), 'il y a 3 jours')
    assert.equal(formatRelativeTime(secondsBefore(14 * 24 * 3600), now), 'il y a 2 semaines')
    assert.equal(formatRelativeTime(secondsBefore(400 * 24 * 3600), now), 'l’année dernière')
})
