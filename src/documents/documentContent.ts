import type { TextOperation } from './textOperation.ts'

export function operationFromChange(previous: string, next: string, preferredStart?: number): TextOperation {
    let start = 0
    while (start < previous.length && start < next.length && previous[start] === next[start]) start += 1
    if (preferredStart !== undefined) start = Math.min(start, preferredStart)
    let end = 0
    while (end < previous.length - start && end < next.length - start && previous[previous.length - end - 1] === next[next.length - end - 1]) end += 1
    const inserted = next.slice(start, next.length - end)
    const deleted = previous.length - start - end
    return [
        ...(start ? [{ retain: start }] : []),
        ...(inserted ? [{ insert: inserted }] : []),
        ...(deleted ? [{ delete: deleted }] : []),
        ...(end ? [{ retain: end }] : []),
    ]
}

export function invertOperation(content: string, operation: TextOperation): TextOperation {
    let position = 0
    return operation.map((component) => {
        if ('insert' in component) return { delete: component.insert.length }
        if ('retain' in component) { position += component.retain; return component }
        const insert = content.slice(position, position + component.delete)
        position += component.delete
        return { insert }
    })
}
