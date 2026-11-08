import type { GameSession, Result, SeatConfig } from '@brett-und-blatt/engine';
import { useEffect, useRef } from 'react';
import { emptyBook, localMode, outcomeFor, recordGame, sanitizeBook, strongestBot, type Mode, type PlayedGame } from './partiebuch';
import { passBook } from './passes';
import { passSyncSoon } from './playerPass';

/*
 * Der Recorder (Vorhaben #135, Schritt #142): Eine Stelle in der Web-App zeichnet jedes Partieende im Partiebuch des Passes auf –
 * für alle Spiele ohne Arbeit im Spiel. Lokal und im Hot-Seat eine Zeile je beteiligtem Pass, online nur der eigene Platz.
 * Abgebrochene Partien ohne Ergebnis zählen nicht, Aufgeben ist eine Niederlage (das Ergebnis sagt es).
 */

export const BOOK_KEY = 'brett-und-blatt:partiebuch';

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

/** Schreibt die Zeilen ins Partiebuch ihrer Pässe. */
export function saveRows(rows: readonly RecordRow[], seats: readonly SeatConfig[]): void {
  if (rows.length === 0) return;
  const level = strongestBot(seats);
  const device = deviceCounterId();
  for (const row of rows) {
    passBook.updateStored(row.passId, BOOK_KEY, (raw) => {
      let book = emptyBook();
      try {
        book = sanitizeBook(raw ? JSON.parse(raw) : null);
      } catch {
        // kaputtes Buch: neu anfangen
      }
      return JSON.stringify(recordGame(book, row.game, device, level));
    });
  }
  passSyncSoon();
}

/** Haken im Spieltisch: zeichnet das Ergebnis genau einmal je Partie auf. */
export function usePassRecorder(options: {
  session: GameSession;
  gameId: string;
  seatScore?: (view: never, seat: number) => number | string | null;
  online?: { yourSeat: number | null; tournament: boolean; display?: boolean };
}): void {
  const { session, gameId, seatScore, online } = options;
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
    try {
      saveRows(rowsFor({ gameId, sessionId: session.id, result, seats, endedAt: now, durationMs: now - started.current.at, scores, ...(online ? { online: { yourSeat: online.yourSeat, tournament: online.tournament } } : {}) }), seats);
    } catch {
      // Das Partiebuch ist eine Zugabe und darf nie den Tisch stören.
    }
  }, [result, session, gameId, seatScore, online]);
}
