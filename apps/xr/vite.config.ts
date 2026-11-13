import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { klaenge } from './klaenge';

/**
 * Der Quest-Nachbau (IWER samt Bedienleiste mit Font-Awesome-Symbolen) wird nur zum Entwickeln
 * gebraucht. Im Build ersetzt ein leeres Modul ihn, damit er weder ausgeliefert noch lizenziert werden muss.
 */
function withoutEmulator(): Plugin {
  const stub = '\0brett-xr-ohne-emulator';
  return {
    name: 'brett-und-blatt:ohne-emulator',
    apply: 'build',
    enforce: 'pre',
    resolveId(id, importer) {
      return id === './emulate.js' && importer?.includes('@pmndrs') ? stub : null;
    },
    load(id) {
      return id === stub ? 'export function emulate() {}' : null;
    },
  };
}

// WebXR-Probelauf (#339). Eigener Port, damit er neben der Web-App (5173) laufen kann.
export default defineConfig({
  plugins: [react(), withoutEmulator(), klaenge()],
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
  build: { chunkSizeWarningLimit: 1600 },
});
