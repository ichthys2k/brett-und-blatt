import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// WebXR-Probelauf (#339). Eigener Port, damit er neben der Web-App (5173) laufen kann.
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
  build: { chunkSizeWarningLimit: 1600 },
});
