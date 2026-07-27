import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Backend port is overridable via BACKEND_PORT (e.g. when the default 3000 is taken
// locally) so the proxy target and `npm run dev` stay in sync without editing this
// file each time -- see README/docs for the Tailscale dev-access setup.
const backendPort = process.env.BACKEND_PORT || '3000';

export default defineConfig({
  envDir: '..',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'Stormglass',
        short_name: 'Stormglass',
        description: 'Environmental tracking for chronic illness symptom management',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    // Bind all interfaces (not just localhost) so the dev server is reachable over
    // Tailscale/LAN, e.g. from a phone -- pass --host on the CLI or set host here;
    // both work, this is the persistent default so `npm run dev` alone is enough.
    host: true,
    // Pinned explicitly (matches Vite's own default, but don't let that become
    // implicit) -- the lair mobile dashboard's More tab has a hardcoded shortcut to
    // this exact port for quick phone access. Changing it silently breaks that
    // bookmark; update it there too if this ever needs to move.
    port: 5173,
    // Vite blocks requests with an unrecognized Host header by default (DNS-rebinding
    // protection). Tailscale's MagicDNS name needs an explicit allowlist entry; the
    // bare Tailscale IP doesn't trigger this check at all.
    allowedHosts: ['kates-mac-mini.tail778117.ts.net'],
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
});
