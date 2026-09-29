import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { apiFetch, getErrorMessage } from '../lib/api'
import { AudioCallRoom } from '../components/call/AudioCallRoom'
import { Button } from '../components/shared/Button'

interface DocumentNode {
    id: number
    name: string
    type: 'file' | 'folder'
}

interface FolderListing {
    children: DocumentNode[]
    breadcrumb: { id: number; name: string }[]
}

function DocumentPicker() {
    const [folderId, setFolderId] = useState<number | null>(null)
    const [listing, setListing] = useState<FolderListing | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false
        apiFetch<FolderListing>(`/api/folders/${folderId ?? 'root'}/children`)
            .then((result) => {
                if (!cancelled) setListing(result)
            })
            .catch((failure) => { if (!cancelled) setError(getErrorMessage(failure)) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [folderId, attempt])

    function openFolder(nextFolderId: number | null) {
        setLoading(true)
        setError('')
        setFolderId(nextFolderId)
        setAttempt((current) => current + 1)
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
                Choisir un document
            </h2>
            <nav aria-label="Dossiers des salons audio" className="my-4 flex flex-wrap gap-2">
                <Button onClick={() => openFolder(null)}>
                    Racine
                </Button>
                {listing?.breadcrumb.map((folder) => (
                    <Button key={folder.id} onClick={() => openFolder(folder.id)}>
                        {folder.name}
                    </Button>
                ))}
            </nav>
            {loading ? (
                <p role="status">
                    Chargement des documents…
                </p>
            ) : error ? (
                <div className="space-y-3">
                    <p role="alert" className="text-sm text-red-700">
                        {error}
                    </p>
                    <Button onClick={() => openFolder(folderId)}>
                        Réessayer
                    </Button>
                </div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {listing?.children.map((node) => (
                        <li key={node.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <span className="min-w-0 break-words text-slate-700">
                                {node.name}
                            </span>
                            {node.type === 'folder' ? (
                                <Button onClick={() => openFolder(node.id)} aria-label={`Ouvrir le dossier ${node.name}`}>
                                    Ouvrir le dossier
                                </Button>
                            ) : (
                                <Link to={`/calls/${node.id}`} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" aria-label={`Rejoindre le salon de ${node.name}`}>
                                    Rejoindre le salon
                                </Link>
                            )}
                        </li>
                    ))}
                    {listing?.children.length === 0 && (
                        <li className="py-4 text-sm text-slate-500">
                            Ce dossier est vide. Vous pouvez créer un document depuis l’arborescence.
                        </li>
                    )}
                </ul>
            )}
        </section>
    )
}

function DocumentRoom({ fileId }: { fileId: number }) {
    const { user } = useAuth()
    const [document, setDocument] = useState<DocumentNode | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        apiFetch<DocumentNode>(`/api/nodes/${fileId}`).then((node) => {
            if (cancelled) return
            if (node.type !== 'file') setError('Sélectionnez un document, pas un dossier.')
            else setDocument(node)
        }).catch((failure) => { if (!cancelled) setError(getErrorMessage(failure)) })
        return () => { cancelled = true }
    }, [fileId])

    return (
        <>
            <Link to="/calls" className="mb-5 inline-block text-sm font-medium text-indigo-700 underline underline-offset-4">
                Quitter le salon et choisir un autre document
            </Link>
            {error ? (
                <p role="alert" className="text-red-700">
                    {error}
                </p>
            ) : document && user ? (
                <>
                    <h2 className="mb-4 break-words text-xl font-semibold text-slate-900">
                        {document.name}
                    </h2>
                    <AudioCallRoom fileId={fileId} documentName={document.name} userName={`${user.firstName} ${user.lastName}`} />
                </>
            ) : (
                <p role="status">
                    Ouverture du document…
                </p>
            )}
        </>
    )
}

export function AudioCallsPage() {
    const { fileId: rawFileId } = useParams()
    const fileId = Number(rawFileId)

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-slate-900">
                    Appels audio
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                    Retrouvez un collègue dans le salon d’un document pour discuter à deux. Quitter cette page termine l’appel et libère le micro.
                </p>
            </header>
            {!rawFileId ? <DocumentPicker /> : Number.isSafeInteger(fileId) && fileId > 0 ? (
                <DocumentRoom key={fileId} fileId={fileId} />
            ) : (
                <p role="alert" className="text-red-700">
                    Identifiant de document invalide.
                </p>
            )}
        </div>
    )
}
