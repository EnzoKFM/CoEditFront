import { getSchema, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const formatPrefix = 'COEDIT_RICH_TEXT_V1\n'
const documentSchema = getSchema([StarterKit.configure({ heading: { levels: [1, 2, 3] } })])

export function decodeDocument(content: string): JSONContent {
    if (content.startsWith(formatPrefix)) {
        const document = JSON.parse(content.slice(formatPrefix.length)) as JSONContent
        if (document.type !== 'doc' || !Array.isArray(document.content)) {
            throw new Error('Le format du document est invalide.')
        }
        documentSchema.nodeFromJSON(document).check()
        return document
    }
    return {
        type: 'doc',
        content: content.split('\n').map((line) => ({
            type: 'paragraph',
            ...(line ? { content: [{ type: 'text', text: line }] } : {}),
        })),
    }
}

export function encodeDocument(document: JSONContent): string {
    return formatPrefix + JSON.stringify(document)
}

export type TextOperation = ({ retain: number } | { insert: string } | { delete: number })[]

export function replaceDocument(previous: string, next: string): TextOperation {
    return [
        ...(next.length ? [{ insert: next }] : []),
        ...(previous.length ? [{ delete: previous.length }] : []),
    ]
}

export function applyDocumentOperation(content: string, operation: TextOperation): string {
    let position = 0
    let result = ''
    for (const component of operation) {
        if ('insert' in component) result += component.insert
        else if ('retain' in component) {
            result += content.slice(position, position + component.retain)
            position += component.retain
        } else position += component.delete
    }
    if (position !== content.length) throw new Error('Le document doit être rechargé.')
    return result
}
