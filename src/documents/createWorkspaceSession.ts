import { io } from 'socket.io-client'
import { createAudioCallClient } from '../audio/createAudioCallClient'
import { DocumentSessionClient } from './DocumentSessionClient'

export function createWorkspaceSession(fileId: number, userName: string) {
    const socket = io(import.meta.env.VITE_API_URL || window.location.origin, {
        autoConnect: false,
        withCredentials: true,
    })
    const audio = createAudioCallClient(fileId, userName, socket)
    const document = new DocumentSessionClient(socket, fileId, userName, {
        joining: audio.joiningDocument,
        joined: audio.joinedDocument,
        failed: audio.documentFailed,
    })

    return {
        document,
        audio,
        connect() {
            audio.connect()
            document.connect()
        },
        dispose() {
            audio.dispose()
            document.dispose()
        },
    }
}

export type WorkspaceSession = ReturnType<typeof createWorkspaceSession>
