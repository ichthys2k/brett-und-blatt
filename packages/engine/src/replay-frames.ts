import { resolveOptions } from './module-helpers';
import type { Actor, AnyGameModule, GameEvent, Options, Result } from './types';

/**
 * Alles, was man zum Nachspielen einer beendeten Partie braucht (#99): Seed, Optionen, Platzzahl
 * und die Zugliste. Der Seed verrät bei Spielen mit Geheimnissen alle verdeckten Karten – darum
 * gibt eine Spielleitung diese Daten erst heraus, wenn die Partie zu Ende ist.
 */
export interface ReplayData {
  seed: string;
  options: Options;
  /** Platzzahl beim Start (`SessionConfig.initialSeats` bzw. Zahl der Plätze). */
  seats: number;
  log: { actor: Actor; move: unknown }[];
}

/** Längere Partien (Echtzeitspiele mit tausenden Systemzügen) werden nicht nachgespielt: zu viel Speicher und Datenverkehr. */
export const REPLAY_MAX_STEPS = 3000;

/** Ein Schritt der Partie: der Zustand nach dem n-ten Zug und die Ereignisse dieses Zuges. */
export interface ReplayFrame<S = unknown> {
  state: S;
  events: GameEvent[];
}

/**
 * Rechnet eine Partie Zug für Zug nach. `frames[0]` ist der Anfang (ohne Ereignisse),
 * `frames[n]` der Stand nach dem n-ten Zug.
 */
export function replayFrames<S>(module: AnyGameModule, data: ReplayData): ReplayFrame<S>[] {
  let state = module.setup(data.seats, resolveOptions(module, data.options), data.seed) as S;
  const frames: ReplayFrame<S>[] = [{ state, events: [] }];
  for (const entry of data.log) {
    const step = module.applyMove(state, entry.actor, entry.move);
    state = step.state as S;
    frames.push({ state, events: step.events });
  }
  return frames;
}

/** Zugnummern, nach denen eine Zeitleiste kleine Marken setzen darf: Züge von Menschen oder Bots (nicht des Systems). */
export function replayPlayerSteps(data: ReplayData): number[] {
  const steps: number[] = [];
  data.log.forEach((entry, index) => {
    if (entry.actor !== 'system') steps.push(index + 1);
  });
  return steps;
}

export function replayResult(module: AnyGameModule, frames: ReplayFrame[]): Result | null {
  const last = frames[frames.length - 1];
  return last ? module.result(last.state) : null;
}
