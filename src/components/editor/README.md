# Éditeur de documents

Composant React autonome utilisant Tiptap. La barre d’outils utilise Tailwind ;
`editor.css` contient les styles du contenu généré par Tiptap, limités à `.coedit-content`.

```tsx
import { DocumentEditor } from './components/editor'

<DocumentEditor
    key={document.id}
    initialContent={document.content}
    onChange={(content) => handleDocumentChange(document.id, content)}
    editable={true}
/>
```

- `initialContent` : document JSON Tiptap, lu à la création de l’éditeur. Par défaut : un paragraphe vide.
- `onChange` : reçoit le JSON à chaque modification du contenu, sans appel réseau.
- `editable` : active l’édition ; `false` affiche le contenu en lecture seule, sans barre d’outils.
- Utiliser `key={document.id}` pour changer de document et isoler l’historique annuler/rétablir.
  Monter le composant une fois le contenu chargé. Modifier `initialContent` ne remplace pas une édition en cours.
- Le parent est responsable de conserver les modifications avant de changer de document.

Fonctions : titres 1 à 3, gras, italique, souligné, listes, citations, liens,
annuler/rétablir. Les liens saisis dans le formulaire acceptent HTTP, HTTPS et mailto.
Les raccourcis natifs Tiptap (Ctrl/Cmd+B, I, Z…) sont disponibles.

`WorkspacePage` relie le composant aux fichiers de l’arborescence et à `DocumentSessionClient`.
Le parent gère le chargement, la sauvegarde Socket.IO et les avertissements avant de quitter.
Une version distante remonte le composant avec une nouvelle clé pour réinitialiser son historique.

Lors de l’ajout de la collaboration, utiliser l’historique collaboratif et désactiver
l’extension UndoRedo du StarterKit. Le contrat de synchronisation reste à définir avec le back.

## Vérification manuelle

1. Saisir du texte, sélectionner une partie et appliquer les formats ; vérifier les boutons actifs.
2. Appliquer titres, listes et citations ; annuler puis rétablir.
3. Ajouter, modifier et retirer un lien ; vérifier le refus de `javascript:alert(1)`.
4. Utiliser Tab pour atteindre les commandes, Échap pour fermer le formulaire de lien.
5. Vérifier l’éditeur à une largeur de 375 px.
6. À l’intégration : vérifier `onChange`, la lecture seule et le changement de `key` sans mélange des historiques.

Documentation : https://tiptap.dev/docs/editor/getting-started/install/react
