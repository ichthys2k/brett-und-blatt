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
