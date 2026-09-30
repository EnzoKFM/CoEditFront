export interface CollaboratorSelection { anchor: number; head: number }

export interface Collaborator {
    clientId: string
    user: { name: string; color?: string | null }
    selection: CollaboratorSelection | null
    pointer: { x: number; y: number } | null
}

export interface DocumentSessionObserver {
    joining: () => void
    joined: (collaborators: Collaborator[]) => void
    failed: (message: string) => void
}
