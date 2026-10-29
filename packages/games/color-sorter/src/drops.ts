import { DECKS, STAKES } from './content';
import { FINAL_LEVEL } from './rules';
import type { SorterState } from './types';

/**
 * Glöckchen 🔔 (intern „drops“, früher Farbtropfen) – die Meta-Währung über alle Läufe. Es gibt sie nur fürs Spielen: je geschafftes
 * Level, für gewonnene Läufe und Duelle und einmalig für Herausforderungen. Kein Tagesbonus,
 * keine Serien, nie für echtes Geld.
 */

export interface DropLine {
  label: string;
  amount: number;
  /** Einmalige Herausforderung: Kennung, damit sie nur einmal zählt. */
  once?: string;
}

export const DROPS_PER_LEVEL = 2;
export const DROPS_FOR_WIN = 5;
export const DROPS_PER_DUEL = 1;

export interface Challenge {
  id: string;
  label: string;
  amount: number;
}

/** Alle einmaligen Herausforderungen (für das Album). */
export const CHALLENGES: Challenge[] = [
  ...DECKS.map((d) => ({
    id: `deck:${d.key}`,
    label: `Erster Sieg mit dem ${d.name}`,
    amount: 3,
  })),
  ...STAKES.map((s, i) => ({
    id: `stake:${i + 1}`,
    label: `Erster Sieg als ${s.emoji} ${s.name}`,
    amount: 3,
  })),
  {
    id: 'noDiscard',
    label: 'Ein Spiel gewinnen, ohne zu tauschen',
    amount: 5,
  },
  {
    id: 'fewMods',
    label: 'Ein Spiel mit höchstens 2 Narren gewinnen',
    amount: 5,
  },
  {
    id: 'bigHand',
    label: 'Eine Vorführung mit 100.000 Applaus oder mehr',
    amount: 3,
  },
  { id: 'endless12', label: 'Im Endlos-Modus Hoftag 12 erreichen', amount: 5 },
  { id: 'duel', label: 'Den ersten Wettstreit gewinnen', amount: 2 },
  { id: 'table', label: 'Eine Partie zu mehreren gewinnen', amount: 3 },
];
const CHALLENGE_BY_ID: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

/** Hat dieser Platz die Partie gewonnen? */
export function seatWon(state: SorterState, seat: number): boolean {
  return !!state.winners?.includes(seat);
}

/** Farbtropfen für einen Platz am Ende der Partie. `done` sind schon erledigte Herausforderungen. */
export function runDrops(state: SorterState, seat: number, done: ReadonlySet<string>): DropLine[] {
  const run = state.runs[seat];
  if (!run || !state.winners) return [];
  const lines: DropLine[] = [];
  const levels = run.bossesBeaten;
  if (levels > 0)
    lines.push({
      label: `${levels} ${levels === 1 ? 'Hoftag' : 'Hoftage'} geschafft`,
      amount: levels * DROPS_PER_LEVEL,
    });
  const won = seatWon(state, seat);
  if (won)
    lines.push({
      label: state.runs.length > 1 ? 'Partie gewonnen' : 'Spiel gewonnen',
      amount: DROPS_FOR_WIN,
    });
  if (run.duelsWon > 0)
    lines.push({
      label: `${run.duelsWon} ${run.duelsWon === 1 ? 'Wettstreit' : 'Wettstreite'} gewonnen`,
      amount: run.duelsWon * DROPS_PER_DUEL,
    });

  const challenge = (id: string, reached: boolean) => {
    const def = CHALLENGE_BY_ID[id];
    if (def && reached && !done.has(id)) lines.push({ label: def.label, amount: def.amount, once: id });
  };
  // Gewonnen heißt bei den Herausforderungen: Level 8 geschafft (allein) bzw. die Partie gewonnen.
  const cleared = won && (state.runs.length > 1 || run.phase === 'won' || run.level > FINAL_LEVEL);
  challenge(`deck:${state.deckKind}`, cleared);
  challenge(`stake:${state.stake}`, cleared);
  challenge('noDiscard', cleared && run.discardsUsed === 0);
  challenge('fewMods', cleared && run.mods.length <= 2);
  challenge('bigHand', run.bestHand >= 100_000);
  challenge('endless12', state.endless && run.level >= 12);
  challenge('duel', run.duelsWon > 0);
  challenge('table', won && state.runs.length > 1);
  return lines;
}
