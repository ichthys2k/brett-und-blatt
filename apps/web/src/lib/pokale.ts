import type { BotLevel } from '@brett-und-blatt/engine';
import { totals, type Book, type Mode, type PlayedGame } from './partiebuch';

/*
 * Pokalschrank des Spielerpasses (Vorhaben #135, Schritt #146): Jeder Sieg legt einen Pokal ab. Wie viele es je Spiel sind,
 * sagen die Zähler des Partiebuchs (#142) verlustfrei; die Pokale selbst (mit Gegnern, Datum, Modus) behalten die
 * letzten 60 Siege. Turniersiege und der erste Sieg gegen „schwer“ je Spiel bekommen eine Urkunde zum Drucken.
 */

export type CertificateKind = 'turnier' | 'schwer';

export interface Trophy {
  /** Kennung der Partie (wie im Partiebuch). */
  id: string;
  gameId: string;
  at: number;
  mode: Mode;
  /** Stärkste Bot-Stufe am Tisch, falls Bots mitspielten. */
  level?: BotLevel;
  /** Spitznamen der Mitspieler (höchstens fünf). */
  opponents: string[];
  cert?: CertificateKind;
}

export const MAX_TROPHIES = 60;
const MODES: readonly Mode[] = ['solo', 'bots', 'hotseat', 'online', 'tournament'];
const LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];
const ID_PATTERN = /^[\w.:/-]{1,80}$/;
const GAME_PATTERN = /^[a-z0-9-]{1,40}$/;

/** Der Pokal zu einer gewonnenen Partie (sonst null). `firstHardWin`: Der Stempel „Sieg gegen schwer“ ist neu. */
export function trophyFor(game: PlayedGame, level: BotLevel | null, firstHardWin: boolean): Trophy | null {
  if (game.outcome !== 'win') return null;
  const cert: CertificateKind | undefined = game.mode === 'tournament' ? 'turnier' : game.mode === 'bots' && level === 'hard' && firstHardWin ? 'schwer' : undefined;
  return {
    id: game.id,
    gameId: game.gameId,
    at: game.endedAt,
    mode: game.mode,
    ...(level && game.mode === 'bots' ? { level } : {}),
    opponents: game.seats.filter((seat) => !seat.you).map((seat) => seat.name).slice(0, 5),
    ...(cert ? { cert } : {}),
  };
}

const newestFirst = (list: Trophy[]) => [...list].sort((a, b) => b.at - a.at);

/** Legt einen Pokal ab; eine schon vorhandene Partie zählt nicht doppelt. */
export function addTrophy(list: Trophy[], trophy: Trophy): Trophy[] {
  if (list.some((entry) => entry.id === trophy.id)) return list;
  return newestFirst([trophy, ...list]).slice(0, MAX_TROPHIES);
}

/** Vereinigung nach Kennung; die neuesten 60 bleiben. */
export function mergeTrophies(remote: Trophy[], local: Trophy[]): Trophy[] {
  const byId = new Map<string, Trophy>();
  for (const trophy of [...remote, ...local]) if (!byId.has(trophy.id)) byId.set(trophy.id, trophy);
  return newestFirst([...byId.values()]).slice(0, MAX_TROPHIES);
}

export function sameTrophies(a: Trophy[], b: Trophy[]): boolean {
  return JSON.stringify(a.map((t) => [t.id, t.cert ?? ''])) === JSON.stringify(b.map((t) => [t.id, t.cert ?? '']));
}

/** Macht aus fremden Daten eine gültige Liste. */
export function sanitizeTrophies(value: unknown): Trophy[] {
  const out: Trophy[] = [];
  for (const raw of Array.isArray(value) ? value.slice(0, MAX_TROPHIES * 2) : []) {
    const v = (raw ?? {}) as Record<string, unknown>;
    if (typeof v.id !== 'string' || !ID_PATTERN.test(v.id) || typeof v.gameId !== 'string' || !GAME_PATTERN.test(v.gameId)) continue;
    if (!MODES.includes(v.mode as Mode) || typeof v.at !== 'number' || !Number.isFinite(v.at) || v.at <= 0 || v.at > 10_000_000_000_000) continue;
    out.push({
      id: v.id,
      gameId: v.gameId,
      at: Math.floor(v.at),
      mode: v.mode as Mode,
      ...(LEVELS.includes(v.level as BotLevel) ? { level: v.level as BotLevel } : {}),
      opponents: (Array.isArray(v.opponents) ? v.opponents : []).filter((name): name is string => typeof name === 'string').slice(0, 5).map((name) => name.slice(0, 40)),
      ...(v.cert === 'turnier' || v.cert === 'schwer' ? { cert: v.cert } : {}),
    });
  }
  return newestFirst(mergeTrophies([], out));
}

export interface Shelf {
  gameId: string;
  /** Alle Siege in diesem Spiel (aus den Zählern, auch ältere als die gemerkten Pokale). */
  wins: number;
  trophies: Trophy[];
}

/** Die Regalfächer: je Spiel mit mindestens einem Sieg, die meisten Siege zuerst. */
export function shelves(book: Book, trophies: Trophy[]): Shelf[] {
  const ids = new Set<string>(trophies.map((t) => t.gameId));
  for (const games of Object.values(book.counts)) for (const id of Object.keys(games)) ids.add(id);
  return [...ids]
    .map((gameId) => ({ gameId, wins: Math.max(totals(book, gameId).won, trophies.filter((t) => t.gameId === gameId).length), trophies: trophies.filter((t) => t.gameId === gameId) }))
    .filter((shelf) => shelf.wins > 0)
    .sort((a, b) => b.wins - a.wins || a.gameId.localeCompare(b.gameId));
}
