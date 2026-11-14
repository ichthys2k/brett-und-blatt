import { useSyncExternalStore } from 'react';

/**
 * Figurensätze der Brettspiele (#325): „classic“ ist die heutige Darstellung (Zeichen und gezeichnete Formen),
 * die drei anderen sind gemalte Bilder. Die Wahl gilt je Spiel und Gerät.
 */
export type PieceSetId = 'classic' | 'wood' | 'metal' | 'fable';

export const PIECE_SET_IDS: readonly PieceSetId[] = ['classic', 'wood', 'metal', 'fable'];

export const PIECE_SET_LABELS: Record<PieceSetId, string> = {
  classic: 'Klassisch',
  wood: 'Holz',
  metal: 'Metall',
  fable: 'Märchen',
};

/**
 * Standardsatz je Spiel für alle, die selbst nichts gewählt haben. Fehlt ein Spiel, gilt „classic“.
 * Cornelius trägt hier ein, welcher Satz bei welchem Spiel der Standard sein soll.
 */
export const PIECE_SET_DEFAULTS: Readonly<Record<string, PieceSetId>> = {};

const KEY = 'brett-und-blatt:figuren';
const listeners = new Set<() => void>();

function load(): Record<string, PieceSetId> {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, PieceSetId> = {};
    for (const [game, set] of Object.entries(parsed)) {
      if (typeof set === 'string' && (PIECE_SET_IDS as readonly string[]).includes(set)) out[game] = set as PieceSetId;
    }
    return out;
  } catch {
    return {};
  }
}

let chosen = load();
const applied = new Set<string>();

/**
 * Spiele, die ihre Steine über CSS austauschen, lesen den Satz am Attribut `data-pieces-<spiel>` auf <html>
 * (nur gesetzt, solange nicht „classic“ gilt). Spiele mit Bildern im Markup (Schach) nutzen den Haken.
 */
function applyAttributes(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const games = new Set([...Object.keys(chosen), ...Object.keys(PIECE_SET_DEFAULTS), ...applied]);
  for (const game of games) {
    const set = resolvePieceSet(game);
    if (set === 'classic') {
      root.removeAttribute(`data-pieces-${game}`);
      applied.delete(game);
    } else {
      root.setAttribute(`data-pieces-${game}`, set);
      applied.add(game);
    }
  }
}

/** Was der Spieler selbst gewählt hat (`null`: nichts, es gilt der Standard). */
export function chosenPieceSet(gameId: string): PieceSetId | null {
  return chosen[gameId] ?? null;
}

/** Satz wählen; `null` nimmt die eigene Wahl zurück. */
export function setPieceSet(gameId: string, set: PieceSetId | null): void {
  const next = { ...chosen };
  if (set === null) delete next[gameId];
  else next[gameId] = set;
  chosen = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  applyAttributes();
  for (const listener of listeners) listener();
}

/**
 * Der Satz, der gerade wirklich gilt: eigene Wahl vor allem; sonst bei erhöhtem Kontrast oder im Aussehen
 * „Schlicht“ der klassische Satz, sonst der Standard des Spiels.
 */
export function resolvePieceSet(gameId: string): PieceSetId {
  const own = chosen[gameId];
  if (own) return own;
  if (typeof window !== 'undefined') {
    const contrast = window.matchMedia?.('(prefers-contrast: more)').matches;
    const plain = document.documentElement.dataset.look === 'plain';
    if (contrast || plain) return 'classic';
  }
  return PIECE_SET_DEFAULTS[gameId] ?? 'classic';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Der geltende Figurensatz eines Spiels; wechselt sofort, auch mitten in der Partie. */
export function usePieceSet(gameId: string): PieceSetId {
  return useSyncExternalStore(subscribe, () => resolvePieceSet(gameId));
}

/** Für Tests: gespeicherte Wahl neu einlesen. */
export function reloadPieceSets(): void {
  chosen = load();
  applyAttributes();
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  applyAttributes();
  // Aussehen oder Kontrast ändern sich: Attribute neu setzen.
  window.matchMedia?.('(prefers-contrast: more)').addEventListener?.('change', applyAttributes);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(applyAttributes).observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] });
}
