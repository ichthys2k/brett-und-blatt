import type { LogEntry, SessionConfig } from '@brett-und-blatt/engine';
import { sanitizeBook, type PlayedGame } from './partiebuch';

/*
 * Chronik des Spielerpasses (Vorhaben #135, Schritt #143): Die letzten Partien stehen als Kopfzeilen im Partiebuch (#142).
 * **Anheften** (höchstens 20) behält zusätzlich alles zum Nachspielen: Einstellungen (mit Seed), Plätze und Zugliste.
 * Das Nachspielen selbst folgt mit #99. Reine Funktionen; Speicher und Oberfläche liegen anderswo.
 *
 * Zusammenführen: je Partie gewinnt die jüngere Änderung (Anheften oder Lösen); Gelöst bleibt als Löschvermerk stehen,
 * damit ein zweites Gerät das Lösen nicht rückgängig macht.
 */

/** Alles, was das Nachspielen einer lokalen Partie braucht. */
export interface Replay {
  config: SessionConfig;
  log: LogEntry[];
}

export interface Pinned {
  id: string;
  /** Zeitpunkt des Anheftens oder Lösens (ms). */
  at: number;
  /** Gelöst: nur noch der Löschvermerk. */
  deleted?: true;
  game?: PlayedGame;
  replay?: Replay;
}

export type Chronik = Record<string, Pinned>;

export const MAX_PINNED = 20;
/** Höchstgröße des ganzen Blocks als Text; der Server nimmt 64 KB (Base64) an, das sind rund 48 KB Klartext. */
export const MAX_CHRONIK_CHARS = 40_000;
/** Größte Zugliste, die mitgespeichert wird. */
export const MAX_REPLAY_CHARS = 14_000;
/** Die Ablage hält die Daten der letzten Partien, damit man sie nach dem Ende noch anheften kann. */
export const MAX_ABLAGE = 10;

export type Ablage = Record<string, { at: number; replay: Replay }>;

const ID_PATTERN = /^[\w.:/-]{1,80}$/;
const size = (value: unknown) => JSON.stringify(value).length;

/** Merkt die Zugliste einer beendeten Partie (zu große werden nicht gemerkt). */
export function stashReplay(ablage: Ablage, id: string, replay: Replay, now: number): Ablage {
  if (size(replay) > MAX_REPLAY_CHARS) return ablage;
  const next = { ...ablage, [id]: { at: now, replay } };
  const keep = Object.entries(next).sort(([, a], [, b]) => b.at - a.at).slice(0, MAX_ABLAGE);
  return Object.fromEntries(keep);
}

export function pinnedList(chronik: Chronik): Pinned[] {
  return Object.values(chronik)
    .filter((item) => !item.deleted && item.game)
    .sort((a, b) => b.at - a.at);
}

export type PinResult = { ok: true; chronik: Chronik } | { ok: false; reason: 'limit' | 'size' };

/** Heftet eine Partie an. Ohne Zugliste bleibt nur die Kopfzeile. */
export function pin(chronik: Chronik, game: PlayedGame, replay: Replay | null, now: number): PinResult {
  if (chronik[game.id] && !chronik[game.id]!.deleted) return { ok: true, chronik };
  if (pinnedList(chronik).length >= MAX_PINNED) return { ok: false, reason: 'limit' };
  const next: Chronik = { ...chronik, [game.id]: { id: game.id, at: now, game, ...(replay ? { replay } : {}) } };
  if (size(next) > MAX_CHRONIK_CHARS) return { ok: false, reason: 'size' };
  return { ok: true, chronik: next };
}

export function unpin(chronik: Chronik, id: string, now: number): Chronik {
  return chronik[id] ? { ...chronik, [id]: { id, at: now, deleted: true } } : chronik;
}

export function sanitizeReplay(value: unknown): Replay | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { config, log } = value as { config?: unknown; log?: unknown };
  if (!config || typeof config !== 'object' || !Array.isArray(log)) return undefined;
  const c = config as { gameId?: unknown; seed?: unknown; seats?: unknown };
  if (typeof c.gameId !== 'string' || typeof c.seed !== 'string' || !Array.isArray(c.seats)) return undefined;
  const replay = { config: config as SessionConfig, log: log as LogEntry[] };
  return size(replay) <= MAX_REPLAY_CHARS ? replay : undefined;
}

/** Macht aus fremden Daten eine gültige Chronik. */
export function sanitizeChronik(value: unknown): Chronik {
  const out: Chronik = {};
  if (!value || typeof value !== 'object') return out;
  for (const [id, raw] of Object.entries(value as Record<string, unknown>).slice(0, MAX_PINNED * 3)) {
    if (!ID_PATTERN.test(id) || !raw || typeof raw !== 'object') continue;
    const { at, deleted, game, replay } = raw as Record<string, unknown>;
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) continue;
    if (deleted === true) {
      out[id] = { id, at: Math.floor(at), deleted: true };
      continue;
    }
    const header = sanitizeBook({ recent: [game] }).recent[0];
    if (!header || header.id !== id) continue;
    const kept = sanitizeReplay(replay);
    out[id] = { id, at: Math.floor(at), game: header, ...(kept ? { replay: kept } : {}) };
  }
  return out;
}

/** Je Partie gewinnt die jüngere Änderung; die Grenzen (20 Angeheftete, Größe) gelten danach wieder. */
export function mergeChronik(remote: Chronik, local: Chronik): Chronik {
  const merged: Chronik = { ...local };
  for (const [id, item] of Object.entries(remote)) {
    const mine = merged[id];
    if (!mine || item.at > mine.at) merged[id] = item;
  }
  return limit(merged);
}

/** Behält die jüngsten 20 Angehefteten, wirft bei Überlänge zuerst Zuglisten der ältesten ab, dann deren Löschvermerke. */
export function limit(chronik: Chronik): Chronik {
  let next: Chronik = { ...chronik };
  const live = pinnedList(next);
  for (const old of live.slice(MAX_PINNED)) delete next[old.id];
  for (const old of [...pinnedList(next)].reverse()) {
    if (size(next) <= MAX_CHRONIK_CHARS) break;
    if (old.replay) next[old.id] = { id: old.id, at: old.at, game: old.game };
  }
  // Löschvermerke: nur die jüngsten 40 behalten
  const tombs = Object.values(next).filter((item) => item.deleted).sort((a, b) => b.at - a.at);
  for (const old of tombs.slice(40)) delete next[old.id];
  if (size(next) > MAX_CHRONIK_CHARS) next = Object.fromEntries(Object.entries(next).filter(([, item]) => item.deleted || !item.replay));
  return next;
}

export function sameChronik(a: Chronik, b: Chronik): boolean {
  const key = (value: Chronik) => JSON.stringify(Object.keys(value).sort().map((id) => [id, value[id]!.at, Boolean(value[id]!.deleted)]));
  return key(a) === key(b);
}
