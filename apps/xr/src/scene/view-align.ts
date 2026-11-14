/**
 * Tisch am Kopf ausrichten (#365). Der Tisch steht fest im Raum (`TABLE_CENTER`); die Brille
 * zeigt dort, wo ihr Bezugsraum es sagt. Kennt die Quest den Boden nicht (Bezugsraum „local“,
 * z. B. im Sitzen oder nach dem Neuausrichten), liegt der Kopf bei Höhe 0 – mitten im Tisch.
 * Deshalb wird beim Eintreten und nach jedem Neuausrichten einmal der Kopf gemessen und der
 * Ursprung so verschoben, dass man mittig vor dem Tisch sitzt, mit den Augen über der Tischplatte.
 * Reine Rechnung ohne three.js, damit `tests/xr-panel.test.ts` sie prüfen kann.
 */

/** Augenhöhe über dem Boden, in der man bequem von oben auf den Tisch schaut (Tischplatte bei 0,74 m). */
export const EYE_MIN = 1.05;
export const EYE_MAX = 1.5;

export interface Offset {
  x: number;
  y: number;
  z: number;
}

/**
 * Verschiebung des Ursprungs aus der gemessenen Kopfposition im Bezugsraum:
 * seitlich und nach vorn mittig vor den Tisch, die Höhe in den Bereich EYE_MIN … EYE_MAX
 * (bekannter Boden und normale Haltung bleiben unverändert).
 */
export function alignOffset(head: Offset): Offset {
  const eye = Math.min(EYE_MAX, Math.max(EYE_MIN, head.y));
  return { x: -head.x, y: eye - head.y, z: -head.z };
}
