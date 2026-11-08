import type { GameSession, Result, SeatConfig } from '@brett-und-blatt/engine';
import type { AlbumSpec } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState } from 'react';
import { ALBUM_KEY, recordFinds, sanitizeAlbum } from './album';
import { emptyBook, localMode, outcomeFor, recordGame, sanitizeBook, strongestBot, type Mode, type PlayedGame } from './partiebuch';
import { passBook } from './passes';
import { rememberReplay } from './chronikStore';
import { addTrophy, sanitizeTrophies, trophyFor } from './pokale';
import { passSyncSoon } from './playerPass';
import { stampsFor } from './stamps';

/*
 * Der Recorder (Vorhaben #135, Schritt #142): Eine Stelle in der Web-App zeichnet jedes Partieende im Partiebuch des Passes auf –
 * für alle Spiele ohne Arbeit im Spiel. Lokal und im Hot-Seat eine Zeile je beteiligtem Pass, online nur der eigene Platz.
 * Abgebrochene Partien ohne Ergebnis zählen nicht, Aufgeben ist eine Niederlage (das Ergebnis sagt es).
 */

export const BOOK_KEY = 'brett-und-blatt:partiebuch';
export const TROPHIES_KEY = 'brett-und-blatt:pokale';

export interface RecordRow {
  /** Pass, dem die Zeile gehört; null: der aktive. */
  passId: string | null;
  game: PlayedGame;
}

export interface RecordInput {
  gameId: string;
  sessionId: string;
  result: Result;
  seats: readonly SeatConfig[];
  endedAt: number;
  durationMs: number;
  /** Punkte je Platz (aus `GameUi.seatScore`), soweit vorhanden. */
  scores?: readonly (number | string | null | undefined)[];
  /** Online: der eigene Platz (null: Zuschauer, dann wird nichts aufgezeichnet). */
  online?: { yourSeat: number | null; tournament: boolean };
}

/** Welche Zeilen entstehen aus einem Partieende? Rein, ohne Speicher. */
export function rowsFor(input: RecordInput): RecordRow[] {
  const { seats, result } = input;
  const mode: Mode = input.online ? (input.online.tournament ? 'tournament' : 'online') : localMode(seats);
  const humansSeats = seats.map((seat, index) => ({ seat, index })).filter(({ seat }) => seat.kind === 'human');
  const mine = input.online ? (input.online.yourSeat === null ? [] : humansSeats.filter(({ index }) => index === input.online!.yourSeat).map((entry) => ({ ...entry, passId: null as string | null }))) : [];
  let activeTaken = false;
  const local = input.online
    ? []
    : humansSeats.flatMap(({ seat, index }) => {
        if (seat.passId) return [{ seat, index, passId: seat.passId as string | null }];
        // Plätze mit freiem Namen zählen nicht; der erste gehört dem aktiven Pass.
        if (activeTaken) return [];
        activeTaken = true;
        return [{ seat, index, passId: null as string | null }];
      });
  return [...mine, ...local].map(({ index, passId }) => {
    const outcome = outcomeFor(result, index);
    const score = input.scores?.[index];
    return {
      passId,
      game: {
        id: input.sessionId,
        gameId: input.gameId,
        endedAt: input.endedAt,
        durationMs: Math.max(0, input.durationMs),
        mode,
        seats: seats.slice(0, 10).map((seat, i) => ({ name: seat.name, ...(seat.avatar ? { avatar: seat.avatar } : {}), kind: seat.kind, ...(seat.kind === 'bot' && seat.level ? { level: seat.level } : {}), ...(i === index ? { you: true } : {}) })),
        outcome,
        ...(outcome === 'win' && seats.length > 1 && result.kind === 'win' && result.winners.length === 1 ? { place: 1 } : {}),
        ...(typeof score === 'number' || typeof score === 'string' ? { score } : {}),
      },
    };
  });
}

function deviceCounterId(): string {
  const key = 'brett-und-blatt:zaehler-geraet';
  try {
    const known = window.localStorage.getItem(key);
    if (known && /^[\w-]{4,60}$/.test(known)) return known;
    const fresh = `g${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return 'geraet';
  }
}

/** Schreibt die Zeilen ins Partiebuch ihrer Pässe und legt Pokale ab. Liefert, ob der aktive Pass einen Pokal bekam. */
export function saveRows(rows: readonly RecordRow[], seats: readonly SeatConfig[]): boolean {
  if (rows.length === 0) return false;
  const level = strongestBot(seats);
  const device = deviceCounterId();
  let trophyForActive = false;
  for (const row of rows) {
    let firstHardWin = false;
    passBook.updateStored(row.passId, BOOK_KEY, (raw) => {
      let book = emptyBook();
      try {
        book = sanitizeBook(raw ? JSON.parse(raw) : null);
      } catch {
        // kaputtes Buch: neu anfangen
      }
      firstHardWin = !stampsFor(book, row.game.gameId).find((stamp) => stamp.kind === 'win-hard')!.earned;
      return JSON.stringify(recordGame(book, row.game, device, level));
    });
    const trophy = trophyFor(row.game, level, firstHardWin);
    if (trophy) {
      passBook.updateStored(row.passId, TROPHIES_KEY, (raw) => {
        let list = sanitizeTrophies(null);
        try {
          list = sanitizeTrophies(raw ? JSON.parse(raw) : null);
        } catch {
          // kaputte Liste: neu anfangen
        }
        return JSON.stringify(addTrophy(list, trophy));
      });
      if (row.passId === null) trophyForActive = true;
    }
  }
  passSyncSoon();
  return trophyForActive;
}

/** Welcher Platz sammelt fürs Album? Online der eigene, lokal der erste Platz mit freiem Namen (er gehört dem aktiven Pass), sonst der des aktiven Passes. */
export function albumSeat(seats: readonly SeatConfig[], online?: { yourSeat: number | null }): number | null {
  if (online) return online.yourSeat;
  const humans = seats.map((seat, index) => ({ seat, index })).filter(({ seat }) => seat.kind === 'human');
  const free = humans.find(({ seat }) => !seat.passId);
  if (free) return free.index;
  const active = passBook.activeId();
  return humans.find(({ seat }) => seat.passId === active)?.index ?? null;
}

/** Trägt Funde eines Kapitels ins Album des aktiven Passes ein. */
export function saveFinds(chapter: string, total: number, ids: readonly string[]): void {
  if (ids.length === 0) return;
  passBook.updateStored(null, ALBUM_KEY, (raw) => {
    let album = sanitizeAlbum(null);
    try {
      album = sanitizeAlbum(raw ? JSON.parse(raw) : null);
    } catch {
      // kaputtes Album: neu anfangen
    }
    return JSON.stringify(recordFinds(album, chapter, total, ids, Date.now()));
  });
  passSyncSoon();
}

/** Haken im Spieltisch: zeichnet das Ergebnis genau einmal je Partie auf. */
export function usePassRecorder(options: {
  session: GameSession;
  gameId: string;
  seatScore?: (view: never, seat: number) => number | string | null;
  /** Kapitel des Spiels im Sammelalbum (#148). */
  album?: AlbumSpec<never>;
  online?: { yourSeat: number | null; tournament: boolean; display?: boolean };
}): { trophy: boolean } {
  const { session, gameId, seatScore, album, online } = options;
  const [trophy, setTrophy] = useState(false);
  const started = useRef<{ id: string; at: number }>({ id: session.id, at: Date.now() });
  const done = useRef<string | null>(null);
  if (started.current.id !== session.id) started.current = { id: session.id, at: Date.now() };
  const result = session.result;
  useEffect(() => {
    if (!result || done.current === session.id || online?.display) return;
    done.current = session.id;
    const seats = session.config.seats;
    const view = session.view('spectator') as never;
    const scores = seats.map((_, index) => {
      try {
        return seatScore?.(view, index) ?? null;
      } catch {
        return null;
      }
    });
    const now = Date.now();
    // Lokale Partien: Zugliste für das Anheften in der Chronik merken (online kennt der Browser Seed und Züge nicht, siehe #99).
    try {
      const local = session as unknown as { snapshot?: () => { config: unknown; log: unknown } };
      if (!online && typeof local.snapshot === 'function') {
        const snap = local.snapshot();
        rememberReplay(session.id, { config: snap.config as never, log: snap.log as never });
      }
    } catch {
      // Zugabe, darf nie stören
    }
    try {
      const saved = saveRows(rowsFor({ gameId, sessionId: session.id, result, seats, endedAt: now, durationMs: now - started.current.at, scores, ...(online ? { online: { yourSeat: online.yourSeat, tournament: online.tournament } } : {}) }), seats);
      if (saved) setTrophy(true);
    } catch {
      // Das Partiebuch ist eine Zugabe und darf nie den Tisch stören.
    }
  }, [result, session, gameId, seatScore, online]);
  useEffect(() => {
    if (!result) setTrophy(false);
  }, [result]);
  // Sammelalbum (#148): Funde nach jeder Änderung (und einmal beim Öffnen des Tisches).
  const wantsAlbum = Boolean(album?.finds) && !online?.display;
  const yourSeat = online?.yourSeat;
  useEffect(() => {
    if (!album?.finds || !wantsAlbum) return;
    const seat = albumSeat(session.config.seats, online ? { yourSeat: yourSeat ?? null } : undefined);
    if (seat === null) return;
    let total: number | null = null;
    const look = (events: readonly import('@brett-und-blatt/engine').GameEvent[]) => {
      try {
        const ids = album.finds!({ view: session.view(seat as never) as never, events, seat, result: session.result });
        if (ids.length === 0) return;
        total ??= album.catalog().length;
        saveFinds(gameId, total, ids);
      } catch {
        // Das Album ist eine Zugabe und darf nie den Tisch stören.
      }
    };
    look([]);
    return session.subscribe((change) => look(change.events));
  }, [session, album, wantsAlbum, gameId, yourSeat, online]);
  return { trophy };
}
