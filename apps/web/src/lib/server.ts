/**
 * Adresse des Spieleservers. Beim Bauen über `VITE_GAME_SERVER` festgelegt; im Dev-Modus der
 * lokale Server (`wrangler dev`). Ohne Adresse gibt es keine Online-Spiele.
 *
 * Steht bewusst in einer eigenen Datei: `modules` (Regeln laden) und `online` (Räume) brauchen
 * die Adresse beide, dürfen sich aber nicht gegenseitig importieren.
 */
export const GAME_SERVER: string | null =
  import.meta.env.VITE_GAME_SERVER || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : null);
