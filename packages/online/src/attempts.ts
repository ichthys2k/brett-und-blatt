/**
 * Begrenzung von Fehlversuchen (Spielercode, #112): Ein Spielercode aus vier Emoji hat nur
 * 16⁴ = 65 536 Möglichkeiten. Damit niemand fremde Ausweise durch Durchprobieren findet,
 * zählt der Server je Absender die Anfragen an eine nicht vorhandene Sicherung und sperrt
 * ihn nach `ATTEMPT_LIMIT` Fehlversuchen für den Rest des Zeitfensters.
 *
 * Reine Logik ohne Anbieterbindung; das Durable Object im Server hält nur den Zustand.
 */

/** Fehlversuche je Absender und Zeitfenster. Eine Schulklasse hinter einer Adresse legt vielleicht 30 Codes an. */
export const ATTEMPT_LIMIT = 60;
/** Länge des Zeitfensters (ms). */
export const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

export interface AttemptState {
  /** Beginn des laufenden Zeitfensters (ms). */
  since: number;
  /** Fehlversuche seit `since`. */
  misses: number;
}

/** Ist der Absender gerade gesperrt? */
export function isBlocked(state: AttemptState | null, now: number): boolean {
  return !!state && now < state.since + ATTEMPT_WINDOW_MS && state.misses >= ATTEMPT_LIMIT;
}

/** Zustand nach einem weiteren Fehlversuch; ein abgelaufenes Fenster beginnt neu. */
export function recordMiss(state: AttemptState | null, now: number): AttemptState {
  if (!state || now >= state.since + ATTEMPT_WINDOW_MS) return { since: now, misses: 1 };
  return { since: state.since, misses: state.misses + 1 };
}
