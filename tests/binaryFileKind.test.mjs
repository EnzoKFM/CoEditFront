import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatFileSize, getBinaryPreviewKind, getFileIcon, isBinaryFile } from '../src/documents/binaryFileKind.ts'

test('un document texte, sans type MIME, reste ouvert dans l’éditeur collaboratif', () => {
    assert.equal(isBinaryFile(null), false)
    assert.equal(isBinaryFile(undefined), false)
    assert.equal(isBinaryFile(''), false)
    assert.equal(getFileIcon(null), '📄')
})

test('un fichier avec un type MIME est traité comme un fichier binaire', () => {
    assert.equal(isBinaryFile('application/pdf'), true)
    assert.equal(isBinaryFile('application/octet-stream'), true)
})

test('seuls les PDF et les images ont un aperçu intégré', () => {
    assert.equal(getBinaryPreviewKind('application/pdf'), 'pdf')
    assert.equal(getBinaryPreviewKind('image/png'), 'image')
    assert.equal(getBinaryPreviewKind('image/svg+xml'), 'image')
    assert.equal(getBinaryPreviewKind('text/html'), 'download')
    assert.equal(getBinaryPreviewKind('application/octet-stream'), 'download')
})

test('l’icône dépend du type de fichier binaire', () => {
    assert.equal(getFileIcon('image/jpeg'), '🖼️')
    assert.equal(getFileIcon('application/pdf'), '📕')
    assert.equal(getFileIcon('application/zip'), '📎')
})

test('la taille est affichée en octets, Ko ou Mo', () => {
    assert.equal(formatFileSize(512), '512 o')
    assert.equal(formatFileSize(1536), '1,5 Ko')
    assert.equal(formatFileSize(20 * 1024 * 1024), '20,0 Mo')
})
