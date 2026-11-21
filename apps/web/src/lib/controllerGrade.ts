import grades from './controllerGrades.json';

/*
 * Gemessene Controller-Eignung je Spiel (#607, K0): `direct` (Steuerkreuz und A genügen),
 * `carousel` (über „Erlaubte Züge“), `cursor` (nur mit Zeiger). Erzeugt mit
 * `node scripts/controller-audit.mjs --json apps/web/src/lib/controllerGrades.json`; Bericht in
 * `docs/spiele/konsole-eignung.md`.
 */

export type ControllerGrade = 'direct' | 'carousel' | 'cursor';

interface GradeEntry {
  grade: ControllerGrade;
}

const table = grades as Record<string, GradeEntry>;

/** Gemessene Controller-Eignung eines Spiels (K0, #607); `undefined`, wenn noch nicht gemessen. */
export function controllerGrade(gameId: string): ControllerGrade | undefined {
  return table[gameId]?.grade;
}
