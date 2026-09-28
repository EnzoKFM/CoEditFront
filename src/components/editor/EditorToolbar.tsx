import { useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { ToolbarButton } from './ToolbarButton'
import { LinkForm } from './LinkForm'

export function EditorToolbar({ editor }: { editor: Editor }) {
    const [linkOpen, setLinkOpen] = useState(false)
    const state = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            underline: current.isActive('underline'),
            bulletList: current.isActive('bulletList'),
            orderedList: current.isActive('orderedList'),
            blockquote: current.isActive('blockquote'),
            link: current.isActive('link'),
            heading: [1, 2, 3].find((level) => current.isActive('heading', { level })) ?? 0,
            undo: current.can().chain().undo().run(),
            redo: current.can().chain().redo().run(),
        }),
    })

    return (
        <div className="border-b border-slate-200 bg-slate-50/60 p-2">
            <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0">
                <legend className="sr-only">Mise en forme du document</legend>
                <ToolbarButton label="Annuler" disabled={!state.undo} onClick={() => editor.chain().focus().undo().run()}>↶</ToolbarButton>
                <ToolbarButton label="Rétablir" disabled={!state.redo} onClick={() => editor.chain().focus().redo().run()}>↷</ToolbarButton>
                <select
                    aria-label="Style du paragraphe"
                    value={state.heading}
                    className="mx-1 min-h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus-visible:outline-indigo-600"
                    onChange={(event) => {
                        const level = Number(event.target.value)
                        if (level === 0) editor.chain().focus().setParagraph().run()
                        else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run()
                    }}
                >
                    <option value={0}>Paragraphe</option>
                    <option value={1}>Titre 1</option>
                    <option value={2}>Titre 2</option>
                    <option value={3}>Titre 3</option>
                </select>
                <ToolbarButton label="Gras" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><strong>G</strong></ToolbarButton>
                <ToolbarButton label="Italique" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolbarButton>
                <ToolbarButton label="Souligné" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><span className="underline">S</span></ToolbarButton>
                <ToolbarButton label="Liste à puces" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Liste</ToolbarButton>
                <ToolbarButton label="Liste numérotée" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Liste</ToolbarButton>
                <ToolbarButton label="Citation" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“ Citation</ToolbarButton>
                <ToolbarButton label="Ajouter ou modifier un lien" active={state.link} onClick={() => setLinkOpen((open) => !open)}>Lien</ToolbarButton>
            </fieldset>
            {linkOpen && <LinkForm editor={editor} onClose={() => setLinkOpen(false)} />}
        </div>
    )
}
