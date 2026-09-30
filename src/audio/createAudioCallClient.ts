import { io, type Socket } from 'socket.io-client'
import { AudioCallClient } from './AudioCallClient'

function getIceServers(): RTCIceServer[] {
    const configured = import.meta.env.VITE_ICE_SERVERS
    if (!configured) return [{ urls: 'stun:stun.l.google.com:19302' }]
    let servers: unknown
    try {
        servers = JSON.parse(configured)
    } catch {
        throw new Error('Configuration des serveurs ICE invalide.')
    }
    if (!Array.isArray(servers) || !servers.length || servers.some((server) => !server || !server.urls)) {
        throw new Error('Configuration des serveurs ICE invalide.')
    }
    return servers
}

export function createAudioCallClient(fileId: number, userName: string, documentSocket?: Socket) {
    const socket = documentSocket ?? io(import.meta.env.VITE_API_URL || window.location.origin, {
        autoConnect: false,
        withCredentials: true,
        reconnectionAttempts: 5,
        timeout: 10000,
    })
    return new AudioCallClient(socket, fileId, userName, {
        acquireMicrophone: () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                return Promise.reject(new Error('Le microphone nécessite HTTPS ou localhost.'))
            }
            return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        },
        acquireCamera: () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                return Promise.reject(new Error('La caméra nécessite HTTPS ou localhost.'))
            }
            return navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } })
        },
        createPeer: () => new RTCPeerConnection({ iceServers: getIceServers() }),
    }, !documentSocket)
}
