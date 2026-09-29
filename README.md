# CoEditFront

Front de CoEdit (React + TypeScript + Vite + Tailwind).

## Lancement

```bash
cp .env.example .env
npm install
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

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
