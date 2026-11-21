/*
 * Wohin der Fokus am Spieltisch springt, wenn sich dessen Zustand ändert (#607, K7) – rein und testbar.
 * Nur bei Controller oder Tastatur; mit Maus und Finger springt der Fokus nie von selbst.
 */

export type BoardFocusTarget = 'none' | 'board' | 'handover' | 'result';

export interface BoardFocusInput {
  source: 'pointer' | 'keyboard' | 'gamepad';
  /** Liegt der Fokus auf <body>, auf einem entfernten oder gesperrten Element, oder gar nicht im Dokument? */
  focusLost: boolean;
  /** Liegt der Fokus innerhalb des Spielfelds (`play-board`)? */
  focusInBoard: boolean;
  menuOpen: boolean;
  /** Ist ein Fenster offen (Anleitung, Großansicht, Bildschirmtastatur)? */
  dialogOpen: boolean;
  handover: boolean;
  result: boolean;
  yourMove: boolean;
}

/** Wohin der Fokus springen soll; `none` = nichts tun. */
export function boardFocusTarget(input: BoardFocusInput): BoardFocusTarget {
  if (input.source === 'pointer') return 'none';
  if (input.menuOpen || input.dialogOpen) return 'none';
  if (input.handover) return 'handover';
  if (input.result) return 'result';
  if (input.yourMove && (input.focusLost || !input.focusInBoard)) return 'board';
  return 'none';
}
