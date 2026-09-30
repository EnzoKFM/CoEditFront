export type RingtoneKind = 'outgoing' | 'incoming'

interface ToneStep {
    frequency: number
    offsetSeconds: number
    durationSeconds: number
}

interface RingtonePattern {
    steps: ToneStep[]
    cycleMs: number
    volume: number
}

const FADE_SECONDS = 0.02

export const RINGTONE_PATTERNS: Record<RingtoneKind, RingtonePattern> = {
    outgoing: {
        steps: [{ frequency: 440, offsetSeconds: 0, durationSeconds: 1.5 }],
        cycleMs: 5000,
        volume: 0.08,
    },
    incoming: {
        steps: [
            { frequency: 880, offsetSeconds: 0, durationSeconds: 0.18 },
            { frequency: 660, offsetSeconds: 0.22, durationSeconds: 0.18 },
            { frequency: 880, offsetSeconds: 0.44, durationSeconds: 0.18 },
            { frequency: 660, offsetSeconds: 0.66, durationSeconds: 0.18 },
        ],
        cycleMs: 2000,
        volume: 0.12,
    },
}

export class RingtonePlayer {
    private createContext: () => AudioContext | null
    private context: AudioContext | null = null
    private cycleTimer: ReturnType<typeof setInterval> | undefined
    private playingOscillators = new Set<OscillatorNode>()

    constructor(createContext: () => AudioContext | null) {
        this.createContext = createContext
    }

    unlock() {
        const context = this.getContext()
        if (context?.state === 'suspended') void context.resume().catch(() => {})
    }

    start(kind: RingtoneKind) {
        this.stop()
        const context = this.getContext()
        if (!context) return
        if (context.state === 'suspended') void context.resume().catch(() => {})
        const pattern = RINGTONE_PATTERNS[kind]
        const playCycle = () => {
            const cycleStart = context.currentTime
            pattern.steps.forEach((step) => this.playTone(context, step, cycleStart, pattern.volume))
        }
        playCycle()
        this.cycleTimer = setInterval(playCycle, pattern.cycleMs)
    }

    stop() {
        clearInterval(this.cycleTimer)
        this.cycleTimer = undefined
        this.playingOscillators.forEach((oscillator) => {
            try {
                oscillator.stop()
            } catch {
                return
            }
        })
        this.playingOscillators.clear()
    }

    private getContext() {
        this.context ??= this.createContext()
        return this.context
    }

    private playTone(context: AudioContext, step: ToneStep, cycleStart: number, volume: number) {
        const startTime = cycleStart + step.offsetSeconds
        const endTime = startTime + step.durationSeconds
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = step.frequency
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(volume, startTime + FADE_SECONDS)
        gain.gain.setValueAtTime(volume, endTime - FADE_SECONDS)
        gain.gain.linearRampToValueAtTime(0, endTime)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.onended = () => {
            this.playingOscillators.delete(oscillator)
            gain.disconnect()
        }
        this.playingOscillators.add(oscillator)
        oscillator.start(startTime)
        oscillator.stop(endTime)
    }
}

export const ringtonePlayer = new RingtonePlayer(() => (typeof AudioContext === 'undefined' ? null : new AudioContext()))
