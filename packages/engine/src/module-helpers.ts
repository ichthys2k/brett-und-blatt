import { sameValue } from './canonical';
import type { Actor, AnyGameModule, Options, OptionSpec, Result, SeatId } from './types';

/** Die Voreinstellungen aller Optionen, ergänzt um die übergebenen Werte. */
export function resolveOptions(module: AnyGameModule, options: Options = {}): Options {
  const resolved: Options = {};
  for (const spec of module.options) {
    const value = options[spec.id];
    resolved[spec.id] = value !== undefined && (spec.choices.some((c) => c.value === value) || matchesPattern(spec, value)) ? value : spec.default;
  }
  return resolved;
}

function matchesPattern(spec: OptionSpec, value: string): boolean {
  return spec.pattern !== undefined && typeof value === 'string' && value.length <= 256 && new RegExp(`^(?:${spec.pattern})$`).test(value);
}

export function seatActors(actors: Actor[]): SeatId[] {
  return actors.filter((a): a is SeatId => a !== 'system');
}

export function isLegalMove<S, M>(module: { legalMoves(s: S, a: Actor): M[]; isLegal?(s: S, a: Actor, m: M): boolean }, state: S, actor: Actor, move: M): boolean {
  if (module.isLegal) return module.isLegal(state, actor, move);
  return module.legalMoves(state, actor).some((m) => sameValue(m, move));
}

/**
 * Führt anstehende Systemzüge aus (z. B. Würfeln). Die Spielleitung nimmt
 * jeweils den ersten erlaubten Systemzug – Zufall steckt im Spielstand.
 */
export function settleSystemMoves<S, M>(
  module: { currentPlayers(s: S): Actor[]; legalMoves(s: S, a: Actor): M[]; applyMove(s: S, a: Actor, m: M): { state: S }; result(s: S): Result | null },
  state: S,
  onMove?: (move: M, next: S) => void,
): S {
  let current = state;
  for (let guard = 0; guard < 10_000; guard++) {
    if (module.result(current) || !module.currentPlayers(current).includes('system')) return current;
    const move = module.legalMoves(current, 'system')[0];
    if (move === undefined) throw new Error('Die Spielleitung ist am Zug, hat aber keinen Systemzug.');
    current = module.applyMove(current, 'system', move).state;
    onMove?.(move, current);
  }
  throw new Error('Zu viele Systemzüge hintereinander.');
}

/** Rechnet einen Spielstand aus Startwert und Zugliste neu aus. */
export function replay<S, M>(
  module: AnyGameModule,
  seats: number,
  options: Options,
  seed: string,
  entries: { actor: Actor; move: M }[],
): S {
  let state = module.setup(seats, resolveOptions(module, options), seed) as S;
  for (const entry of entries) {
    state = module.applyMove(state, entry.actor, entry.move).state as S;
  }
  return state;
}
