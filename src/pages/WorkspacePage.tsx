import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useBlocker, useOutletContext } from 'react-router-dom'
import { BinaryFileViewer } from '../components/binary/BinaryFileViewer'
import { AudioCallRoom } from '../components/call/AudioCallRoom'
import Arborescence, { type DocumentNode } from '../Arborescence'
import { useAuth } from '../auth/authContext'
import { DocumentEditor } from '../components/editor'
import { Button } from '../components/shared/Button'
import { UnsavedChangesDialog } from '../components/shared/UnsavedChangesDialog'
import { isBinaryFile } from '../documents/binaryFileKind'
import { createWorkspaceSession, type WorkspaceSession } from '../documents/createWorkspaceSession'
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
    const isBinarySelected = isBinaryFile(selected?.node.mimeType)
    const session = useMemo(() => fileId && !isBinarySelected ? createWorkspaceSession(fileId, userName) : null, [fileId, isBinarySelected, userName])

    return (
        <Workspace selected={selected} session={session} onSelect={setSelected} />
    )
}

interface WorkspaceProps {
    selected: SelectedFile | null
    session: WorkspaceSession | null
    onSelect: (file: SelectedFile | null) => void
}

const isCallActive = (status?: string) => ['incoming', 'outgoing', 'connecting', 'connected'].includes(status ?? '')

const emptySubscribe = () => () => {}
const emptySnapshot = () => null

function Workspace({ selected, session, onSelect }: WorkspaceProps) {
    const client = session?.document
    const audioClient = session?.audio
    const audioState = useSyncExternalStore(audioClient?.subscribe ?? emptySubscribe, audioClient?.getSnapshot ?? emptySnapshot)
    const callActive = isCallActive(audioState?.status)
    const audioPanel = useRef<HTMLDivElement>(null)
    const [audioPanelVisible, setAudioPanelVisible] = useState(false)
    const state = useSyncExternalStore(client?.subscribe ?? emptySubscribe, client?.getSnapshot ?? emptySnapshot)
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
    const [replacedFile, setReplacedFile] = useState<DocumentNode | null>(null)
    const { registerLeaveGuard } = useOutletContext<WorkspaceOutletContext>()
    const [waiting, setWaiting] = useState(false)
    const blocker = useBlocker(Boolean(state?.dirty || callActive))
    const canWait = !state?.dirty || state.status === 'ready'

    useEffect(() => {
        session?.connect()
        return () => session?.dispose()
    }, [session])

    useEffect(() => {
        const panel = audioPanel.current
        if (!panel) return
        const observer = new IntersectionObserver(([entry]) => setAudioPanelVisible(entry.isIntersecting))
        observer.observe(panel)
        return () => observer.disconnect()
    }, [audioClient])

    useEffect(() => {
        const hasChanges = () => Boolean(client?.getSnapshot().dirty || isCallActive(audioClient?.getSnapshot().status))
        registerLeaveGuard(() => !hasChanges() || window.confirm(isCallActive(audioClient?.getSnapshot().status) ? 'Quitter terminera votre appel. Certaines modifications peuvent encore être en cours de transmission. Continuer ?' : 'Quitter alors que certaines modifications ne sont pas encore confirmées par le serveur ?'))
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (hasChanges()) { event.preventDefault(); event.returnValue = '' }
        }
        window.addEventListener('beforeunload', beforeUnload)
        return () => {
            registerLeaveGuard(null)
            window.removeEventListener('beforeunload', beforeUnload)
        }
    }, [client, audioClient, registerLeaveGuard])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault()
                void client?.waitForSync()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [client])

    function requestAction(action: () => void) {
        if (state?.dirty || callActive) setPendingAction(() => action)
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

    function downloadText() {
        if (state?.content === null || state?.content === undefined) return
        const url = URL.createObjectURL(new Blob([state.content], { type: 'text/markdown;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = url
        const name = selected?.node.name ?? 'document'
        link.download = name.toLowerCase().endsWith('.md') ? name : `${name}.md`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    return (
        <div className={selected ? `grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] ${isBinaryFile(selected.node.mimeType) ? "" : "xl:grid-cols-[18rem_minmax(0,1fr)_18rem]"}` : ""}>
            <aside aria-label="Vos documents" className={selected ? "min-w-0 rounded-2xl border border-slate-200 bg-white p-4" : "rounded-2xl border border-slate-200 bg-white p-5 sm:p-8"}>
                <Arborescence
                    selectedFileId={selected?.node.id}
                    replacedFile={replacedFile}
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
                        if (affectsSelection(nodeId) && (state?.dirty || callActive)) {
                            window.alert('Terminez votre appel et attendez la synchronisation avant de supprimer le document ou son dossier.')
                            return false
                        }
                        return true
                    }}
                    onNodeDeleted={(nodeId) => {
                        if (affectsSelection(nodeId)) onSelect(null)
                    }}
                />
            </aside>
            <section aria-label="Document ouvert" className="min-w-0" hidden={!selected}>
                {selected && (
                    <div className="mb-4">
                        <Button onClick={() => requestAction(() => onSelect(null))}>
                            Tous les documents
                        </Button>
                    </div>
                )}
                {selected && isBinaryFile(selected.node.mimeType) && (
                    <BinaryFileViewer
                        key={selected.node.id}
                        file={selected.node}
                        onReplaced={(node) => {
                            onSelect({ ...selected, node })
                            setReplacedFile(node)
                        }}
                    />
                )}
                {selected && state && (
                    <>
                        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="break-words text-xl font-semibold text-slate-900">
                                    {selected.node.name}
                                </h1>
                                <p role="status" className="mt-1 text-sm text-slate-500">
                                    {state.status === 'loading' ? 'Chargement…' : state.dirty ? 'Modifications en cours de transmission' : state.status === 'ready' ? 'À jour · Sauvegarde automatique' : 'Synchronisation interrompue'}
                                </p>
                            </div>
                        </header>
                        {state.message && (
                            <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                <p>
                                    {state.message}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {state.dirty && state.status !== 'ready' && (
                                        <Button onClick={downloadText}>
                                            Télécharger mon texte
                                        </Button>
                                    )}
                                    {state.status === 'recovery' && (
                                        <Button onClick={() => requestAction(() => client?.reload())}>
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
                        {state.content !== null && client && (
                            <DocumentEditor
                                key={selected.node.id}
                                content={state.content}
                                onChange={client.change}
                                editable={state.status === 'ready'}
                                canUndo={state.canUndo}
                                canRedo={state.canRedo}
                                onUndo={client.undo}
                                onRedo={client.redo}
                                subscribeRemote={client.subscribeRemote}
                                onCompositionStart={client.startComposition}
                                onCompositionEnd={client.endComposition}
                                collaborators={state.collaborators}
                                onPresenceChange={client.updatePresence}
                            />
                        )}
                    </>
                )}
            </section>
            {selected && audioClient && client && (
                <aside aria-label="Participants et appels" className="min-w-0 lg:col-start-2 xl:col-start-3 xl:row-start-1">
                    <div ref={audioPanel} tabIndex={-1} className="rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-600">
                        <AudioCallRoom client={audioClient} documentName={selected.node.name} onRetry={client.retry} />
                    </div>
                </aside>
            )}
            {audioState?.status === 'incoming' && !audioPanelVisible && (
                <div role="alert" className="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white p-4 shadow-lg xl:hidden">
                    <p className="text-sm font-medium text-slate-900">
                        Appel entrant de {audioState.participant?.user.name}
                    </p>
                    <Button variant="primary" onClick={() => { audioPanel.current?.scrollIntoView({ behavior: 'smooth' }); audioPanel.current?.focus({ preventScroll: true }) }}>
                        Voir l’appel
                    </Button>
                </div>
            )}
            {(pendingAction || blocker.state === 'blocked') && (
                <UnsavedChangesDialog
                    callActive={callActive}
                    hasPendingChanges={Boolean(state?.dirty)}
                    waiting={waiting}
                    canWait={canWait}
                    message={state?.message}
                    onCancel={() => { setPendingAction(null); if (blocker.state === 'blocked') blocker.reset() }}
                    onDiscard={continueAction}
                    onWait={() => { setWaiting(true); void client?.waitForSync().then((synced) => { setWaiting(false); if (synced) continueAction() }) }}
                />
            )}
        </div>
    )
}
