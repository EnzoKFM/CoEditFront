import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export interface MenuAction {
    label: string
    icon: IconName
    onClick: () => void
    danger?: boolean
}

export function ActionMenu({ label, children, actions, primary = false, disabled = false }: {
    label: string
    children?: ReactNode
    actions: MenuAction[]
    primary?: boolean
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const container = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const panelId = useId()

    useEffect(() => {
        if (!open) return
        const outside = (event: PointerEvent) => {
            if (!container.current?.contains(event.target as Node)) setOpen(false)
        }
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
        }
        document.addEventListener('pointerdown', outside)
        document.addEventListener('keydown', escape)
        return () => {
            document.removeEventListener('pointerdown', outside)
            document.removeEventListener('keydown', escape)
        }
    }, [open])

    return (
        <div ref={container} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} className="relative shrink-0">
            <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-controls={panelId} disabled={disabled} onClick={() => setOpen(!open)} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40 ${primary ? 'bg-indigo-600 px-4 text-white shadow-sm hover:bg-indigo-700' : 'w-10 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900'}`}>
                {children ?? <Icon name="more" />}
            </button>
            {open && (
                <div id={panelId} className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-200/60">
                    {actions.map((action) => (
                        <button key={action.label} type="button" onClick={() => { setOpen(false); trigger.current?.focus(); action.onClick() }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-indigo-600 ${action.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}>
                            <Icon name={action.icon} className="size-4" />
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
