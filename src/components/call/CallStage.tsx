import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MAX_CALL_CAMERAS, MAX_CALL_MEMBERS, type AudioCallClient, type AudioCallState } from '../../audio/AudioCallClient'
import { CameraIcon, ExpandIcon, MicrophoneIcon, MinimizeIcon, UserPlusIcon } from './callIcons'
import { getInitials } from './getInitials'
import { JoinRequestBanner } from './JoinRequests'

interface Tile {
    id: string
    name: string
    stream: MediaStream | null
    showVideo: boolean
    microphoneMuted: boolean
    detail: string
    mirrored: boolean
}

function getGridClass(tileCount: number) {
    if (tileCount <= 1) return 'max-w-4xl grid-cols-1'
    if (tileCount === 2) return 'max-w-6xl grid-cols-1 sm:grid-cols-2'
    if (tileCount <= 4) return 'max-w-5xl grid-cols-2'
    if (tileCount <= 6) return 'max-w-6xl grid-cols-2 lg:grid-cols-3'
    if (tileCount <= 9) return 'max-w-6xl grid-cols-2 sm:grid-cols-3'
    return 'max-w-7xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
}

function buildTiles(state: AudioCallState): Tile[] {
    const ownTile: Tile = {
        id: 'moi',
        name: 'Vous',
        stream: state.localVideoStream,
        showVideo: state.cameraOn,
        microphoneMuted: state.muted,
        detail: '',
        mirrored: true,
    }
    const memberTiles = state.callMembers.map((member): Tile => ({
        id: member.collaborator.clientId,
        name: member.collaborator.user.name,
        stream: member.stream,
        showVideo: member.cameraOn,
        microphoneMuted: member.muted,
        detail: member.connected ? '' : 'Connexion…',
        mirrored: false,
    }))
    const invitedTiles = state.invitedClientIds.map((clientId): Tile => ({
        id: clientId,
        name: state.collaborators.find((collaborator) => collaborator.clientId === clientId)?.user.name ?? 'Correspondant',
        stream: null,
        showVideo: false,
        microphoneMuted: false,
        detail: 'Appel en cours…',
        mirrored: false,
    }))
    return [ownTile, ...memberTiles, ...invitedTiles]
}

function VideoTile({ tile }: { tile: Tile }) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const hasVideo = tile.showVideo && Boolean(tile.stream)

    useEffect(() => {
        const video = videoRef.current
        if (!video || !hasVideo) return
        video.srcObject = tile.stream
        void video.play().catch(() => {})
        return () => { video.srcObject = null }
    }, [tile.stream, hasVideo])

    return (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-800">
            {hasVideo ? (
                <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${tile.mirrored ? '-scale-x-100' : ''}`} />
            ) : (
                <div className="grid h-full place-items-center">
                    <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full bg-indigo-500 text-xl font-semibold text-white sm:h-20 sm:w-20 sm:text-2xl">
                        {getInitials(tile.name)}
                    </span>
                </div>
            )}
            <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                {tile.microphoneMuted && (
                    <span title={`${tile.name} a coupé son micro`} className="shrink-0 text-red-300">
                        <MicrophoneIcon muted />
                    </span>
                )}
                <span className="truncate">{tile.name}</span>
                {tile.detail && <span className="shrink-0 text-slate-300">· {tile.detail}</span>}
            </div>
        </div>
    )
}

function RoundButton({ label, onClick, active = false, danger = false, disabled = false, children }: {
    label: string
    onClick: () => void
    active?: boolean
    danger?: boolean
    disabled?: boolean
    children: ReactNode
}) {
    const colorClass = danger
        ? 'bg-red-600 text-white hover:bg-red-700'
        : active
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-slate-700 text-white hover:bg-slate-600'
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            aria-pressed={danger ? undefined : active}
            className={`grid h-12 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'w-16' : 'w-12'} ${colorClass}`}
        >
            {children}
        </button>
    )
}

function HangUpIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 rotate-[135deg]">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    )
}

function getCameraLabel(state: AudioCallState) {
    if (state.cameraOn) return 'Couper la caméra'
    const camerasOnCount = state.callMembers.filter((member) => member.cameraOn).length
    if (camerasOnCount >= MAX_CALL_CAMERAS) return `Caméra indisponible : ${MAX_CALL_CAMERAS} caméras sont déjà allumées`
    if (state.status === 'connecting' && state.callMembers.length === 0) return 'Caméra disponible une fois dans l’appel'
    return 'Allumer la caméra'
}

function MediaButtons({ client, state }: { client: AudioCallClient; state: AudioCallState }) {
    const cameraLabel = getCameraLabel(state)
    return (
        <>
            <RoundButton
                label={state.muted ? 'Réactiver le micro' : 'Couper le micro'}
                onClick={client.toggleMute}
                active={state.muted}
                disabled={state.status !== 'connected'}
            >
                <MicrophoneIcon muted={state.muted} />
            </RoundButton>
            <RoundButton
                label={cameraLabel}
                onClick={() => void client.toggleCamera()}
                active={!state.cameraOn}
                disabled={!state.cameraOn && cameraLabel !== 'Allumer la caméra'}
            >
                <CameraIcon off={!state.cameraOn} />
            </RoundButton>
        </>
    )
}

function AddParticipantMenu({ client, state, onClose }: { client: AudioCallClient; state: AudioCallState; onClose: () => void }) {
    const isCallFull = state.callMembers.length + state.invitedClientIds.length + 1 >= MAX_CALL_MEMBERS
    const candidates = state.collaborators.filter((collaborator) =>
        !state.invitedClientIds.includes(collaborator.clientId)
        && !state.callMembers.some((member) => member.collaborator.clientId === collaborator.clientId))

    return (
        <div role="region" aria-label="Ajouter une personne à l’appel" className="absolute bottom-full left-1/2 mb-3 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-slate-800 p-2 shadow-lg">
            <p className="px-2 py-1 text-xs font-semibold text-slate-300">
                Ajouter à l’appel
            </p>
            {isCallFull ? (
                <p className="px-2 py-2 text-sm text-slate-300">
                    Appel complet ({MAX_CALL_MEMBERS} personnes maximum).
                </p>
            ) : candidates.length === 0 ? (
                <p className="px-2 py-2 text-sm text-slate-300">
                    Personne d’autre n’est sur ce document.
                </p>
            ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {candidates.map((collaborator) => (
                        <li key={collaborator.clientId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-700">
                            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
                                {getInitials(collaborator.user.name)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">{collaborator.user.name}</span>
                            <button
                                type="button"
                                onClick={() => { void client.start(collaborator); onClose() }}
                                className="shrink-0 rounded-lg bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-white"
                            >
                                Appeler
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export function CallStage({ client, state, documentName, statusText, onMinimize }: {
    client: AudioCallClient
    state: AudioCallState
    documentName: string
    statusText: string
    onMinimize: () => void
}) {
    const stageRef = useRef<HTMLDivElement>(null)
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
    const tiles = buildTiles(state)

    useEffect(() => {
        stageRef.current?.focus()
        const rootStyle = document.documentElement.style
        const previousOverflow = rootStyle.overflow
        rootStyle.overflow = 'hidden'
        return () => { rootStyle.overflow = previousOverflow }
    }, [])

    return (
        <div
            ref={stageRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Appel sur ${documentName}`}
            tabIndex={-1}
            onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                if (isAddMenuOpen) setIsAddMenuOpen(false)
                else onMinimize()
            }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-white outline-none"
        >
            <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{documentName}</p>
                    <p role="status" className="truncate text-xs text-slate-300">{statusText}</p>
                </div>
                <button
                    type="button"
                    onClick={onMinimize}
                    aria-label="Réduire l’appel"
                    title="Réduire l’appel"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-200 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-white"
                >
                    <MinimizeIcon />
                </button>
            </header>
            {state.message && (
                <p role="status" className="mx-4 shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200">
                    {state.message}
                </p>
            )}
            {state.receivedJoinRequests.length > 0 && (
                <div className="mx-4 mt-2 shrink-0">
                    <JoinRequestBanner client={client} requests={state.receivedJoinRequests} tone="dark" />
                </div>
            )}
            <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-4">
                <div className={`grid w-full gap-3 ${getGridClass(tiles.length)}`}>
                    {tiles.map((tile) => <VideoTile key={tile.id} tile={tile} />)}
                </div>
            </main>
            <footer className="relative flex shrink-0 items-center justify-center gap-3 px-4 py-4">
                {isAddMenuOpen && <AddParticipantMenu client={client} state={state} onClose={() => setIsAddMenuOpen(false)} />}
                <MediaButtons client={client} state={state} />
                <RoundButton label="Ajouter une personne" onClick={() => setIsAddMenuOpen((isOpen) => !isOpen)}>
                    <UserPlusIcon />
                </RoundButton>
                <RoundButton label="Réduire l’appel" onClick={onMinimize}>
                    <MinimizeIcon />
                </RoundButton>
                <RoundButton label="Raccrocher" onClick={client.hangUp} danger>
                    <HangUpIcon />
                </RoundButton>
            </footer>
        </div>
    )
}

export function CallMiniBar({ client, state, statusText, onExpand }: {
    client: AudioCallClient
    state: AudioCallState
    statusText: string
    onExpand: () => void
}) {
    return (
        <div role="region" aria-label="Appel en cours" className="fixed inset-x-4 bottom-4 z-40 flex items-center gap-2 rounded-2xl bg-slate-900 p-2 pl-4 text-white shadow-lg sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
            <p role="status" className="min-w-0 flex-1 truncate text-sm font-medium sm:max-w-56">{statusText}</p>
            <MediaButtons client={client} state={state} />
            <RoundButton label="Agrandir l’appel" onClick={onExpand}>
                <ExpandIcon />
            </RoundButton>
            <RoundButton label="Raccrocher" onClick={client.hangUp} danger>
                <HangUpIcon />
            </RoundButton>
        </div>
    )
}
