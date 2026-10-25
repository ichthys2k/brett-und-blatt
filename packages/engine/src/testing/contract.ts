import { inlineBotRunner, computeBotMove } from '../bots/runner';
import { canonicalJson, sameValue } from '../canonical';
import { isLegalMove, replay, resolveOptions, settleSystemMoves } from '../module-helpers';
import { Rng } from '../random';
import { LocalSession } from '../session';
import type { Actor, AnyGameModule, Options, SeatId } from '../types';

export interface ContractOptions {
  /** Welche Spielerzahlen geprüft werden (Standard: Minimum und Maximum). */
  seatCounts?: number[];
  /** Zufallspartien insgesamt (verteilt auf Spielerzahlen und Varianten, je Kombination mindestens zwei). */
  randomGames?: number;
  /** Bot-gegen-Bot-Partien je Bot und Stufe. */
  botGames?: number;
  /** Partien, die länger dauern, gelten als Fehler. */
  maxMoves?: number;
  /** Bot-Partien nach so vielen Zügen abbrechen (für Spiele mit langsamen Bots oder sehr langen Partien). */
  botMoveLimit?: number;
  seed?: string;
  /** Eigene Prüfung, dass eine Sicht nichts verrät; gibt eine Fehlermeldung oder null zurück. */
  checkView?: (state: unknown, view: unknown, seat: SeatId) => string | null;
}

export interface ContractCheck {
  name: string;
  run: () => void | Promise<void>;
}

/**
 * Die Prüfungen, die jedes Spielmodul bestehen muss. Verwendung in einem Test:
 *
 *   for (const check of gameContractChecks(gameModule)) test(check.name, check.run);
 */
export function gameContractChecks(module: AnyGameModule, options: ContractOptions = {}): ContractCheck[] {
  const seatCounts = options.seatCounts ?? [...new Set([module.info.players.min, module.info.players.max])];
  const randomGames = options.randomGames ?? 40;
  const botGames = options.botGames ?? 1;
  const maxMoves = options.maxMoves ?? 2_000;
  const seed = options.seed ?? 'vertrag';
  const optionSets = allOptionSets(module);
  // Viele Spielerzahlen und Varianten: dann je Kombination weniger Partien, mindestens aber zwei.
  const combos = seatCounts.length * optionSets.length;
  const gamesPerSetup = Math.max(2, Math.ceil(randomGames / combos));

  const forEachSetup = (fn: (seats: number, opts: Options, label: string) => void) => {
    for (const seats of seatCounts) {
      for (const opts of optionSets) fn(seats, opts, `${seats} Spieler, ${canonicalJson(opts)}`);
    }
  };

  return [
    {
      name: 'Metadaten, Optionen und Zeitvorgaben sind vollständig',
      run() {
        const { info } = module;
        assert(info.id.length > 0 && info.name.length > 0, 'id und name fehlen');
        assert(info.players.min >= 1 && info.players.min <= info.players.max, 'Spielerzahl ungültig');
        assert(module.bots.length > 0, 'Jedes Spiel braucht mindestens einen Bot');
        assert(info.howToPlay.length > 0 && info.howToPlay.every((line) => line.trim().length > 0), 'Jedes Spiel braucht eine kurze Anleitung (howToPlay)');
        for (const spec of module.options) {
          assert(spec.choices.some((c) => c.value === spec.default), `Option ${spec.id}: Standard ist keine Auswahl`);
        }
        for (const preset of ['relaxed', 'normal', 'fast'] as const) {
          assert(module.timePresets[preset] !== undefined, `Zeitvorgabe ${preset} fehlt`);
        }
      },
    },
    {
      name: 'Zufallspartien enden regelgerecht und verändern alte Spielstände nicht',
      run() {
        forEachSetup((seats, opts, label) => {
          for (let g = 0; g < gamesPerSetup; g++) {
            playRandomGame(module, seats, opts, `${seed}/${label}/${g}`, maxMoves, options.checkView);
          }
        });
      },
    },
    {
      name: 'Gleicher Seed und gleiche Züge ergeben denselben Spielstand',
      run() {
        forEachSetup((seats, opts, label) => {
          for (let g = 0; g < Math.min(gamesPerSetup, 3); g++) {
            const gameSeed = `${seed}/wiederholung/${label}/${g}`;
            const { state, log } = playRandomGame(module, seats, opts, gameSeed, maxMoves);
            const again = replay(module, seats, opts, gameSeed, log);
            assert(sameValue(state, again), `${label}: Wiederholung weicht ab`);
            assert(sameValue(module.setup(seats, opts, gameSeed), module.setup(seats, opts, gameSeed)), `${label}: setup ist nicht wiederholbar`);
          }
        });
      },
    },
    {
      name: 'Jeder Bot spielt auf jeder Stufe ganze Partien mit erlaubten Zügen',
      run() {
        // Bots auf den Standardeinstellungen; die Varianten prüfen schon die Zufallspartien.
        const seats = module.info.players.min;
        const opts = resolveOptions(module);
        const label = `${seats} Spieler`;
        for (const bot of module.bots) {
          for (const level of bot.levels) {
            {
              for (let g = 0; g < botGames; g++) {
                const gameSeed = `${seed}/bot/${bot.id}/${level}/${label}/${g}`;
                let state = settleSystemMoves(module, module.setup(seats, opts, gameSeed));
                for (let step = 0; !module.result(state); step++) {
                  if (options.botMoveLimit !== undefined && step >= options.botMoveLimit) break;
                  assert(step < maxMoves, `${bot.id}/${level} ${label}: Partie endet nicht`);
                  const actor = firstSeat(module.currentPlayers(state));
                  assert(actor !== null, `${label}: niemand am Zug`);
                  const move = computeBotMove(module, {
                    gameId: module.info.id,
                    botId: bot.id,
                    level,
                    seat: actor,
                    view: module.playerView(state, actor),
                    seed: `${gameSeed}/${step}`,
                    timeBudgetMs: 10,
                  });
                  assert(isLegalMove(module, state, actor, move), `${bot.id}/${level} ${label}: unerlaubter Zug ${canonicalJson(move)}`);
                  state = settleSystemMoves(module, module.applyMove(state, actor, move).state);
                }
              }
            }
          }
        }
      },
    },
    {
      name: 'Partien mit ständigem Zeitablauf laufen sauber durch',
      async run() {
        const seats = module.info.players.min;
        let time = 0;
        const session = new LocalSession(
          module,
          {
            gameId: module.info.id,
            seats: Array.from({ length: seats }, (_, i) => ({ kind: 'human' as const, name: `Platz ${i + 1}` })),
            options: resolveOptions(module),
            seed: `${seed}/zeitablauf`,
            time: { kind: 'perMove', moveMs: 1_000 },
          },
          { botRunner: inlineBotRunner([module], { timeBudgetMs: 10 }), now: () => time },
        );
        for (let round = 0; !session.result; round++) {
          assert(round < maxMoves * 3, 'Partie mit Zeitablauf endet nicht');
          time += 1_001;
          session.tick();
          await flush();
        }
        session.dispose();
      },
    },
  ];
}

/** Spielt eine Partie mit zufälligen erlaubten Zügen und prüft dabei die Grundregeln der Schnittstelle. */
export function playRandomGame(
  module: AnyGameModule,
  seats: number,
  options: Options,
  seed: string,
  maxMoves = 2_000,
  checkView?: ContractOptions['checkView'],
): { state: unknown; log: { actor: Actor; move: unknown }[] } {
  const rng = Rng.fromSeed(seed, 'testzüge');
  const log: { actor: Actor; move: unknown }[] = [];
  let state = deepFreeze(module.setup(seats, options, seed));
  assertJson(state, 'Spielstand nach setup');

  for (let step = 0; ; step++) {
    assert(step <= maxMoves, `Partie endet nicht nach ${maxMoves} Zügen`);
    if (module.result(state)) break;
    const actors = module.currentPlayers(state);
    assert(actors.length > 0, 'Kein Ergebnis, aber niemand am Zug');
    // Alle Sichten am Anfang und danach reihum je eine – das prüft jede Sicht, ohne jeden Zug zu verteuern.
    const viewSeats = step === 0 ? [...Array(seats).keys()] : [step % seats];
    for (const seat of viewSeats) {
      const view = module.playerView(state, seat);
      assertJson(view, 'Sicht');
      const problem = checkView?.(state, view, seat);
      assert(!problem, problem ?? '');
    }
    const actor = rng.pick(actors);
    const moves = module.legalMoves(state, actor);
    assert(moves.length > 0, `${String(actor)} ist am Zug, hat aber keine erlaubten Züge`);
    const move = actor === 'system' ? moves[0] : rng.pick(moves);
    const next = module.applyMove(state, actor, move);
    assert(Array.isArray(next.events), 'applyMove muss events liefern');
    assertJson(next.state, 'Spielstand');
    log.push({ actor, move });
    state = deepFreeze(next.state);
  }

  const result = module.result(state);
  if (result?.kind === 'win') {
    assert(result.winners.every((w) => Number.isInteger(w) && w >= 0 && w < seats), 'Ungültige Gewinner');
  }
  return { state, log };
}

/** Voreinstellung plus jede andere Auswahl jeder Option einzeln. */
function allOptionSets(module: AnyGameModule): Options[] {
  const defaults = resolveOptions(module);
  const sets: Options[] = [defaults];
  for (const spec of module.options) {
    for (const choice of spec.choices) {
      if (choice.value !== spec.default) sets.push({ ...defaults, [spec.id]: choice.value });
    }
  }
  return sets;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertJson(value: unknown, what: string): void {
  const problem = jsonProblem(value, what);
  assert(problem === null, `${problem} – Spielstände und Sichten müssen reines JSON sein`);
}

/** Findet Werte, die JSON nicht verlustfrei speichert (undefined, Funktionen, Map, Set, Klassen, NaN …). */
function jsonProblem(value: unknown, path: string): string | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} ist ${value}`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const problem = jsonProblem(value[i], `${path}[${i}]`);
      if (problem) return problem;
    }
    return null;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return `${path} ist kein einfaches Objekt`;
    for (const [key, entry] of Object.entries(value)) {
      const problem = jsonProblem(entry, `${path}.${key}`);
      if (problem) return problem;
    }
    return null;
  }
  return `${path} ist ${typeof value}`;
}

/** Friert ein Objekt tief ein: Jeder Versuch, es zu verändern, wirft dann einen Fehler. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function firstSeat(actors: Actor[]): SeatId | null {
  for (const actor of actors) if (actor !== 'system') return actor;
  return null;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
