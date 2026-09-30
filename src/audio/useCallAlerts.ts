import { useCallback, useEffect, useState } from 'react'
import type { CallStatus } from '../components/call/types'
import { ringtonePlayer, type RingtoneKind } from './ringtone'

const RINGTONES_MUTED_STORAGE_KEY = 'coedit.ringtonesMuted'
const TITLE_BLINK_INTERVAL_MS = 1000

function readRingtonesMuted() {
    try {
        return localStorage.getItem(RINGTONES_MUTED_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

export function useRingtonesPreference() {
    const [ringtonesMuted, setRingtonesMuted] = useState(readRingtonesMuted)

    const toggleRingtones = useCallback(() => {
        setRingtonesMuted((currentlyMuted) => {
            const nextMuted = !currentlyMuted
            try {
                localStorage.setItem(RINGTONES_MUTED_STORAGE_KEY, String(nextMuted))
            } catch {
                return nextMuted
            }
            return nextMuted
        })
    }, [])

    return { ringtonesMuted, toggleRingtones }
}

function getRingtoneKind(status: CallStatus): RingtoneKind | null {
    if (status === 'outgoing') return 'outgoing'
    if (status === 'incoming') return 'incoming'
    return null
}

export function useCallAlerts({ status, callerName, ringtonesMuted }: {
    status: CallStatus
    callerName: string
    ringtonesMuted: boolean
}) {
    useEffect(() => {
        const unlockAudio = () => ringtonePlayer.unlock()
        window.addEventListener('pointerdown', unlockAudio, { once: true })
        window.addEventListener('keydown', unlockAudio, { once: true })
        return () => {
            window.removeEventListener('pointerdown', unlockAudio)
            window.removeEventListener('keydown', unlockAudio)
        }
    }, [])

    const ringtoneKind = getRingtoneKind(status)
    useEffect(() => {
        if (!ringtoneKind || ringtonesMuted) return
        ringtonePlayer.start(ringtoneKind)
        return () => ringtonePlayer.stop()
    }, [ringtoneKind, ringtonesMuted])

    const isIncoming = status === 'incoming'
    useEffect(() => {
        if (!isIncoming) return
        const originalTitle = document.title
        const alertTitle = `📞 Appel entrant – ${callerName}`
        let isAlertShown = false
        const blinkTitle = setInterval(() => {
            isAlertShown = document.hidden && !isAlertShown
            document.title = isAlertShown ? alertTitle : originalTitle
        }, TITLE_BLINK_INTERVAL_MS)
        return () => {
            clearInterval(blinkTitle)
            document.title = originalTitle
        }
    }, [isIncoming, callerName])
}
