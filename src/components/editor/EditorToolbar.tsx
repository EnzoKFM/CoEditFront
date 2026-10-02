import { ToolbarButton } from './ToolbarButton'

interface EditorToolbarProps {
    disabled: boolean
    canUndo?: boolean
    canRedo?: boolean
    onUndo: () => void
    onRedo: () => void
    onInsert: (before: string, after?: string, placeholder?: string) => void
    showPreview: boolean
    onTogglePreview: () => void
}

export function EditorToolbar({ disabled, canUndo, canRedo, onUndo, onRedo, onInsert, showPreview, onTogglePreview }: EditorToolbarProps) {
    return (
        <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200 bg-slate-50 p-2">
            <fieldset disabled={disabled} className="flex min-w-0 flex-wrap gap-1">
                <legend className="sr-only">
                    Mise en forme Markdown
                </legend>
                <ToolbarButton label="Annuler" disabled={!canUndo} onClick={onUndo}>
                    ↶
                </ToolbarButton>
                <ToolbarButton label="Rétablir" disabled={!canRedo} onClick={onRedo}>
                    ↷
                </ToolbarButton>
                <ToolbarButton label="Titre" onClick={() => onInsert('\n## ', '\n', 'Titre')}>
                    Titre
                </ToolbarButton>
                <ToolbarButton label="Gras" onClick={() => onInsert('**', '**')}>
                    Gras
                </ToolbarButton>
                <ToolbarButton label="Italique" onClick={() => onInsert('*', '*')}>
                    Italique
                </ToolbarButton>
                <ToolbarButton label="Liste à puces" onClick={() => onInsert('\n- ', '\n', 'Élément')}>
                    • Liste
                </ToolbarButton>
                <ToolbarButton label="Citation" onClick={() => onInsert('\n> ', '\n')}>
                    Citation
                </ToolbarButton>
                <ToolbarButton label="Lien" onClick={() => onInsert('[', '](https://exemple.fr)', 'libellé')}>
                    Lien
                </ToolbarButton>
                <ToolbarButton label="Code" onClick={() => onInsert('`', '`', 'code')}>
                    Code
                </ToolbarButton>
            </fieldset>
            <ToolbarButton label="Afficher l’aperçu" active={showPreview} onClick={onTogglePreview}>
                Aperçu
            </ToolbarButton>
        </div>
    )
}
