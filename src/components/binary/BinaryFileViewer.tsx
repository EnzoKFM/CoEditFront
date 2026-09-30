import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { DocumentNode } from '../../Arborescence'
import { fetchBinaryFile, getFileNodeDetails, renameFileNode, replaceBinaryFile, type NodePermission } from '../../documents/binaryFileApi'
import { formatFileSize, getBinaryPreviewKind } from '../../documents/binaryFileKind'
import { getErrorMessage } from '../../lib/api'
import { Button } from '../shared/Button'

interface BinaryFileViewerProps {
    file: DocumentNode
    onReplaced: (file: DocumentNode) => void
}

interface LoadedBinaryFile {
    url: string
    mimeType: string
    size: number
}

function toLoadedBinaryFile(binaryBlob: Blob, mimeType: string): LoadedBinaryFile {
    const typedBlob = new Blob([binaryBlob], { type: mimeType })
    return { url: URL.createObjectURL(typedBlob), mimeType, size: typedBlob.size }
}

export function BinaryFileViewer({ file, onReplaced }: BinaryFileViewerProps) {
    const [loadedFile, setLoadedFile] = useState<LoadedBinaryFile | null>(null)
    const [permission, setPermission] = useState<NodePermission>('read')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isReplacing, setIsReplacing] = useState(false)
    const replacementInput = useRef<HTMLInputElement>(null)
    const canReplace = permission !== 'read'
    const previewKind = loadedFile ? getBinaryPreviewKind(loadedFile.mimeType) : null

    useEffect(() => {
        let isCancelled = false
        Promise.all([getFileNodeDetails(file.id), fetchBinaryFile(file.id)])
            .then(([fileNodeDetails, binaryBlob]) => {
                if (isCancelled) return
                setPermission(fileNodeDetails.permission)
                setLoadedFile(toLoadedBinaryFile(binaryBlob, fileNodeDetails.mimeType ?? binaryBlob.type))
            })
            .catch((error) => {
                if (!isCancelled) setErrorMessage(getErrorMessage(error))
            })
        return () => { isCancelled = true }
    }, [file.id])

    useEffect(() => {
        if (!loadedFile) return
        return () => URL.revokeObjectURL(loadedFile.url)
    }, [loadedFile])

    function downloadFile() {
        if (!loadedFile) return
        const downloadLink = document.createElement('a')
        downloadLink.href = loadedFile.url
        downloadLink.download = file.name
        downloadLink.click()
    }

    async function replaceFile(event: ChangeEvent<HTMLInputElement>) {
        const replacementFile = event.target.files?.[0]
        event.target.value = ''
        if (!replacementFile) return
        const isRenamed = replacementFile.name !== file.name
        if (!window.confirm(`Remplacer « ${file.name} » par « ${replacementFile.name} » ?${isRenamed ? ` Le fichier sera renommé « ${replacementFile.name} ».` : ''}`)) return

        setIsReplacing(true)
        setErrorMessage(null)
        try {
            const replacedNode = await replaceBinaryFile(file.id, replacementFile)
            const replacedMimeType = replacedNode.mimeType ?? replacementFile.type
            setLoadedFile(toLoadedBinaryFile(replacementFile, replacedMimeType))
            let replacedFileNode: DocumentNode = { ...file, mimeType: replacedMimeType, size: replacementFile.size, updatedAt: replacedNode.updatedAt }
            if (isRenamed) {
                try {
                    const renamedNode = await renameFileNode(file.id, replacementFile.name)
                    replacedFileNode = { ...replacedFileNode, name: renamedNode.name, updatedAt: renamedNode.updatedAt }
                } catch (error) {
                    setErrorMessage(`Contenu remplacé, mais le fichier n’a pas pu être renommé : ${getErrorMessage(error)}`)
                }
            }
            onReplaced(replacedFileNode)
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setIsReplacing(false)
        }
    }

    return (
        <div>
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="break-words text-xl font-semibold text-slate-900">
                        {file.name}
                    </h1>
                    <p role="status" className="mt-1 text-sm text-slate-500">
                        {isReplacing ? 'Remplacement en cours…' : loadedFile ? `${loadedFile.mimeType} · ${formatFileSize(loadedFile.size)}` : errorMessage ? 'Fichier indisponible' : 'Chargement…'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={!loadedFile} onClick={downloadFile}>
                        Télécharger
                    </Button>
                    {canReplace && (
                        <>
                            <Button variant="primary" disabled={!loadedFile || isReplacing} onClick={() => replacementInput.current?.click()}>
                                Remplacer le fichier
                            </Button>
                            <input ref={replacementInput} type="file" className="hidden" onChange={replaceFile} />
                        </>
                    )}
                </div>
            </header>
            {errorMessage && (
                <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {errorMessage}
                </div>
            )}
            {loadedFile && previewKind === 'image' && (
                <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-4">
                    <img src={loadedFile.url} alt={file.name} className="max-h-[75vh] max-w-full object-contain" />
                </div>
            )}
            {loadedFile && previewKind === 'pdf' && (
                <iframe src={loadedFile.url} title={`Aperçu de ${file.name}`} className="h-[75vh] w-full rounded-xl border border-slate-200 bg-white" />
            )}
            {loadedFile && previewKind === 'download' && (
                <div className="flex min-h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                    Aucun aperçu pour ce type de fichier : téléchargez-le pour l’ouvrir.
                </div>
            )}
        </div>
    )
}
