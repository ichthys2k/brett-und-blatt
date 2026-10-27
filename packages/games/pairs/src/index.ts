import { generalBots, type BotDefinition, type BotLevel, type GameModule } from '@brett-und-blatt/engine';
import { faceOf, PAIR_SETS } from './content';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, sampleHidden, setup, type Face, type PairsMove, type PairsState } from './rules';

export type { CardStatus, Face, PairsMove, PairsState } from './rules';
export { faceOf, PAIR_SETS };

/**
 * Gedächtnis je Stufe: Wie viele Aufdeck-Schritte zurück sich der Bot erinnert
 * und wie zuverlässig. Ein perfektes Gedächtnis wäre unschlagbar.
 */
const MEMORY: Record<BotLevel, { span: number; reliability: number }> = {
  easy: { span: 4, reliability: 0.75 },
  medium: { span: 14, reliability: 0.9 },
  hard: { span: 1000, reliability: 0.97 },
};

/**
 * Der Bot nutzt nur das öffentliche Protokoll (was alle gesehen haben) und
 * „vergisst“ ältere Karten – je nach Stufe schneller oder langsamer.
 */
const pairsBot: BotDefinition<PairsState, PairsMove> = {
  id: 'pairs',
  name: 'Gedächtnis',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const view = ctx.view;
    const legal = legalMoves(view, ctx.seat).map((m) => m.card);
    const memory = MEMORY[ctx.level];

    // Was weiß der Bot noch? Je Karte der jüngste Eintrag im Protokoll.
    const lastSeen = new Map<number, { face: Face; step: number }>();
    for (const entry of view.log) lastSeen.set(entry.card, { face: entry.face, step: entry.step });
    const remembered = new Map<number, Face>();
    for (const [card, seen] of lastSeen) {
      if (!legal.includes(card)) continue;
      if (view.step - seen.step <= memory.span && ctx.rng.chance(memory.reliability)) remembered.set(card, seen.face);
    }
    const unseen = legal.filter((card) => !lastSeen.has(card));
    const flip = (card: number): PairsMove => ({ type: 'flip', card });

    const first = view.open.length === 1 ? view.open[0] : undefined;
    if (first !== undefined) {
      const face = view.faces[first];
      const partner = [...remembered].find(([card, f]) => card !== first && face && f.pair === face.pair);
      if (partner) return flip(partner[0]);
      const fresh = unseen.filter((card) => card !== first);
      return flip(ctx.rng.pick(fresh.length > 0 ? fresh : legal.filter((card) => card !== first)));
    }

    // Erste Karte: ein bekanntes Paar aufdecken, sonst eine noch unbekannte Karte.
    const byPair = new Map<number, number[]>();
    for (const [card, f] of remembered) byPair.set(f.pair, [...(byPair.get(f.pair) ?? []), card]);
    const known = [...byPair.values()].find((cards) => cards.length >= 2);
    if (known) return flip(known[0]!);
    return flip(ctx.rng.pick(unseen.length > 0 ? unseen : legal));
  },
};

export const gameModule: GameModule<PairsState, PairsMove> = {
  info: meta,
  options: [
    {
      id: 'set',
      label: 'Kartenset',
      choices: Object.values(PAIR_SETS).map((set) => ({ value: set.id, label: set.name })),
      default: 'tiere',
    },
    {
      id: 'size',
      label: 'Anzahl Karten',
      choices: ['12', '16', '20', '24', '30', '36'].map((value) => ({ value, label: value })),
      default: '16',
    },
    {
      id: 'continueOnPair',
      label: 'Nach einem Paar',
      choices: [
        { value: 'on', label: 'Nochmal dran' },
        { value: 'off', label: 'Nächster ist dran' },
      ],
      default: 'on',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 10_000 },
    fast: { kind: 'perMove', moveMs: 5_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [pairsBot, ...generalBots<PairsState, PairsMove, PairsState>()],
};
