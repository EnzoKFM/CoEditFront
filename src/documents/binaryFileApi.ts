import { apiFetch, apiFetchBlob } from '../lib/api'

export type NodePermission = 'owner' | 'read' | 'write' | 'delete'

export interface FileNode {
    id: number
    parentId: number | null
    type: 'file'
    name: string
    ownerId: number
    mimeType: string | null
    createdAt: string
    updatedAt: string
}

export interface FileNodeDetails extends FileNode {
    permission: NodePermission
}

export function uploadBinaryFile(uploadedFile: File, parentId: number | null): Promise<FileNode> {
    const uploadFormData = new FormData()
    if (parentId !== null) uploadFormData.append('parentId', String(parentId))
    uploadFormData.append('file', uploadedFile)
    return apiFetch<FileNode>('/api/files', { method: 'POST', body: uploadFormData })
}

export function replaceBinaryFile(fileId: number, replacementFile: File): Promise<FileNode> {
    const replacementFormData = new FormData()
    replacementFormData.append('file', replacementFile)
    return apiFetch<FileNode>(`/api/files/${fileId}/binary`, { method: 'PUT', body: replacementFormData })
}

export function renameFileNode(fileId: number, name: string): Promise<FileNode> {
    return apiFetch<FileNode>(`/api/nodes/${fileId}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function getFileNodeDetails(fileId: number): Promise<FileNodeDetails> {
    return apiFetch<FileNodeDetails>(`/api/nodes/${fileId}`)
}

export function fetchBinaryFile(fileId: number): Promise<Blob> {
    return apiFetchBlob(`/api/files/${fileId}/binary`)
}
