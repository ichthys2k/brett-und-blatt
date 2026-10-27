import type { SeatId } from '@brett-und-blatt/engine';

export interface Pot {
  amount: number;
  /** Plätze, die um diesen Pot spielen dürfen (nicht gepasst). */
  eligible: SeatId[];
}

export interface PotAward {
  potIndex: number;
  amount: number;
  winners: SeatId[];
}

/**
 * Zerlegt die gesamten Einsätze einer Hand (`committed`) in Hauptpot und Side-Pots.
 * Jeder gesetzte Chip landet in genau einem Pot (`sum(pots) === sum(committed)`).
 */
export function buildPots(committed: readonly number[], eligibleMask: readonly boolean[]): Pot[] {
  const total = committed.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const eligibleSeats = committed
    .map((_, seat) => seat)
    .filter((seat) => eligibleMask[seat] && (committed[seat] ?? 0) > 0);

  if (eligibleSeats.length <= 1) {
    const fallback = eligibleSeats.length === 1 ? eligibleSeats : committed.map((_, s) => s).filter((s) => eligibleMask[s]);
    return [{ amount: total, eligible: fallback }];
  }

  const levels = [...new Set(eligibleSeats.map((s) => committed[s]!))].sort((a, b) => a - b);
  const maxCommitted = Math.max(...committed);
  const pots: Pot[] = [];
  let prev = 0;

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    // Beim höchsten Level auch eventuelle Überhänge gepasster Spieler einsammeln.
    const cap = i === levels.length - 1 ? Math.max(level, maxCommitted) : level;
    let sliceAmount = 0;
    for (let s = 0; s < committed.length; s++) {
      const c = committed[s] ?? 0;
      if (c > prev) sliceAmount += Math.min(c, cap) - prev;
    }
    const eligible = eligibleSeats.filter((s) => (committed[s] ?? 0) >= level);
    if (sliceAmount > 0 && eligible.length > 0) {
      const last = pots.at(-1);
      if (last && sameSeats(last.eligible, eligible)) {
        last.amount += sliceAmount;
      } else {
        pots.push({ amount: sliceAmount, eligible });
      }
    }
    prev = cap;
  }

  return pots;
}

function sameSeats(a: readonly SeatId[], b: readonly SeatId[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/**
 * Verteilt alle Pots anhand der Handwerte (`handValues`).
 * Untentschiedene Pots werden geteilt; überzählige Einzelchips gehen im Uhrzeigersinn
 * an die ersten Gewinner links vom Dealer (`button`).
 */
export function settlePots(
  pots: readonly Pot[],
  handValues: readonly (number | null)[],
  button: SeatId,
  seatCount: number,
): { winnings: number[]; awards: PotAward[] } {
  const winnings = Array.from({ length: seatCount }, () => 0);
  const awards: PotAward[] = [];

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i]!;
    if (pot.amount <= 0 || pot.eligible.length === 0) continue;

    let best = -1;
    let winners: SeatId[] = [];
    for (const seat of pot.eligible) {
      const val = handValues[seat] ?? -1;
      if (val > best) {
        best = val;
        winners = [seat];
      } else if (val === best) {
        winners.push(seat);
      }
    }

    if (winners.length === 0) winners = [pot.eligible[0]!];

    // Sortierung ab links vom Dealer-Button für den Rest-Chip.
    const ordered = [...winners].sort(
      (a, b) => ((a - button - 1 + seatCount) % seatCount) - ((b - button - 1 + seatCount) % seatCount),
    );
    const share = Math.floor(pot.amount / ordered.length);
    const rem = pot.amount % ordered.length;
    ordered.forEach((seat, idx) => {
      winnings[seat] = (winnings[seat] ?? 0) + share + (idx < rem ? 1 : 0);
    });
    awards.push({ potIndex: i, amount: pot.amount, winners: ordered });
  }

  return { winnings, awards };
}
