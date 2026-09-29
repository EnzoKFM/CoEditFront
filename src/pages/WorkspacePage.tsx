import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useBlocker, useOutletContext } from 'react-router-dom'
import { io } from 'socket.io-client'
import Arborescence, { type DocumentNode } from '../Arborescence'
import { useAuth } from '../auth/authContext'
import { DocumentEditor } from '../components/editor'
import { Button } from '../components/shared/Button'
import { UnsavedChangesDialog } from '../components/shared/UnsavedChangesDialog'
import { DocumentSessionClient } from '../documents/DocumentSessionClient'
import type { WorkspaceOutletContext } from '../documents/leaveGuard'

interface SelectedFile {
    node: DocumentNode
    ancestorIds: number[]
}

export function WorkspacePage() {
    const [selected, setSelected] = useState<SelectedFile | null>(null)
    const { user } = useAuth()
    const userName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
    const fileId = selected?.node.id
    const client = useMemo(() => fileId ? new DocumentSessionClient(
        io(import.meta.env.VITE_API_URL || window.location.origin, { autoConnect: false, withCredentials: true }),
        fileId,
        userName,
    ) : null, [fileId, userName])

    return (
        <Workspace selected={selected} client={client} onSelect={setSelected} />
    )
}

interface WorkspaceProps {
    selected: SelectedFile | null
    client: DocumentSessionClient | null
    onSelect: (file: SelectedFile | null) => void
}

const emptySubscribe = () => () => {}
const emptySnapshot = () => null

function Workspace({ selected, client, onSelect }: WorkspaceProps) {
    const state = useSyncExternalStore(client?.subscribe ?? emptySubscribe, client?.getSnapshot ?? emptySnapshot)
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
    const { registerLeaveGuard } = useOutletContext<WorkspaceOutletContext>()
    const blocker = useBlocker(Boolean(state?.dirty || state?.saving))
    const canSave = Boolean(state?.dirty && state.status === 'ready' && !state.conflict && !state.saving)

    useEffect(() => {
        client?.connect()
        return () => client?.dispose()
    }, [client])

    useEffect(() => {
        const hasChanges = () => Boolean(client?.getSnapshot().dirty || client?.getSnapshot().saving)
        registerLeaveGuard(() => !hasChanges() || (!client?.getSnapshot().saving && window.confirm('Quitter sans enregistrer les modifications du document ?')))
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (hasChanges()) { event.preventDefault(); event.returnValue = '' }
        }
        window.addEventListener('beforeunload', beforeUnload)
        return () => {
            registerLeaveGuard(null)
            window.removeEventListener('beforeunload', beforeUnload)
        }
    }, [client, registerLeaveGuard])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault()
                void client?.save()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [client])

    function requestAction(action: () => void) {
        if (state?.saving) return
        if (state?.dirty) setPendingAction(() => action)
        else action()
    }

    function continueAction() {
        if (blocker.state === 'blocked') blocker.proceed()
        else pendingAction?.()
        setPendingAction(null)
    }

    function affectsSelection(nodeId: number) {
        return selected?.node.id === nodeId || Boolean(selected?.ancestorIds.includes(nodeId))
    }

    return (
        <div className="grid items-start gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
            <aside aria-label="Vos documents" className="rounded-xl border border-slate-200 bg-white p-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                <Arborescence
                    selectedFileId={selected?.node.id}
                    onFileSelect={(node, ancestorIds) => {
                        if (node.id !== selected?.node.id) requestAction(() => onSelect({ node, ancestorIds }))
                    }}
                    onNodeRenamed={(nodeId, name) => {
                        if (selected?.node.id === nodeId) onSelect({ ...selected, node: { ...selected.node, name } })
                    }}
                    onNodeMoved={(nodeId, ancestorIds) => {
                        if (!selected) return
                        if (selected.node.id === nodeId) onSelect({ ...selected, ancestorIds })
                        else {
                            const ancestorIndex = selected.ancestorIds.indexOf(nodeId)
                            if (ancestorIndex >= 0) onSelect({ ...selected, ancestorIds: [...ancestorIds, ...selected.ancestorIds.slice(ancestorIndex)] })
                        }
                    }}
                    canDeleteNode={(nodeId) => {
                        if (affectsSelection(nodeId) && (state?.dirty || state?.saving)) {
                            window.alert('Enregistrez ou rechargez le document ouvert avant de le supprimer ou de supprimer son dossier.')
                            return false
                        }
                        return true
                    }}
                    onNodeDeleted={(nodeId) => {
                        if (affectsSelection(nodeId)) onSelect(null)
                    }}
                />
            </aside>
            <section aria-label="Document ouvert" className="min-w-0">
                {!selected && (
                    <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <h1 className="text-xl font-semibold text-slate-900">
                            Votre espace de travail
                        </h1>
                        <p className="mt-3 max-w-md text-sm text-slate-500">
                            Choisissez un fichier dans vos documents pour l’ouvrir ici, ou créez-en un pour commencer à écrire.
                        </p>
                    </div>
                )}
                {selected && state && (
                    <>
                        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="break-words text-xl font-semibold text-slate-900">
                                    {selected.node.name}
                                </h1>
                                <p role="status" className="mt-1 text-sm text-slate-500">
                                    {state.saving ? 'Enregistrement…' : state.dirty ? 'Modifications non enregistrées' : state.saved ? 'Enregistré' : state.status === 'loading' ? 'Chargement…' : 'Aucune modification en attente'}
                                </p>
                            </div>
                            <Button variant="primary" disabled={!canSave} onClick={() => void client?.save()}>
                                Enregistrer
                            </Button>
                        </header>
                        {state.message && (
                            <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                <p>
                                    {state.message}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {state.conflict && (
                                        <Button onClick={() => requestAction(() => client?.reload())} disabled={state.saving}>
                                            Recharger la version du serveur
                                        </Button>
                                    )}
                                    {(state.status === 'error' || state.status === 'offline') && (
                                        <Button onClick={client?.retry}>
                                            Réessayer
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                        {state.content && (
                            <DocumentEditor key={`${selected.node.id}:${state.editorVersion}`} initialContent={state.content} onChange={client?.change} editable={state.status === 'ready' && !state.saving} />
                        )}
                    </>
                )}
            </section>
            {(pendingAction || blocker.state === 'blocked') && (
                <UnsavedChangesDialog
                    saving={Boolean(state?.saving)}
                    canSave={canSave}
                    message={state?.message}
                    onCancel={() => { setPendingAction(null); if (blocker.state === 'blocked') blocker.reset() }}
                    onDiscard={continueAction}
                    onSave={() => { void client?.save().then((saved) => { if (saved) continueAction() }) }}
                />
            )}
        </div>
    )
}
