import { MATCH_MIN_TIME_MS, type TournamentMatch, type TournamentSnapshot } from './types';

/**
 * Turnierabend (W-058 Stufe 3): Online-Turnier „heute Abend, alle zugleich“. Fristen in
 * Minuten statt Tagen, jede Runde beginnt erst, wenn die Leitung sie startet; dann starten
 * alle Partien der Runde zugleich, ohne dass jemand „Bereit“ sagen muss. Wer in einer Runde
 * mehrere Partien hat (Gruppenphase), spielt sie nacheinander: Die nächste startet von
 * selbst, sobald beide frei sind.
 */

/** Minuten je Partie, die die Leitung wählen kann. */
export const EVENING_MINUTE_CHOICES = [10, 15, 20, 30, 45, 60] as const;
/** Verlängern um so viele Minuten. */
export const EVENING_EXTEND_CHOICES = [5, 10, 15] as const;

export function isEvening(s: TournamentSnapshot): boolean {
  return s.settings.mode !== 'local' && (s.settings.minutes ?? 0) > 0;
}

/** Die Partie gehört zu einer Runde, die die Leitung noch nicht gestartet hat. */
export function isHeld(s: TournamentSnapshot, match: TournamentMatch): boolean {
  return isEvening(s) && s.stages[match.stage]?.startedAt === undefined;
}

/** Spätester Zeitpunkt einer offenen Partie: Frist der Runde, mindestens eine Partiedauer nach dem Öffnen. */
export function eveningDueAt(s: TournamentSnapshot, match: TournamentMatch): number {
  const windowMs = (s.settings.minutes ?? 0) * 60_000;
  return Math.max(s.stages[match.stage]?.deadline ?? 0, (match.openedAt ?? 0) + (windowMs || MATCH_MIN_TIME_MS));
}

/**
 * Die Runde, die die Leitung jetzt starten kann: die laufende, wenn sie noch nicht gestartet
 * ist und schon Partien mit feststehenden Spielern hat. Sonst null.
 */
export function startableStage(s: TournamentSnapshot, current: number): number | null {
  if (!isEvening(s) || s.phase !== 'running') return null;
  const stage = s.stages[current];
  if (!stage || stage.startedAt !== undefined) return null;
  return s.matches.some((m) => m.stage === current && m.status === 'open') ? current : null;
}

/** Startet die Runde: Frist = Minuten × die meisten Partien eines Spielers in dieser Runde. */
export function startStage(s: TournamentSnapshot, index: number, now: number): void {
  const stage = s.stages[index]!;
  const perPlayer = new Map<string, number>();
  for (const m of s.matches) {
    if (m.stage !== index) continue;
    for (const slot of m.slots) if (slot.player) perPlayer.set(slot.player, (perPlayer.get(slot.player) ?? 0) + 1);
  }
  const rounds = Math.max(1, ...perPlayer.values());
  stage.startedAt = now;
  stage.deadline = now + rounds * (s.settings.minutes ?? 0) * 60_000;
  for (const m of s.matches) if (m.stage === index && m.status === 'open') m.openedAt = now;
}

/**
 * Startet offene Partien gestarteter Runden, deren Spieler beide frei sind. Eine Partie, die
 * schon einmal lief (Nichterscheinen, Entscheidungsspiel), braucht wieder „Bereit“ – sonst
 * entstünde Raum um Raum für jemanden, der nicht da ist. true, wenn sich etwas bewegt hat.
 */
export function autoStart(s: TournamentSnapshot, now: number): boolean {
  if (!isEvening(s)) return false;
  const busy = new Set<string>();
  for (const m of s.matches) if (m.status === 'running') for (const slot of m.slots) if (slot.player) busy.add(slot.player);
  let moved = false;
  for (const m of s.matches) {
    if (m.status !== 'open' || isHeld(s, m) || m.everReady[0] || m.everReady[1] || m.replays > 0) continue;
    const players = m.slots.map((slot) => slot.player);
    if (players.some((p) => !p || busy.has(p))) continue;
    m.status = 'running';
    m.readyAt = [now, now];
    m.everReady = [true, true];
    for (const p of players) busy.add(p!);
    moved = true;
  }
  return moved;
}
