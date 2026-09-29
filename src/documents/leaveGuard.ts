export interface WorkspaceOutletContext {
    registerLeaveGuard: (guard: (() => boolean) | null) => void
}
