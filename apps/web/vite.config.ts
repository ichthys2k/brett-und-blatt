import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { kataloge } from './kataloge.ts';
import { klaenge } from './klaenge.ts';

/** Kennung dieses Builds (Commit-Kurzform aus der CI, sonst „dev“) und Zeitpunkt – für die Versionsanzeige (#175). */
const buildId = (process.env.GITHUB_SHA ?? 'dev').slice(0, 7);
const buildDate = new Date().toISOString().slice(0, 10);
const buildTime = Date.now();

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId), __BUILD_DATE__: JSON.stringify(buildDate), __BUILD_TIME__: buildTime },
  // Unter einer Unteradresse (z. B. GitHub Pages) mit BASE_PATH=/brett-und-blatt/ bauen.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    {
      // `version.json` liegt neben der App und wird nicht vorab gespeichert: Die App fragt damit nach, ob die
      // bereitstehende Version wirklich jünger ist als die laufende (#175).
      name: 'brett-und-blatt:version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId, time: buildTime }) });
      },
    },
    react(),
    tailwindcss(),
    klaenge(),
    kataloge(),
    VitePWA({
      // „prompt“: Eine neue Version wartet, bis wir sie anwenden (Hinweisleiste oder Pause zwischen Partien) – statt mitten im Spiel neu zu laden.
      registerType: 'prompt',
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
        background_color: '#efe3c8',
        theme_color: '#5a3b22',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alles vorab speichern: Solo und Hot-Seat funktionieren dann ohne Internet (Effekte zusammen etwa 1 MB).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,mp3,json,woff2}'],
        // Musik, Tierstimmen (Drachenspiel, rund 14 MB), Avatar-Ansagen (gut 5 MB) und Enten-Rallye-Ton
        // sind zu groß zum Vorab-Speichern: Sie kommen beim ersten Abspielen in einen eigenen Speicher.
        globIgnores: ['**/version.json', '**/klaenge/musik/**', '**/klaenge/tiere/**', '**/klaenge/avatare/**', '**/klaenge/duck-rally/**'],
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
            urlPattern: ({ url }) => url.pathname.includes('/klaenge/avatare/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'avatare',
              expiration: { maxEntries: 200, purgeOnQuotaError: true },
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
            // Gegner-Porträts im Narrenhof (rund 200 kleine WebP-Bilder): erst beim ersten Anblick speichern.
            urlPattern: ({ url }) => url.pathname.endsWith('.webp'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'portraets',
              expiration: { maxEntries: 300, purgeOnQuotaError: true },
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
