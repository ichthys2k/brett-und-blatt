import type { Plugin } from 'vite';

/**
 * Content-Security-Policy für die gebaute Web-App (#322), als `<meta>`, weil GitHub Pages keine
 * eigenen Kopfzeilen erlaubt. Zweite Verteidigungslinie hinter dem Bereiniger für Anki-Karten:
 * Auch ein eingeschleustes Skript oder `onerror="…"` läuft nicht.
 * Nur im Build – der Dev-Server von Vite braucht für das Neuladen eingebettete Skripte.
 * `frame-ancestors` wirkt in einer Meta-CSP nicht und fehlt deshalb.
 */
export function csp(): Plugin {
  return {
    name: 'brett-und-blatt:csp',
    apply: 'build',
    transformIndexHtml() {
      const server = process.env.VITE_GAME_SERVER?.replace(/\/+$/, '');
      const connect = ["'self'", 'blob:', 'data:'];
      if (server) {
        const origin = new URL(server).origin;
        connect.push(origin, origin.replace(/^http/, 'ws'));
      }
      const policy = [
        "default-src 'self'",
        // WebAssembly für sql.js (Anki-Pakete) und zstd; sonst nur eigene Skripte.
        "script-src 'self' 'wasm-unsafe-eval'",
        // React setzt Stile als Attribute; Tailwind liefert eigene Dateien.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        "media-src 'self' blob: data:",
        "font-src 'self' data:",
        `connect-src ${connect.join(' ')}`,
        // Bots laufen im Web Worker; der Service Worker kommt aus derselben Quelle.
        "worker-src 'self' blob:",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}
