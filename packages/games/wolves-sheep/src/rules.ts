import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/** Einsteigermischung des Grundspiels; weitere Rollen folgen in späteren Schritten (siehe docs/spiele/woelfe-im-schafspelz.md). */
export type Role = 'wolf' | 'examiner' | 'sheep';

export type Phase = 'night' | 'debate' | 'vote' | 'done';

export interface Examination {
  night: number;
  target: SeatId;
  role: Role;
}

export interface VoteRecord {
  day: number;
  /** Stimme je Platz; null, wenn der Platz nicht (mehr) abgestimmt hat. */
  votes: (SeatId | null)[];
  /** Wer ausscheidet; null bei Gleichstand oder ohne Stimmen. */
  out: SeatId | null;
}

export interface Departure {
  seat: SeatId;
  role: Role;
  cause: 'wolves' | 'council' | 'left';
  day: number;
}

export interface WolvesSheepState {
  seats: number;
  /** Alle Karten dieser Partie, für alle sichtbar: Die Mischung ist kein Geheimnis. */
  deck: Role[];
  /** Rolle je Platz; in der Sicht null, wo sie unbekannt ist. */
  roles: (Role | null)[];
  alive: boolean[];
  phase: Phase;
  /** Zählt ab 1; eine Nacht und der folgende Tag haben dieselbe Nummer. */
  day: number;
  /** Nachtwahl je Platz; in der Sicht nur die eigene, für Wölfe auch die der anderen Wölfe. */
  picks: (SeatId | null)[];
  /** Wer die Nachtwahl bestätigt hat; in der Sicht nur der eigene Eintrag. */
  confirmed: boolean[];
  /** Stimmen der laufenden Abstimmung; in der Sicht nur die eigene. */
  votes: (SeatId | null)[];
  /** Wer abgestimmt hat, auch bei einer Enthaltung nach Zeitablauf; in der Sicht nur der eigene Eintrag. */
  voted: boolean[];
  /** Ergebnisse des Prüfers; in der Sicht nur für den Prüfer. */
  examinations: Examination[];
  /** Abgeschlossene Abstimmungen: Am Tisch zeigen alle offen, deshalb öffentlich. */
  history: VoteRecord[];
  departures: Departure[];
  /** Beratungszeit in Sekunden; 0 heißt: bis zum Knopf. */
  debateSeconds: number;
  winner: 'flock' | 'wolves' | 'none' | null;
  rng: RngState;
}

export type WolvesSheepMove =
  /** Vorläufige Nachtwahl; darf bis zur Bestätigung geändert werden. */
  | { type: 'tap'; target: SeatId }
  /** Bestätigt die Nachtwahl; `target` nur bei Zeitablauf ohne Wahl. */
  | { type: 'confirm'; target?: SeatId }
  | { type: 'endDebate' }
  /** `target` null ist eine Enthaltung und kommt nur durch Zeitablauf zustande. */
  | { type: 'vote'; target: SeatId | null }
  /** Aufgeben: Der Platz deckt auf und scheidet aus. */
  | { type: 'leave' };

/** Zahl der Wölfe nach der Tabelle im Regelheft. */
export function wolfCount(seats: number): number {
  if (seats >= 18) return 4;
  if (seats >= 12) return 3;
  return 2;
}

export function buildDeck(seats: number): Role[] {
  const wolves = wolfCount(seats);
  return [...Array<Role>(wolves).fill('wolf'), 'examiner', ...Array<Role>(seats - wolves - 1).fill('sheep')];
}

export function setup(seats: number, options: Options, seed: string): WolvesSheepState {
  const rng = Rng.fromSeed(seed, 'rollen');
  const deck = buildDeck(seats);
  const roles = rng.shuffle([...deck]);
  return {
    seats,
    deck,
    roles,
    alive: Array<boolean>(seats).fill(true),
    phase: 'night',
    day: 1,
    picks: Array<SeatId | null>(seats).fill(null),
    confirmed: Array<boolean>(seats).fill(false),
    votes: Array<SeatId | null>(seats).fill(null),
    voted: Array<boolean>(seats).fill(false),
    examinations: [],
    history: [],
    departures: [],
    debateSeconds: Number(options.debate ?? '180'),
    winner: null,
    rng: rng.state,
  };
}

/** Plätze, die noch im Spiel sind. */
export function livingSeats(state: WolvesSheepState): SeatId[] {
  return state.alive.flatMap((alive, seat) => (alive ? [seat] : []));
}

/** Wer die Beratung beenden darf: der erste Lebende. */
export function speakerOf(state: WolvesSheepState): SeatId | null {
  return livingSeats(state)[0] ?? null;
}

export function currentPlayers(state: WolvesSheepState): Actor[] {
  switch (state.phase) {
    case 'done':
      return [];
    // Nachts handeln alle Lebenden: Dürften nur Rollenträger ziehen, verriete die Liste sie.
    case 'night':
      return livingSeats(state).filter((seat) => !state.confirmed[seat]);
    case 'vote':
      return livingSeats(state).filter((seat) => !state.voted[seat]);
    case 'debate': {
      const speaker = speakerOf(state);
      const actors: Actor[] = speaker === null ? [] : [speaker];
      return state.debateSeconds > 0 ? [...actors, 'system'] : actors;
    }
  }
}

/** Wartezeit bis zum Ende der Beratung (`systemDelayMs`). */
export function systemDelayMs(state: WolvesSheepState): number {
  return state.phase === 'debate' ? state.debateSeconds * 1000 : 0;
}

/** Wen ein Platz nachts wählen darf: Wölfe kein Rudelmitglied, niemand sich selbst. */
export function nightTargets(state: WolvesSheepState, seat: SeatId): SeatId[] {
  const isWolf = state.roles[seat] === 'wolf';
  return livingSeats(state).filter((target) => target !== seat && !(isWolf && state.roles[target] === 'wolf'));
}

export function legalMoves(state: WolvesSheepState, actor: Actor): WolvesSheepMove[] {
  if (actor === 'system') return state.phase === 'debate' && state.debateSeconds > 0 ? [{ type: 'endDebate' }] : [];
  if (!state.alive[actor]) return [];
  switch (state.phase) {
    case 'night':
      if (state.confirmed[actor]) return [];
      // Umentscheiden erlaubt `isLegal`; hier genügt die Bestätigung, damit Zufallspartien vorankommen.
      if (state.picks[actor] !== null) return [{ type: 'confirm' }];
      return nightTargets(state, actor).map((target) => ({ type: 'tap', target }));
    case 'debate':
      return speakerOf(state) === actor ? [{ type: 'endDebate' }] : [];
    case 'vote':
      if (state.voted[actor]) return [];
      return livingSeats(state).filter((target) => target !== actor).map((target) => ({ type: 'vote', target }));
    case 'done':
      return [];
  }
}

export function isLegal(state: WolvesSheepState, actor: Actor, move: WolvesSheepMove): boolean {
  if (move.type === 'leave') return actor !== 'system' && state.phase !== 'done' && state.alive[actor] === true;
  if (actor === 'system') return move.type === 'endDebate' && legalMoves(state, actor).length > 0;
  if (!state.alive[actor]) return false;
  switch (move.type) {
    case 'tap':
      return state.phase === 'night' && !state.confirmed[actor] && nightTargets(state, actor).includes(move.target);
    case 'confirm':
      if (state.phase !== 'night' || state.confirmed[actor]) return false;
      if (move.target !== undefined) return nightTargets(state, actor).includes(move.target);
      return state.picks[actor] !== null;
    case 'endDebate':
      return state.phase === 'debate' && speakerOf(state) === actor;
    case 'vote':
      if (state.phase !== 'vote' || state.voted[actor]) return false;
      return move.target === null || (move.target !== actor && state.alive[move.target] === true);
  }
}

/** Bei Zeitablauf: nachts die vorläufige Wahl oder eine zufällige, im Rat eine Enthaltung, die Beratung endet. */
export function timeoutMove(state: WolvesSheepState, seat: SeatId): WolvesSheepMove {
  if (state.phase === 'vote') return { type: 'vote', target: null };
  if (state.phase === 'debate') return { type: 'endDebate' };
  if (state.picks[seat] !== null) return { type: 'confirm' };
  return { type: 'confirm', target: new Rng(state.rng).pick(nightTargets(state, seat)) };
}

/** Aufgeben kostet nur diesen Platz; die Herde spielt weiter. */
export function resignMove(state: WolvesSheepState, seat: SeatId): WolvesSheepMove | null {
  return state.phase !== 'done' && state.alive[seat] ? { type: 'leave' } : null;
}

/** Nimmt einen Platz aus dem Spiel und deckt seine Karte auf. */
function depart(state: WolvesSheepState, seat: SeatId, cause: Departure['cause'], events: GameEvent[]): WolvesSheepState {
  const role = state.roles[seat]!;
  const alive = state.alive.slice();
  alive[seat] = false;
  events.push({ type: 'departed', seat, role, cause });
  return { ...state, alive, departures: [...state.departures, { seat, role, cause, day: state.day }] };
}

/** Prüft nach jedem Ausscheiden, ob eine Seite gewonnen hat. */
function checkWinner(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const living = livingSeats(state);
  const wolves = living.filter((seat) => state.roles[seat] === 'wolf').length;
  let winner: WolvesSheepState['winner'] = null;
  if (living.length === 0) winner = 'none';
  else if (wolves === 0) winner = 'flock';
  else if (wolves === living.length) winner = 'wolves';
  if (winner === null) return state;
  events.push({ type: 'gameOver', winner });
  return { ...state, winner, phase: 'done' };
}

function startNight(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  events.push({ type: 'nightFell', day: state.day + 1 });
  return {
    ...state,
    phase: 'night',
    day: state.day + 1,
    picks: Array<SeatId | null>(state.seats).fill(null),
    confirmed: Array<boolean>(state.seats).fill(false),
  };
}

/** Das Opfer der Wölfe: Mehrheit ihrer Wahl, bei Gleichstand das Los. */
function resolveNight(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const rng = new Rng(state.rng);
  const counts = new Map<SeatId, number>();
  for (const seat of livingSeats(state)) {
    const pick = state.picks[seat];
    if (state.roles[seat] === 'wolf' && pick !== null && pick !== undefined) counts.set(pick, (counts.get(pick) ?? 0) + 1);
  }
  const most = Math.max(0, ...counts.values());
  const leaders = [...counts.keys()].filter((seat) => counts.get(seat) === most);
  let next: WolvesSheepState = state;
  if (leaders.length > 0) next = depart({ ...next, rng: rng.state }, rng.pick(leaders), 'wolves', events);
  next = { ...next, rng: rng.state };
  next = checkWinner(next, events);
  if (next.winner !== null) return next;
  events.push({ type: 'morning', day: next.day });
  return { ...next, phase: 'debate' };
}

/** Wer die meisten Stimmen hat, scheidet aus; bei Gleichstand niemand. */
function resolveVote(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const counts = new Map<SeatId, number>();
  for (const vote of state.votes) if (vote !== null) counts.set(vote, (counts.get(vote) ?? 0) + 1);
  const most = Math.max(0, ...counts.values());
  const leaders = [...counts.keys()].filter((seat) => counts.get(seat) === most);
  const out = leaders.length === 1 ? leaders[0]! : null;
  events.push({ type: 'voteResult', out, tie: out === null });
  let next: WolvesSheepState = {
    ...state,
    history: [...state.history, { day: state.day, votes: state.votes, out }],
    votes: Array<SeatId | null>(state.seats).fill(null),
    voted: Array<boolean>(state.seats).fill(false),
  };
  if (out !== null) next = checkWinner(depart(next, out, 'council', events), events);
  return next.winner !== null ? next : startNight(next, events);
}

/** Ist die laufende Runde komplett, wenn niemand mehr aussteht? */
function settle(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  if (state.phase === 'night' && livingSeats(state).every((seat) => state.confirmed[seat])) return resolveNight(state, events);
  if (state.phase === 'vote' && livingSeats(state).every((seat) => state.voted[seat])) return resolveVote(state, events);
  return state;
}

export function applyMove(state: WolvesSheepState, actor: Actor, move: WolvesSheepMove): MoveResult<WolvesSheepState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const events: GameEvent[] = [];
  switch (move.type) {
    case 'tap': {
      const seat = actor as SeatId;
      const picks = state.picks.slice();
      picks[seat] = move.target;
      return { state: { ...state, picks }, events };
    }
    case 'confirm': {
      const seat = actor as SeatId;
      const picks = state.picks.slice();
      if (move.target !== undefined) picks[seat] = move.target;
      const confirmed = state.confirmed.slice();
      confirmed[seat] = true;
      const target = picks[seat]!;
      // Der Prüfer erfährt das Ergebnis sofort, nicht erst am Morgen.
      const examinations = state.roles[seat] === 'examiner' ? [...state.examinations, { night: state.day, target, role: state.roles[target]! }] : state.examinations;
      return { state: settle({ ...state, picks, confirmed, examinations }, events), events };
    }
    case 'endDebate':
      events.push({ type: 'councilOpened' });
      return { state: { ...state, phase: 'vote' }, events };
    case 'vote': {
      const seat = actor as SeatId;
      const votes = state.votes.slice();
      votes[seat] = move.target;
      const voted = state.voted.slice();
      voted[seat] = true;
      return { state: settle({ ...state, votes, voted }, events), events };
    }
    case 'leave': {
      const seat = actor as SeatId;
      // Stimmen und Wahl auf den Gehenden verfallen, sonst fielen sie auf einen Abwesenden.
      const clear = (list: (SeatId | null)[]) => list.map((entry, i) => (i === seat || entry === seat ? null : entry));
      const picks = clear(state.picks);
      const votes = clear(state.votes);
      const voted = state.voted.map((done, i) => done && state.votes[i] !== seat);
      const confirmed = state.confirmed.map((done, i) => done && !(state.roles[i] === 'wolf' && state.picks[i] === seat));
      const next = checkWinner(depart({ ...state, picks, votes, voted, confirmed }, seat, 'left', events), events);
      return { state: next.winner !== null ? next : settle(next, events), events };
    }
  }
}

export function result(state: WolvesSheepState): Result | null {
  if (state.winner === null) return null;
  if (state.winner === 'none') return { kind: 'draw', reason: 'Niemand ist mehr übrig.' };
  const winners = state.roles.flatMap((role, seat) => ((role === 'wolf') === (state.winner === 'wolves') ? [seat] : []));
  return { kind: 'win', winners, reason: state.winner === 'wolves' ? 'Die Wölfe haben die Herde zerstreut.' : 'Alle Wölfe sind entdeckt.' };
}

/**
 * Jeder sieht die eigene Rolle und alle aufgedeckten Karten, Wölfe zusätzlich einander.
 * Ausgeschiedene sehen alles, müssen aber schweigen – wie im Original. Zuschauer (die Tafel)
 * sehen nur Öffentliches.
 */
export function playerView(state: WolvesSheepState, seat: SeatId | 'spectator'): WolvesSheepState {
  const finished = state.phase === 'done';
  const allKnowing = finished || (seat !== 'spectator' && !state.alive[seat]);
  if (allKnowing) return { ...state, rng: [0, 0, 0, 0] };

  const isWolf = seat !== 'spectator' && state.roles[seat] === 'wolf';
  const shownRole = (other: SeatId): boolean => other === seat || !state.alive[other] || (isWolf && state.roles[other] === 'wolf');
  const own = <T,>(list: T[], empty: T): T[] => list.map((entry, i) => (i === seat ? entry : empty));
  return {
    ...state,
    roles: state.roles.map((role, other) => (shownRole(other) ? role : null)),
    picks: state.picks.map((pick, other) => (other === seat || (isWolf && state.roles[other] === 'wolf') ? pick : null)),
    confirmed: own(state.confirmed, false),
    votes: own(state.votes, null),
    voted: own(state.voted, false),
    examinations: seat !== 'spectator' && state.roles[seat] === 'examiner' ? state.examinations : [],
    rng: [0, 0, 0, 0],
  };
}

/** Verteilt die unbekannten Rollen passend zu dem, was der Platz weiß. */
export function sampleHidden(view: WolvesSheepState, _seat: SeatId, rng: Rng): WolvesSheepState {
  const roles = view.roles.slice();
  for (const { target, role } of view.examinations) roles[target] = role;
  const open = view.deck.slice();
  for (const role of roles) {
    if (role === null) continue;
    const index = open.indexOf(role);
    if (index >= 0) open.splice(index, 1);
  }
  const rest = rng.shuffle(open);
  return { ...view, roles: roles.map((role) => role ?? rest.pop()!), rng: rng.state };
}
