# Appels audio

Interface d’appel à deux, branchée au back avec Socket.IO et WebRTC.

## Tester

Lancer le back et `npm run dev`, puis ouvrir le même fichier dans deux sessions connectées.
Le panneau « Sur ce document » permet de s’appeler tout en continuant à éditer.
Le micro est demandé au démarrage ou à l’acceptation. Quitter le document demande confirmation
puis termine l’appel. Raccrocher conserve l’édition et sa connexion.

La page `/audio-call.html` reste une démo visuelle, sans appel réel.

## Fichiers

- `components/call` : panneau, salon et lecture du son distant.
- `audio` : connexion Socket.IO et gestion WebRTC.
- `documents/createWorkspaceSession.ts` : connexion commune à l’éditeur et à l’audio.
- `pages/WorkspacePage.tsx` : affichage et confirmation avant de quitter le document.
- `components/shared/Button.tsx` : bouton commun au panneau et à la démo.
- `demos/audio-call` : page de test et états simulés.

`AudioCallPanel` reçoit le participant, l’état et les actions en props.
`AudioCallClient` gère la présence, les invitations, le micro et la connexion audio.
Il utilise la connexion du document, sans deuxième `document:join`. À la fermeture,
la session arrête les ressources audio avant de quitter le fichier.
Tester aussi le changement de fichier pendant un appel, le refus, la coupure réseau
et l’affichage sur petit écran.
La configuration et les étapes de test sont dans le README du projet.
