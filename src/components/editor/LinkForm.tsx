import { useId, useState, type FormEvent } from 'react'
import type { Editor } from '@tiptap/react'

export function LinkForm({ editor, onClose }: { editor: Editor; onClose: () => void }) {
    const inputId = useId()
    const [url, setUrl] = useState<string>(editor.getAttributes('link').href ?? '')
    const [error, setError] = useState('')

    function close() {
        onClose()
        editor.commands.focus()
    }

    function applyLink(event: FormEvent) {
        event.preventDefault()
        const href = url.trim()
        try {
            const parsed = new URL(href)
            if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
        } catch {
            setError('Saisissez une adresse commençant par https://, http:// ou mailto:.')
            return
        }
        const chain = editor.chain().focus().extendMarkRange('link')
        if (editor.state.selection.empty && !editor.isActive('link')) {
            chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
        } else {
            chain.setLink({ href }).run()
        }
        close()
    }

    return (
        <form onSubmit={applyLink} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }} className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
            <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-slate-700">Adresse du lien</label>
            <div className="flex flex-wrap gap-2">
                <input id={inputId} autoFocus value={url} onChange={(event) => { setUrl(event.target.value); setError('') }} placeholder="https://exemple.fr" aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-indigo-600" />
                <button type="submit" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Appliquer</button>
                {editor.isActive('link') && <button type="button" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); close() }} className="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50">Retirer le lien</button>}
                <button type="button" onClick={close} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Annuler</button>
            </div>
            {error && <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </form>
    )
}
