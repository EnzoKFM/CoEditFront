import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { transformIndex, type TextOperation } from '../../documents/textOperation'
import { EditorToolbar } from './EditorToolbar'
import { renderMarkdown } from './markdown'
import './editor.css'

export interface DocumentEditorProps {
    content: string
    onChange: (content: string, preferredStart?: number) => void
    editable?: boolean
    canUndo?: boolean
    canRedo?: boolean
    onUndo: () => void
    onRedo: () => void
    subscribeRemote: (listener: (operation: TextOperation) => void) => () => void
    onCompositionStart: () => void
    onCompositionEnd: () => void
}

export function DocumentEditor({ content, onChange, editable = true, canUndo, canRedo, onUndo, onRedo, subscribeRemote, onCompositionStart, onCompositionEnd }: DocumentEditorProps) {
    const textarea = useRef<HTMLTextAreaElement>(null)
    const selection = useRef<{ start: number, end: number, direction: 'forward' | 'backward' | 'none' } | null>(null)
    const preferredStart = useRef<number | undefined>(undefined)
    const [showPreview, setShowPreview] = useState(true)
    const preview = useMemo(() => renderMarkdown(content), [content])

    useEffect(() => subscribeRemote((operation) => {
        const input = textarea.current
        if (!input) return
        const current = selection.current ?? { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection }
        selection.current = { start: transformIndex(current.start, operation), end: transformIndex(current.end, operation), direction: current.direction }
    }), [subscribeRemote])

    useLayoutEffect(() => {
        if (selection.current && textarea.current) {
            const { start, end, direction } = selection.current
            textarea.current.setSelectionRange(start, end, direction)
            selection.current = null
        }
    }, [content])

    useEffect(() => {
        const input = textarea.current
        const beforeInput = (event: InputEvent) => {
            if (!input) return
            if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
                event.preventDefault()
                if (event.inputType === 'historyUndo') onUndo()
                else onRedo()
                return
            }
            preferredStart.current = input.selectionStart
            if (event.inputType === 'deleteContentBackward' && input.selectionStart === input.selectionEnd) {
                preferredStart.current = Math.max(0, input.selectionStart - 1)
            }
        }
        input?.addEventListener('beforeinput', beforeInput)
        return () => input?.removeEventListener('beforeinput', beforeInput)
    }, [onUndo, onRedo])

    function insertMarkdown(before: string, after = '', placeholder = 'texte') {
        const input = textarea.current
        if (!input || !editable) return
        const start = input.selectionStart
        const end = input.selectionEnd
        const selected = content.slice(start, end) || placeholder
        const next = content.slice(0, start) + before + selected + after + content.slice(end)
        selection.current = { start: start + before.length, end: start + before.length + selected.length, direction: 'forward' }
        onChange(next, start)
        input.focus()
    }

    return (
        <section aria-label="Éditeur Markdown" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <EditorToolbar disabled={!editable} canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onInsert={insertMarkdown} showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />
            <div className={showPreview ? 'grid xl:grid-cols-2' : ''}>
                <div className="min-w-0">
                    <label htmlFor="document-markdown" className="block border-b border-slate-100 px-5 py-2 text-xs font-medium text-slate-500">
                        Texte Markdown
                    </label>
                    <textarea
                        ref={textarea}
                        id="document-markdown"
                        aria-label="Contenu du document"
                        value={content}
                        readOnly={!editable}
                        spellCheck
                        placeholder="Commencez à écrire…"
                        className="block min-h-[420px] w-full resize-y border-0 p-5 font-mono text-sm leading-7 text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
                        onChange={(event) => { onChange(event.target.value, preferredStart.current); preferredStart.current = undefined }}
                        onCompositionStart={onCompositionStart}
                        onCompositionEnd={(event) => { onChange(event.currentTarget.value, preferredStart.current); preferredStart.current = undefined; onCompositionEnd() }}
                        onKeyDown={(event) => {
                            if (event.nativeEvent.isComposing || !(event.ctrlKey || event.metaKey)) return
                            if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) onRedo(); else onUndo() }
                            if (event.key.toLowerCase() === 'y') { event.preventDefault(); onRedo() }
                        }}
                    />
                </div>
                {showPreview && (
                    <section aria-label="Aperçu Markdown" className="min-w-0 border-t border-slate-200 xl:border-l xl:border-t-0">
                        <h2 className="border-b border-slate-100 px-5 py-2 text-xs font-medium text-slate-500">
                            Aperçu
                        </h2>
                        <div className="coedit-content" dangerouslySetInnerHTML={{ __html: preview }} />
                    </section>
                )}
            </div>
            <footer className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                Les modifications sont partagées en direct. Le serveur enregistre automatiquement le document.
            </footer>
        </section>
    )
}
