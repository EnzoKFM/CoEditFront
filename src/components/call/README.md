# Appels audio

Interface d’appel à deux. Pour l’instant, tout est simulé : le micro et le back ne sont pas branchés.

## Tester

Lancer `npm run dev` et ouvrir `/audio-call.html`.
Les boutons de la démo permettent de recevoir un appel, de simuler une connexion ou une erreur.
Cette page sert aux essais et n’est pas incluse dans le build principal.

## Fichiers

- `components/call` : panneau d’appel et types.
- `components/shared/Button.tsx` : bouton commun au panneau et à la démo.
- `demos/audio-call` : page de test et états simulés.

`AudioCallPanel` reçoit le participant, le document, l’état de l’appel et les actions en props.
La démo montre comment l’utiliser. Le branchement WebRTC viendra quand le back sera prêt.
