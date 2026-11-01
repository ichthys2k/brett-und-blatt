import type { SeatId } from './types';

/*
 * Baustein Abstimmung: Mehrere Plätze stimmen über eine oder mehrere Fragen gleichzeitig ab
 * (Kategorien-Sprint: Gilt diese Antwort? Wer bin ich?: Ja, Nein oder Vielleicht?).
 * Reines JSON im Spielstand, ohne Zufall. Ein Stimmzettel enthält eine Stimme je Frage
 * oder `null` für Enthaltung. Geheim heißt: Bis alle abgegeben haben, sieht jeder nur,
 * wer schon abgestimmt hat. Ablauf über die Zugzeit: Wer nicht abstimmt, enthält sich
 * (`abstainBallot` als `timeoutMove`).
 */

export interface VoteBox {
  /** Wie viele Fragen gleichzeitig. 0 ist erlaubt: Dann ist der leere Zettel ein „Weiter“. */
  items: number;
  /** Wie viele Antwortmöglichkeiten je Frage, z. B. 2 für Ja/Nein. */
  choices: number;
  /** Wer abstimmen darf. */
  voters: SeatId[];
  /** Je Platz der Tisch-Reihenfolge: Stimmzettel oder null (noch nicht abgegeben). */
  ballots: (Ballot | null)[];
  /** Geheim: fremde Stimmzettel bleiben bis zum Schluss verdeckt. */
  secret: boolean;
  /**
   * Fragen, bei denen ein Platz nicht mitstimmt (z. B. über die eigene Antwort):
   * `excluded[item]` listet die Plätze. Ihre Stimme zu dieser Frage zählt nicht.
   */
  excluded?: SeatId[][];
}

/** Eine Stimme je Frage: Index der Wahl oder null (Enthaltung). */
export type Ballot = (number | null)[];

/** Wie ein Gleichstand ausgeht: eine feste Wahl (z. B. 0 = „gilt“) oder `null` = unentschieden. */
export type TieRule = number | null;

/** Neue, leere Abstimmung. `seats` ist die Zahl der Plätze am Tisch. */
export function openVote(seats: number, voters: readonly SeatId[], options: { items?: number; choices?: number; secret?: boolean; excluded?: SeatId[][] } = {}): VoteBox {
  const items = Math.max(0, options.items ?? 1);
  return {
    items,
    choices: Math.max(2, options.choices ?? 2),
    voters: [...voters],
    ballots: Array.from({ length: seats }, () => null),
    secret: options.secret ?? true,
    ...(options.excluded ? { excluded: options.excluded.map((list) => [...list]) } : {}),
  };
}

/** Ist dieser Stimmzettel von diesem Platz gültig? */
export function isValidBallot(box: VoteBox, seat: SeatId, ballot: unknown): ballot is Ballot {
  if (!box.voters.includes(seat) || box.ballots[seat] !== null) return false;
  if (!Array.isArray(ballot) || ballot.length !== box.items) return false;
  return ballot.every((choice) => choice === null || (Number.isInteger(choice) && choice >= 0 && choice < box.choices));
}

/** Gibt einen Stimmzettel ab (wirft bei ungültigem). Liefert eine neue Abstimmung. */
export function castBallot(box: VoteBox, seat: SeatId, ballot: Ballot): VoteBox {
  if (!isValidBallot(box, seat, ballot)) throw new Error('Ungültiger Stimmzettel.');
  const cleaned = ballot.map((choice, item) => (box.excluded?.[item]?.includes(seat) ? null : choice));
  return { ...box, ballots: box.ballots.map((b, i) => (i === seat ? cleaned : b)) };
}

/** Enthaltung bei allen Fragen – Standard bei Zeitablauf. */
export function abstainBallot(box: VoteBox): Ballot {
  return Array.from({ length: box.items }, () => null);
}

/** Wer noch abstimmen muss. */
export function pendingVoters(box: VoteBox): SeatId[] {
  return box.voters.filter((seat) => box.ballots[seat] === null);
}

export function voteComplete(box: VoteBox): boolean {
  return pendingVoters(box).length === 0;
}

/** Stimmen je Wahl für eine Frage. */
export function tally(box: VoteBox, item = 0): number[] {
  const counts = Array.from({ length: box.choices }, () => 0);
  for (const seat of box.voters) {
    const choice = box.ballots[seat]?.[item];
    if (choice !== null && choice !== undefined && !box.excluded?.[item]?.includes(seat)) counts[choice]!++;
  }
  return counts;
}

/**
 * Ergebnis einer Frage: die Wahl mit den meisten Stimmen. Bei Gleichstand (auch wenn
 * niemand abgestimmt hat) gilt `tie`.
 */
export function voteWinner(box: VoteBox, item = 0, tie: TieRule = null): number | null {
  const counts = tally(box, item);
  const best = Math.max(...counts);
  const leaders = counts.flatMap((count, choice) => (count === best ? [choice] : []));
  return leaders.length === 1 && best > 0 ? leaders[0]! : tie;
}

/**
 * Was ein Platz von der Abstimmung sehen darf: bei geheimer Abstimmung vor dem Ende nur
 * den eigenen Stimmzettel; von den anderen nur, dass sie abgegeben haben (leerer Zettel).
 */
export function voteView(box: VoteBox, viewer: SeatId | 'spectator'): VoteBox {
  if (!box.secret || voteComplete(box)) return box;
  return {
    ...box,
    ballots: box.ballots.map((ballot, seat) => (ballot === null || seat === viewer ? ballot : abstainBallot(box))),
  };
}
