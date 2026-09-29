import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Adresse de l'API, lue dans le .env (API_PROXY_TARGET), par défaut http://localhost:3000
  const apiProxyTarget = loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Par sécurité, Vite ne répond qu'aux adresses localhost.
      // On l'autorise aussi à répondre aux liens ngrok, pour les tests à plusieurs.
      allowedHosts: ['.ngrok-free.app', '.ngrok.app'],

      // Vite fait suivre à l'API toutes les requêtes qui commencent par /api ou /socket.io.
      // Pour le navigateur, tout vient donc du même site : le cookie de session est bien envoyé.
      proxy: {
        // xfwd : transmet l'IP du vrai visiteur à l'API (sinon la limite de tentatives bloquerait tout le monde)
        '/api': { target: apiProxyTarget, xfwd: true },
        // ws : fait aussi suivre les connexions temps réel (WebSocket) de la collaboration
        '/socket.io': { target: apiProxyTarget, ws: true, xfwd: true },
      },
    },
  }
})
