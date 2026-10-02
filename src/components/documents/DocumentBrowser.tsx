import { formatDateTime, formatRelativeTime } from "../../lib/formatDate"
import { getFileIcon, isBinaryFile } from "../../documents/binaryFileKind"
import { useState } from 'react'
import type { DocumentNode } from '../../Arborescence'
import { ActionMenu, type MenuAction } from '../shared/ActionMenu'
import { Icon } from '../shared/Icon'

const DELETED_AUTHOR_NAME = "un compte supprimé";

function describeNodeHistory(node: DocumentNode) {
    const updatedByName = node.updatedBy?.name ?? DELETED_AUTHOR_NAME;
    const lines = [`Modifié le ${formatDateTime(node.updatedAt)} par ${updatedByName}`];
    if (node.createdAt) {
        lines.unshift(`Créé le ${formatDateTime(node.createdAt)} par ${node.createdBy?.name ?? DELETED_AUTHOR_NAME}`);
    }
    return lines.join("\n");
}

interface DocumentBrowserProps {
    folders: DocumentNode[]
    loading: boolean
    error: string
    onRetry: () => void
    currentFolder: number | null
    folderName?: string
    breadcrumb: { id: number; name: string }[]
    selectedFileId?: number
    canWrite: boolean
    onOpenFolder: (id: number) => void
    onOpenRoot: () => void
    onOpenFile: (file: DocumentNode) => void
    onCreateFolder: () => void
    onCreateFile: () => void
    onImportFile: () => void
    getActions: (node: DocumentNode) => MenuAction[]
}

export function DocumentBrowser(props: DocumentBrowserProps) {
    const [search, setSearch] = useState({ folderId: props.currentFolder, value: '' })
    const [view, setView] = useState<'list' | 'grid'>('list')
    const [sort, setSort] = useState('name')
    const compact = props.selectedFileId !== undefined
    const query = search.folderId === props.currentFolder ? search.value : ''
    const visibleNodes = props.folders.filter((node) => node.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
        .sort((first, second) => {
            if (first.type !== second.type) return first.type === 'folder' ? -1 : 1
            if (sort === 'recent') return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
            return first.name.localeCompare(second.name, 'fr', { numeric: true })
        })
    const grid = !compact && view === 'grid'

    return (
        <div>
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-semibold tracking-tight text-slate-900`}>
                        Mes documents
                    </h2>
                    {!compact && (
                        <p className="mt-2 text-sm text-slate-500">
                            Retrouvez vos fichiers et ouvrez un document pour travailler ensemble.
                        </p>
                    )}
                </div>
                {props.canWrite && (
                    <ActionMenu label="Nouveau" primary actions={[
                        { label: 'Nouveau fichier', icon: 'file', onClick: props.onCreateFile },
                        { label: 'Nouveau dossier', icon: 'folder', onClick: props.onCreateFolder },
                        { label: 'Importer un fichier', icon: 'file', onClick: props.onImportFile },
                    ]}>
                        <Icon name="plus" />
                        Nouveau
                    </ActionMenu>
                )}
            </header>
            <label className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-slate-500 focus-within:ring-2 focus-within:ring-indigo-500">
                <Icon name="search" className="size-5 shrink-0" />
                <input aria-label="Rechercher dans ce dossier" placeholder="Rechercher dans ce dossier" value={query} onChange={(event) => setSearch({ folderId: props.currentFolder, value: event.target.value })} className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500" />
            </label>
            <nav aria-label="Emplacement du dossier" className="mb-5 flex flex-wrap items-center gap-1 text-sm">
                <button type="button" onClick={props.onOpenRoot} className="rounded-lg px-2 py-2 font-medium text-slate-600 hover:bg-slate-100">
                    Mes documents
                </button>
                {props.breadcrumb.filter((folder) => folder.id !== props.currentFolder).map((folder) => (
                    <span key={folder.id} className="flex min-w-0 items-center gap-1">
                        <Icon name="chevron" className="size-4 shrink-0 text-slate-400" />
                        <button type="button" onClick={() => props.onOpenFolder(folder.id)} className="max-w-48 truncate rounded-lg px-2 py-2 text-slate-600 hover:bg-slate-100" title={folder.name}>
                            {folder.name}
                        </button>
                    </span>
                ))}
                {props.folderName && (
                    <span className="flex min-w-0 items-center gap-2 font-medium text-indigo-700" aria-current="page">
                        <Icon name="chevron" className="size-4 shrink-0 text-slate-400" />
                        <span className="break-all">
                            {props.folderName}
                        </span>
                    </span>
                )}
            </nav>
            {!compact && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <p className="text-sm text-slate-500" role="status">
                        {visibleNodes.length} élément{visibleNodes.length > 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-3">
                        <select aria-label="Trier les documents" value={sort} onChange={(event) => setSort(event.target.value)} className="max-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                            <option value="name">
                                Nom A–Z
                            </option>
                            <option value="recent">
                                Modification récente
                            </option>
                        </select>
                        <div className="flex rounded-lg bg-slate-100 p-1">
                            {(['list', 'grid'] as const).map((layout) => (
                                <button key={layout} type="button" aria-label={layout === 'list' ? 'Vue liste' : 'Vue grille'} aria-pressed={view === layout} onClick={() => setView(layout)} className={`rounded-md p-2 ${view === layout ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
                                    <Icon name={layout} className="size-4" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {props.error && (
                <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    <p>
                        {props.error}
                    </p>
                    <button type="button" onClick={props.onRetry} className="mt-2 font-medium underline">
                        Réessayer
                    </button>
                </div>
            )}
            {props.loading && (
                <p role="status" className="py-6 text-center text-sm text-slate-500">
                    Chargement des documents…
                </p>
            )}
            <ul inert={props.loading} className={`${props.loading ? 'opacity-40' : ''} ${grid ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4' : 'space-y-1'}`}>
                {visibleNodes.map((node) => {
                    const actions = props.getActions(node)
                    return (
                        <li key={node.id} className={`flex min-w-0 items-center gap-2 rounded-xl border transition-colors ${props.selectedFileId === node.id ? 'border-indigo-200 bg-indigo-50' : grid ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-transparent hover:bg-slate-50'} ${grid ? 'p-3' : 'px-2'}`}>
                            <button type="button" aria-current={props.selectedFileId === node.id ? 'true' : undefined} aria-label={`${node.type === 'folder' ? 'Ouvrir le dossier' : isBinaryFile(node.mimeType) ? 'Ouvrir le fichier' : 'Modifier le fichier'} ${node.name}`} onClick={() => node.type === 'folder' ? props.onOpenFolder(node.id) : props.onOpenFile(node)} className={`flex min-w-0 flex-1 gap-3 rounded-lg py-3 text-left focus-visible:outline-2 focus-visible:outline-indigo-600 ${grid ? 'flex-col items-start' : 'items-center'}`}>
                                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${node.type === 'folder' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {node.type === 'file' && isBinaryFile(node.mimeType) ? (
                                        <span aria-hidden="true">
                                            {getFileIcon(node.mimeType)}
                                        </span>
                                    ) : <Icon name={node.type === 'folder' ? 'folder' : 'file'} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-slate-700" title={node.name}>
                                        {node.name}
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-500" title={describeNodeHistory(node)}>
                                        Modifié {formatRelativeTime(node.updatedAt)} par {node.updatedBy?.name ?? DELETED_AUTHOR_NAME}
                                    </span>
                                    {!compact && (
                                        <span className="mt-1 block text-xs text-slate-500">
                                            {node.type === 'folder' ? 'Dossier' : isBinaryFile(node.mimeType) ? node.mimeType : 'Document texte'}
                                        </span>
                                    )}
                                </span>
                            </button>
                            {actions.length > 0 && <ActionMenu label={`Actions pour ${node.name}`} actions={actions} />}
                        </li>
                    )
                })}
            </ul>
            {!props.loading && !props.error && visibleNodes.length === 0 && (
                <div className="flex flex-col items-center rounded-2xl bg-slate-50 px-5 py-12 text-center">
                    <Icon name={query ? 'search' : 'folder'} className="mb-4 size-9 text-slate-400" />
                    <p className="font-medium text-slate-700">
                        {query ? 'Aucun résultat' : 'Ce dossier est vide'}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                        {query ? 'Essayez un autre nom de fichier ou de dossier.' : props.canWrite ? 'Créez un fichier ou un dossier avec le bouton Nouveau.' : 'Les documents partagés apparaîtront ici.'}
                    </p>
                </div>
            )}
        </div>
    )
}
