# Appels audio

Interface d’appel à deux, branchée au back avec Socket.IO et WebRTC.

## Tester

Lancer le back et `npm run dev`, puis se connecter et ouvrir « Appels ».
Deux personnes doivent rejoindre le salon du même document pour s’appeler.
Le micro est demandé au démarrage ou à l’acceptation. Quitter la page termine l’appel.

La page `/audio-call.html` reste une démo visuelle, sans appel réel.

## Fichiers

- `components/call` : panneau, salon et lecture du son distant.
- `audio` : connexion Socket.IO et gestion WebRTC.
- `pages/AudioCallsPage.tsx` : choix du document et ouverture du salon.
- `components/shared/Button.tsx` : bouton commun au panneau et à la démo.
- `demos/audio-call` : page de test et états simulés.

`AudioCallPanel` reçoit le participant, l’état et les actions en props.
`AudioCallClient` gère la présence, les invitations, le micro et la connexion audio.
La configuration et les étapes de test sont dans le README du projet.
