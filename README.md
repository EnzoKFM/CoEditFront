# CoEditFront

Interface React, TypeScript et Tailwind de CoEdit.

## Parcourir les documents

L’accueil affiche les documents sur toute la largeur. La recherche porte sur les noms dans le dossier courant ; le tri et les vues liste/grille permettent de changer leur présentation. Le bouton « Nouveau » sert à créer un fichier ou un dossier, et le menu de chaque élément regroupe les actions autorisées.

Ouvrir un fichier affiche l’éditeur et réduit la bibliothèque en panneau latéral. « Tous les documents » ferme l’éditeur en conservant le dossier parcouru. Les confirmations restent actives si un appel ou une synchronisation est en cours.

## Lancer le front

Avec Node 22.18 ou plus récent (`nvm use` lit la version dans `.nvmrc`) :

```bash
npm ci
npm run dev
```


L'API (dépôt CoEditBack) doit tourner sur `http://localhost:3000`.

### Comment le front parle à l'API

Le navigateur n'appelle jamais l'API directement : il envoie ses requêtes au serveur Vite, qui les fait suivre à l'API.

```
Navigateur ──/api/...──► Serveur Vite (port 5173) ──► API (port 3000)
```

Pour le navigateur, tout vient du même site : le cookie de session est bien envoyé, et il n'y a pas de CORS à gérer.

| Variable | Utilisée par | Rôle | Valeur |
|---|---|---|---|
| `VITE_API_URL` | le **navigateur** | Adresse où le navigateur envoie ses appels. Vide = au serveur Vite, c'est-à-dire au site visité | **vide** |
| `API_PROXY_TARGET` | le **serveur Vite** | Adresse où Vite fait suivre les appels `/api` et `/socket.io` | `http://localhost:3000` |

Ne pas mettre `http://localhost:3000` dans `VITE_API_URL` : via ngrok, `localhost` désignerait l'ordinateur du visiteur, pas celui qui fait tourner l'API.

## Tester à plusieurs avec ngrok

Une seule personne expose l'application ; tout le monde utilise son API et sa base.

1. Lancer l'API (CoEditBack) avec `TRUST_PROXY=2` dans son `.env` (ngrok + proxy de Vite), puis le front avec `npm run dev`.
2. Exposer **uniquement le front** :
   ```bash
   ngrok http 5173
   ```
3. Partager l'URL `https://….ngrok-free.app` affichée. À la première visite, ngrok affiche une page d'avertissement : cliquer sur « Visit Site ».

Ne pas créer de second tunnel pour l'API : les sous-domaines `ngrok-free.app` sont des sites différents pour le navigateur, qui n'enverrait pas le cookie de session d'un tunnel à l'autre.

L'URL est publique : utiliser un vrai mot de passe administrateur, et couper le tunnel (`Ctrl+C`) après les tests. Remettre ensuite `TRUST_PROXY` à vide.

---


La connexion utilise le cookie de session du back. Les comptes sont créés par un administrateur.

## Pages

- `/login` : connexion.
- `/` : documents, éditeur et appels dans le même espace de travail.
- `/arborescence` et `/editor` : redirection vers l’accueil.
- `/calls` et `/calls/:fileId` : redirection vers l’accueil.
- `/profil`, `/a2f` : profil et double authentification.
- `/admin/utilisateurs` : gestion des comptes, réservée aux administrateurs. Bloquer un compte demande une confirmation.

Les pages métier nécessitent une session ouverte.

## Documents

Sur l’accueil, ouvrir un fichier dans la liste ou utiliser « Nouveau fichier ».
L’éditeur travaille directement sur une chaîne Markdown. L’aperçu affiche les titres,
listes, liens et styles ; la barre d’outils insère leur syntaxe dans le texte.
Le HTML saisi est affiché comme du texte dans l’aperçu.

### Fichiers binaires

« Importer un fichier » envoie un PDF, une image ou tout autre fichier (20 Mo maximum, vérifiés avant l’envoi) dans
le dossier courant, via `POST /api/files`. Son icône dépend du type MIME : 🖼️ image, 📕 PDF,
📎 autre ; 📄 reste celle des documents texte, dont `mimeType` vaut `null`.
Un fichier binaire s’ouvre dans une visionneuse, sans collaboration temps réel ni appel :
aperçu des images et des PDF, téléchargement pour tous les types. « Remplacer le fichier »
(permission écriture) remplace son contenu via `PUT /api/files/:fileId/binary`, puis lui donne
le nom du fichier envoyé via `PATCH /api/nodes/:nodeId` ; si ce nom est déjà pris dans le dossier,
le contenu reste remplacé et l’ancien nom est conservé, avec un message d’erreur.
Les octets sont chargés avec `fetch` puis affichés depuis une URL `blob:` ; les autres types
(HTML compris) ne sont jamais affichés dans la page, seulement téléchargés.

## Partage de dossiers

Le bouton 👥 d’un dossier dont on est propriétaire ouvre la fenêtre de partage : saisir l’adresse email d’un compte, choisir la permission (lecture, écriture, écriture et suppression) et confirmer. La même fenêtre liste les utilisateurs ayant accès, permet de modifier la permission de chacun ou de lui retirer l’accès, après confirmation.
Les dossiers partagés avec l’utilisateur apparaissent à la racine, sous « Partagés avec moi », avec une icône dédiée, le nom du propriétaire et la permission accordée. Dans un dossier partagé, les actions s’affichent selon la permission : aucune en lecture, création et renommage en écriture, déplacement et suppression en plus avec « Écriture et suppression ».

Chaque modification produit une opération `retain` / `insert` / `delete`, envoyée par
`document:operation`. Une seule opération attend son accusé à la fois ; les suivantes
restent en attente et sont transformées avec les opérations reçues des autres personnes.
`src/documents/textOperation.ts` reprend l’algorithme du back et sa priorité des insertions.
Si ce protocole évolue, les deux implémentations doivent rester compatibles.

Le serveur garde sa sauvegarde automatique : après 2 secondes sans modification, au plus tard
après 10 secondes de frappe continue, et au départ du dernier éditeur.
« À jour » signifie que toutes les opérations locales ont été acceptées par le serveur.
Il n’y a plus de bouton de sauvegarde manuelle ni de dépendance aux options de l’ancienne PR backend.
Le front fonctionne avec le protocole d’origine, sans migration de base.

Ctrl/Cmd+Z annule une modification locale, Ctrl/Cmd+Shift+Z ou Ctrl+Y la rétablit.
Les opérations d’annulation sont elles aussi transformées avec les changements distants.
Le curseur et la sélection sont déplacés lorsque du texte est ajouté ou supprimé par un autre client.

Pendant une coupure réseau, le texte reste visible mais l’édition est suspendue.
Si une opération n’a pas été confirmée, la reconnexion ne la renvoie pas automatiquement :
elle pourrait avoir été appliquée avant la coupure. Le texte local reste disponible à copier
ou télécharger, puis l’utilisateur peut recharger la version du serveur.
Un avertissement protège les modifications non confirmées avant de changer de fichier ou de quitter.
Aucun brouillon n’est stocké dans le navigateur.

Les anciens documents contenant du JSON Tiptap ne sont pas convertis automatiquement.
Ils restent affichés comme du texte ; leur conversion en Markdown doit être faite séparément.
Les nouveaux documents ne contiennent que le Markdown brut.

## Appels audio

Ouvrir un fichier sur l’accueil. Le panneau « Sur ce document » affiche les autres personnes
connectées à ce fichier. Cliquer sur « Appeler », puis accepter sur l’autre navigateur.
L’édition reste disponible pendant l’appel. Sur petit écran, un message signale un appel
entrant lorsque le panneau est hors de vue.

Le micro est demandé uniquement au démarrage ou à l’acceptation de l’appel.
Changer de fichier, quitter la page ou se déconnecter demande confirmation pendant un appel.
La sortie confirmée arrête le micro et termine l’appel du correspondant.
Raccrocher conserve la connexion au document et permet de continuer à écrire.

L’éditeur et l’audio partagent une seule connexion Socket.IO et un seul `document:join`.
`createWorkspaceSession` gère leur ouverture et leur fermeture. `DocumentSessionClient`
transmet la présence initiale à `AudioCallClient`, qui reçoit ensuite `presence:update`
et `presence:leave` sur la même connexion.

Le son passe par WebRTC ; les événements `call:invite`, `call:incoming`, `call:accept`,
`call:accepted`, `call:signal`, `call:hangup` et `call:ended` utilisent le protocole existant.
Aucun changement du back ni nouvelle dépendance n’est nécessaire.
Une coupure termine l’appel et arrête le micro. La reconnexion rétablit le document et sa
liste de participants ; l’appel doit être relancé.

### Réseau et microphone

Le navigateur exige HTTPS, sauf sur localhost, pour accéder au micro.
Un serveur STUN est utilisé par défaut. Sur certains réseaux, un serveur TURN est nécessaire.
La variable `VITE_ICE_SERVERS` accepte une liste JSON, par exemple :

```dotenv
VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.exemple.fr:3478","username":"identifiant-temporaire","credential":"mot-de-passe-temporaire"}]
```

Les variables `VITE_*` sont visibles dans le navigateur : utiliser des identifiants TURN
limités dans le temps, jamais un secret d’administration. Aucun serveur TURN n’est fourni par ce dépôt.
Redémarrer Vite après un changement de `.env`.

Si le navigateur bloque la lecture automatique, un bouton « Activer le son » apparaît.
Les erreurs de micro, les appels refusés, les délais dépassés et les coupures sont affichés dans le panneau du document.

## Vérifications

```bash
npm run build
npm run lint
npm run test:audio
npm run test:documents
npm run test:files
```

Les tests audio du front couvrent la présence, l’annulation pendant la demande de micro,
le refus d’autorisation, l’ordre des candidats ICE, la coupure du micro et le nettoyage des connexions.
Ils utilisent des doublures de Socket.IO et du navigateur.
Les tests documents couvrent les frappes concurrentes, les retards réseau, les annulations, la reconnexion et le rendu Markdown.
Les tests fichiers couvrent la distinction document texte / fichier binaire, le choix de l’aperçu et l’affichage des tailles.
Les tests du back se lancent séparément dans son conteneur Docker.

Pour vérifier un appel complet, ouvrir le même fichier dans deux sessions authentifiées,
appeler puis accepter. Tester le son dans les deux sens, le bouton micro, le raccrochage,
le refus, le changement de fichier et la sortie de la page. Vérifier que l’édition fonctionne pendant l’appel et après le raccrochage. Utiliser un casque pour éviter l’écho.

`/audio-call.html` conserve la démo visuelle des appels simulés. Elle n’est pas incluse dans le build principal.
