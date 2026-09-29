import { useEffect } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorToolbar } from './EditorToolbar'
import './editor.css'

export interface DocumentEditorProps {
    initialContent?: JSONContent
    onChange?: (content: JSONContent) => void
    editable?: boolean
}

export function DocumentEditor({ initialContent, onChange, editable = true }: DocumentEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                link: { openOnClick: false, defaultProtocol: 'https' },
            }),
            Placeholder.configure({ placeholder: 'Commencez à écrire votre document…' }),
        ],
        content: initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        editable,
        editorProps: {
            attributes: {
                class: 'coedit-content',
                role: 'textbox',
                'aria-label': 'Contenu du document',
                'aria-multiline': 'true',
                spellcheck: 'true',
            },
        },
        onUpdate: ({ editor: currentEditor }) => onChange?.(currentEditor.getJSON()),
    })

    useEffect(() => {
        editor?.setEditable(editable, false)
    }, [editor, editable])

    return (
        <section aria-label="Éditeur de document" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {editor && editable && <EditorToolbar editor={editor} />}
            <EditorContent editor={editor} />
            <footer className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                {editable ? 'Pensez à enregistrer vos modifications.' : 'Lecture seule'}
            </footer>
        </section>
    )
}
