export interface Collaborator {
    clientId: string
    user: { name: string; color?: string | null }
}

export interface DocumentSessionObserver {
    joining: () => void
    joined: (collaborators: Collaborator[]) => void
    failed: (message: string) => void
}
