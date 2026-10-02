# Éditeur Markdown

`DocumentEditor` affiche un textarea et un aperçu rendu par markdown-it.
`content` est toujours une chaîne Markdown ; `onChange` reçoit cette chaîne après chaque saisie.
Les boutons ajoutent la syntaxe Markdown autour de la sélection.
Un simple retour à la ligne est aussi affiché dans l’aperçu.

`WorkspacePage` relie l’éditeur au `DocumentSessionClient`, qui gère le protocole OT du back.
Le composant signale les compositions de saisie pour différer les changements distants
jusqu’à leur fin. Il déplace aussi le curseur et la sélection après une opération distante.

L’annulation et le rétablissement passent par le client de collaboration, afin de conserver
les ajouts des autres personnes. L’historique natif du textarea n’est pas utilisé.

L’aperçu désactive le HTML et conserve la validation des liens de markdown-it.
Les liens s’ouvrent dans un nouvel onglet pour garder le document ouvert.
Aucun modèle riche, HTML ou JSON n’est envoyé au back.

## Vérification manuelle

1. Ouvrir le même fichier dans deux sessions connectées.
2. Écrire en même temps, au même endroit puis à des endroits différents.
3. Ajouter des listes et du gras, vérifier le Markdown et l’aperçu.
4. Annuler une modification et vérifier que le texte de l’autre personne reste présent.
5. Quitter puis rouvrir le fichier pour vérifier la sauvegarde du serveur.
6. Couper le réseau avec une opération en attente et vérifier que le texte local reste récupérable.

Documentation : https://github.com/markdown-it/markdown-it
