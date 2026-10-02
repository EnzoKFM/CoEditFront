import { useEffect, useState } from 'react'
import { SpeakingDetector, measureVolume } from './speakingDetector'

const VOLUME_SAMPLING_INTERVAL_MS = 100

export interface MonitoredAudio {
    participantId: string
    stream: MediaStream | null
    isMicrophoneMuted: boolean
}

interface ParticipantAnalyser {
    participantId: string
    analyser: AnalyserNode
    samples: Float32Array<ArrayBuffer>
    detector: SpeakingDetector
}

function areSameIds(firstIds: Set<string>, secondIds: Set<string>) {
    return firstIds.size === secondIds.size && [...firstIds].every((participantId) => secondIds.has(participantId))
}

export function useSpeakingParticipants(monitoredAudios: MonitoredAudio[]) {
    const [speakingParticipantIds, setSpeakingParticipantIds] = useState<Set<string>>(() => new Set())
    const audibleAudios = monitoredAudios.filter((monitoredAudio) =>
        !monitoredAudio.isMicrophoneMuted && Boolean(monitoredAudio.stream?.getAudioTracks().length))
    const audibleAudiosKey = audibleAudios.map((audibleAudio) => `${audibleAudio.participantId}:${audibleAudio.stream?.id}`).join('|')
    const [trackedAudios, setTrackedAudios] = useState({ key: audibleAudiosKey, audios: audibleAudios })
    if (trackedAudios.key !== audibleAudiosKey) setTrackedAudios({ key: audibleAudiosKey, audios: audibleAudios })
    const currentAudibleAudios = trackedAudios.audios

    useEffect(() => {
        if (currentAudibleAudios.length === 0 || typeof AudioContext === 'undefined') return
        const audioContext = new AudioContext()
        void audioContext.resume().catch(() => {})
        const participantAnalysers: ParticipantAnalyser[] = currentAudibleAudios.map((audibleAudio) => {
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 512
            audioContext.createMediaStreamSource(audibleAudio.stream as MediaStream).connect(analyser)
            return {
                participantId: audibleAudio.participantId,
                analyser,
                samples: new Float32Array(analyser.fftSize),
                detector: new SpeakingDetector(),
            }
        })
        const samplingTimer = setInterval(() => {
            const now = performance.now()
            const speakingIds = new Set<string>()
            for (const participantAnalyser of participantAnalysers) {
                participantAnalyser.analyser.getFloatTimeDomainData(participantAnalyser.samples)
                const volume = measureVolume(participantAnalyser.samples)
                if (participantAnalyser.detector.update(volume, now)) speakingIds.add(participantAnalyser.participantId)
            }
            setSpeakingParticipantIds((previousIds) => areSameIds(previousIds, speakingIds) ? previousIds : speakingIds)
        }, VOLUME_SAMPLING_INTERVAL_MS)
        return () => {
            clearInterval(samplingTimer)
            void audioContext.close().catch(() => {})
        }
    }, [currentAudibleAudios])

    return new Set(currentAudibleAudios
        .map((audibleAudio) => audibleAudio.participantId)
        .filter((participantId) => speakingParticipantIds.has(participantId)))
}
