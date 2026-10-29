import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { kataloge } from './kataloge.ts';
import { klaenge } from './klaenge.ts';

export default defineConfig({
  // Unter einer Unteradresse (z. B. GitHub Pages) mit BASE_PATH=/brett-und-blatt/ bauen.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    klaenge(),
    kataloge(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Brett & Blatt',
        short_name: 'Brett & Blatt',
        description: 'Karten- und Brettspiele – allein gegen Bots, zu mehreren an einem Gerät oder online.',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f5f1ea',
        theme_color: '#1f6f5c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alles vorab speichern: Solo und Hot-Seat funktionieren dann ohne Internet (Effekte zusammen etwa 1 MB).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,mp3,json}'],
        // Musik, Tierstimmen (Drachenspiel, rund 14 MB) und Enten-Rallye-Ton sind zu groß zum Vorab-Speichern:
        // Sie kommen beim ersten Abspielen in einen eigenen Speicher.
        globIgnores: ['**/klaenge/musik/**', '**/klaenge/tiere/**', '**/klaenge/duck-rally/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/klaenge/tiere/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiere',
              expiration: { maxEntries: 400, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Die Enten-Rallye spielt über <audio>, das in Stücken (Range) anfragt. Gespeichert wird nur die
            // ganze Datei, die das Spiel im Hintergrund vorlädt (`RallyAudio.prefetch`); `rangeRequests`
            // schneidet daraus die angefragten Stücke.
            urlPattern: ({ url }) => url.pathname.includes('/klaenge/duck-rally/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'enten-rallye',
              rangeRequests: true,
              expiration: { maxEntries: 40, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/klaenge/musik/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'musik',
              expiration: { maxEntries: 8, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  worker: {
    // Der Bot-Worker lädt Spiele bei Bedarf nach – das geht nur mit ES-Modulen.
    format: 'es',
  },
});
