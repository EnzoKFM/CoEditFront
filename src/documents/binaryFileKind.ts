export type BinaryPreviewKind = 'image' | 'pdf' | 'download'

const BYTES_PER_KILOBYTE = 1024

export function isBinaryFile(mimeType?: string | null): mimeType is string {
    return typeof mimeType === 'string' && mimeType.length > 0
}

export function getBinaryPreviewKind(mimeType: string): BinaryPreviewKind {
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.startsWith('image/')) return 'image'
    return 'download'
}

export function getFileIcon(mimeType?: string | null): string {
    if (!isBinaryFile(mimeType)) return '📄'
    const previewKind = getBinaryPreviewKind(mimeType)
    if (previewKind === 'image') return '🖼️'
    if (previewKind === 'pdf') return '📕'
    return '📎'
}

export function formatFileSize(sizeInBytes: number): string {
    if (sizeInBytes < BYTES_PER_KILOBYTE) return `${sizeInBytes} o`
    const sizeInKilobytes = sizeInBytes / BYTES_PER_KILOBYTE
    if (sizeInKilobytes < BYTES_PER_KILOBYTE) return `${sizeInKilobytes.toFixed(1).replace('.', ',')} Ko`
    return `${(sizeInKilobytes / BYTES_PER_KILOBYTE).toFixed(1).replace('.', ',')} Mo`
}
