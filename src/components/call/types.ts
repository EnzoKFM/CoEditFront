export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'error'

export interface AudioCallPanelProps {
    participantName: string
    documentName: string
    status: CallStatus
    muted: boolean
    errorMessage?: string
    onStart: () => void
    onAccept: () => void
    onDecline: () => void
    onHangUp: () => void
    onToggleMute: () => void
    onReset: () => void
}
