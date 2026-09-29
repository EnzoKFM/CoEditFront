import { useEffect, useRef, useState } from 'react'
import { Button } from '../shared/Button'

export function RemoteAudio({ stream }: { stream: MediaStream }) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [blocked, setBlocked] = useState(false)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return
        let cancelled = false
        audio.srcObject = stream
        void audio.play().catch(() => { if (!cancelled) setBlocked(true) })
        return () => {
            cancelled = true
            audio.pause()
            audio.srcObject = null
        }
    }, [stream])

    async function play() {
        try {
            await audioRef.current?.play()
            setBlocked(false)
        } catch {
            setBlocked(true)
        }
    }

    return (
        <>
            <audio ref={audioRef} autoPlay aria-label="Audio du correspondant" />
            {blocked && (
                <div role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="mb-2">
                        Le navigateur attend votre accord pour lire le son.
                    </p>
                    <Button onClick={play}>
                        Activer le son
                    </Button>
                </div>
            )}
        </>
    )
}
