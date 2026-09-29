# CoEdit Front

Interface React, TypeScript et Tailwind de CoEdit.

## Lancer le front

Avec Node 22.18 ou plus récent :

```bash
npm ci
npm run dev
```

Copier `.env.example` vers `.env` et adapter `VITE_API_URL` si besoin.
Le back doit être démarré et son `CLIENT_URL` doit correspondre à l’adresse du front
(par défaut `http://localhost:5173`). Utiliser le même nom d’hôte pour les deux :
par exemple `localhost`, sans le mélanger avec `127.0.0.1`.

La connexion utilise le cookie de session du back. Les comptes sont créés par un administrateur.

## Pages

- `/login` : connexion.
- `/arborescence` : dossiers et documents.
- `/editor` : éditeur local, pas encore relié à la sauvegarde ou à la collaboration.
- `/calls` : choix du document pour un appel audio.
- `/calls/:fileId` : salon audio du document.
- `/profil`, `/a2f` : profil et double authentification.
- `/admin/utilisateurs` : gestion des comptes, réservée aux administrateurs.

Les pages métier nécessitent une session ouverte.

## Appels audio

Dans « Appels », choisir un document puis rejoindre son salon. Les autres personnes
présentes apparaissent dans la liste. Cliquer sur « Appeler », puis accepter sur l’autre navigateur.
Le micro est demandé uniquement au démarrage ou à l’acceptation de l’appel.

Le son passe par WebRTC. Socket.IO utilise le cookie de connexion et les événements du back :
`document:join`, `presence:update`, `presence:leave`, `call:invite`, `call:incoming`,
`call:accept`, `call:accepted`, `call:signal`, `call:hangup` et `call:ended`.
Quitter la page, se déconnecter ou perdre la connexion au serveur termine l’appel et arrête le micro.
Après reconnexion, le salon est rejoint à nouveau ; l’appel doit être relancé.

Le salon est associé au document, mais ne modifie pas son contenu. Aucune écriture REST
ni synchronisation de l’éditeur n’est ajoutée. L’édition collaborative utilisera l’OT du back.

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
Les erreurs de micro, les appels refusés, les délais dépassés et les coupures sont affichés dans le salon.

## Vérifications

```bash
npm run build
npm run lint
npm run test:audio
```

Les tests audio du front couvrent la présence, l’annulation pendant la demande de micro,
le refus d’autorisation, l’ordre des candidats ICE, la coupure du micro et le nettoyage des connexions.
Ils utilisent des doublures de Socket.IO et du navigateur.
Les tests du back se lancent séparément dans son conteneur Docker.

Pour vérifier un appel complet, ouvrir deux sessions authentifiées, rejoindre le même salon,
appeler puis accepter. Tester le son dans les deux sens, le bouton micro, le raccrochage,
le refus et la sortie de la page. Utiliser un casque pour éviter l’écho.

`/audio-call.html` conserve la démo visuelle des appels simulés. Elle n’est pas incluse dans le build principal.
