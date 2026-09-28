import type { ReactNode } from 'react'

interface ToolbarButtonProps {
    label: string
    children: ReactNode
    onClick: () => void
    active?: boolean
    disabled?: boolean
}

export function ToolbarButton({ label, children, onClick, active, disabled }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={`min-h-9 min-w-9 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
        >
            {children}
        </button>
    )
}
