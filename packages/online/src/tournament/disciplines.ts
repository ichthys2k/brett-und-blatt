import type { TournamentSnapshot } from './types';

/**
 * Spieleabend mit Wunschdisziplinen (W-058 Stufe 3 Teil 2, #129): Jeder gegen jeden im
 * Bundesliga-Modus, aber jeder Spieltag hat eine eigene Disziplin. Online sind Disziplinen
 * Spiel-ids, vor Ort freie Namen. Mit `settings.wishes` wünschen sich die Teilnehmer bei der
 * Einschreibung Disziplinen; beim Start werden die gewünschten nach Stimmen geordnet.
 */

export const DISCIPLINES_MIN = 2;
export const DISCIPLINES_MAX = 8;

export function hasDisciplines(s: TournamentSnapshot): boolean {
  return (s.settings.disciplines?.length ?? 0) >= DISCIPLINES_MIN;
}

/** Stimmen je Disziplin in der Reihenfolge der Leitung. */
export function wishCounts(s: TournamentSnapshot): { id: string; wishes: number }[] {
  const counts = new Map((s.settings.disciplines ?? []).map((id) => [id, 0]));
  for (const player of s.players) for (const id of s.wishes?.[player.id] ?? []) if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
  return [...counts].map(([id, wishes]) => ({ id, wishes }));
}

/**
 * Die Reihenfolge, in der die Disziplinen auf die Spieltage kommen. Ohne Wünsche die der
 * Leitung; mit Wünschen nur die gewünschten, meistgewünschte zuerst (bei Gleichstand die
 * Reihenfolge der Leitung). Wünscht niemand etwas, bleiben alle.
 */
export function chooseDisciplines(s: TournamentSnapshot): string[] {
  const all = s.settings.disciplines ?? [];
  if (!s.settings.wishes) return [...all];
  const counts = wishCounts(s);
  const wished = counts.filter((c) => c.wishes > 0);
  if (wished.length === 0) return [...all];
  // `sort` ist stabil: Gleichstand behält die Reihenfolge der Leitung.
  return wished.sort((a, b) => b.wishes - a.wishes).map((c) => c.id);
}

/** Die Disziplin eines Spieltags: reihum über die gewählten. */
export function disciplineOf(s: TournamentSnapshot, stage: number): string | null {
  const order = s.disciplineOrder ?? s.settings.disciplines ?? [];
  return hasDisciplines(s) && order.length > 0 ? order[stage % order.length]! : null;
}

/** Wunschliste eines Teilnehmers setzen. Ein Text bedeutet: abgelehnt. */
export function setWishes(s: TournamentSnapshot, playerId: string, ids: readonly string[]): string | null {
  if (!hasDisciplines(s) || !s.settings.wishes) return 'In diesem Turnier gibt es keine Wünsche.';
  if (s.phase !== 'signup') return 'Die Einschreibung ist beendet.';
  const allowed = new Set(s.settings.disciplines);
  if (!ids.every((id) => allowed.has(id))) return 'Diese Disziplin gibt es hier nicht.';
  s.wishes = { ...s.wishes, [playerId]: [...new Set(ids)] };
  return null;
}
