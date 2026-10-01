export const SPEAKING_VOLUME_THRESHOLD = 0.015
export const SPEAKING_RELEASE_DELAY_MS = 350

export function measureVolume(samples: Float32Array) {
    if (samples.length === 0) return 0
    let squaredSum = 0
    for (const sample of samples) squaredSum += sample * sample
    return Math.sqrt(squaredSum / samples.length)
}

export class SpeakingDetector {
    private readonly volumeThreshold: number
    private readonly releaseDelayMs: number
    private lastLoudAt: number | null = null

    constructor(volumeThreshold = SPEAKING_VOLUME_THRESHOLD, releaseDelayMs = SPEAKING_RELEASE_DELAY_MS) {
        this.volumeThreshold = volumeThreshold
        this.releaseDelayMs = releaseDelayMs
    }

    update(volume: number, timestamp: number) {
        if (volume >= this.volumeThreshold) this.lastLoudAt = timestamp
        return this.lastLoudAt !== null && timestamp - this.lastLoudAt < this.releaseDelayMs
    }
}
