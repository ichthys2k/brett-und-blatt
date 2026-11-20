/**
 * Würfeln mit dem Becher (#389): Becher greifen, schütteln, loslassen. Reine Erkennung des
 * Schüttelns (mindestens zwei Richtungswechsel mit genug Ausschlag), damit sie sich testen lässt.
 * Das Ergebnis bestimmt weiterhin allein der Server; die Geste löst nur denselben Zug wie der Knopf aus.
 */
import { turns } from '../gestures';

export const SHAKE_TURNS = 2;
export const SHAKE_AMPLITUDE = 0.03;

export function shaken(path: [number, number][]): boolean {
  return turns(path.map(([x, z]) => [x, 0, z] as [number, number, number]), SHAKE_AMPLITUDE) >= SHAKE_TURNS;
}

/** Dauer der Rollanimation in Millisekunden. */
export const ROLL_MS = 650;

/** Verlauf der Animation: 1 beim Wurf, 0 wenn der Würfel liegt. */
export function rollProgress(ageMs: number): number {
  return Math.max(0, 1 - ageMs / ROLL_MS);
}

/** Würfelblock: Würfel i liegt bei x = (i - 2) * KNIFFEL_DIE_STEP, jeder ist etwa 0,07 breit (#585). */
export const KNIFFEL_DIE_STEP = 0.08;
export const KNIFFEL_DIE_WIDTH = 0.07;
/** Würfeln-Knopf (Mitte, Breite): rechts neben dem fünften Würfel, damit er keinen Würfel überdeckt (#585). */
export const KNIFFEL_ROLL_BUTTON: [number, number, number] = [0.38, 0.07, 0.0];
export const KNIFFEL_ROLL_BUTTON_WIDTH = 0.24;
