import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/** Die Rollen des Grundspiels; der Leithammel ist ein gewähltes Amt, keine Karte. */
export type Role = 'wolf' | 'examiner' | 'sheep' | 'shepherd' | 'hound' | 'binder' | 'lamb' | 'stray';

export type Phase = 'preround' | 'night' | 'dawn' | 'election' | 'debate' | 'vote' | 'pending' | 'done';

/** Wohin es weitergeht, wenn die Warteschlange abgearbeitet ist. */
export type Resume = 'morning' | 'nextNight' | Exclude<Phase, 'pending' | 'done'>;

export interface RolesInPlay {
  shepherd: boolean;
  hound: boolean;
  binder: boolean;
  lamb: boolean;
  stray: boolean;
  leader: boolean;
}

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

export interface ElectionRecord {
  day: number;
  votes: (SeatId | null)[];
  elected: SeatId | null;
}

/**
 * `wolves` steht für alles, was nachts geschieht, auch den Hirtenstab und das erwischte Lamm:
 * Am Morgen wird nur verkündet, wer fehlt, nicht wodurch.
 */
export type DepartureCause = 'wolves' | 'council' | 'hound' | 'grief' | 'left';

export interface Departure {
  seat: SeatId;
  role: Role;
  cause: DepartureCause;
  day: number;
}

/** Was ein Ausgeschiedener noch erledigen muss, bevor es weitergeht. */
export interface PendingAction {
  kind: 'shoot' | 'passBell';
  seat: SeatId;
}

export interface WolvesSheepState {
  seats: number;
  rolesInPlay: RolesInPlay;
  /** Alle Karten dieser Partie, für alle sichtbar: Die Mischung ist kein Geheimnis. */
  deck: Role[];
  /** Rolle je Platz; in der Sicht null, wo sie unbekannt ist. */
  roles: (Role | null)[];
  /** Die zwei übrigen Karten beim Zugelaufenen Schaf; in der Sicht nur für dieses. */
  middle: (Role | null)[];
  /** Wer die übrigen Karten kennt; in der Sicht nur der eigene Eintrag. */
  strayHolder: SeatId | null;
  alive: boolean[];
  phase: Phase;
  /** Zählt ab 1; eine Nacht und der folgende Tag haben dieselbe Nummer. */
  day: number;
  /** Nachtwahl je Platz; in der Sicht nur die eigene, für Wölfe auch die der anderen Wölfe. */
  picks: (SeatId | null)[];
  /** Wer seine Wahl dieser Runde festgelegt hat; in der Sicht nur der eigene Eintrag. */
  locked: boolean[];
  /** Wer mit dieser Runde fertig ist; in der Sicht nur der eigene Eintrag. */
  confirmed: boolean[];
  /** Stimmen der laufenden Wahl oder Abstimmung; in der Sicht nur die eigene. */
  votes: (SeatId | null)[];
  /** Wer abgestimmt hat, auch bei einer Enthaltung nach Zeitablauf; in der Sicht nur der eigene Eintrag. */
  voted: boolean[];
  /** Ergebnisse des Prüfers; in der Sicht nur für den Prüfer. */
  examinations: Examination[];
  /** Die verbundenen zwei; in der Sicht nur für sie (ab der Nacht) und den Bandstifter. */
  bound: [SeatId, SeatId] | null;
  /** Das Opfer dieser Nacht; in der Sicht nur für den Hirten. */
  nightVictim: SeatId | null;
  /** Die Entscheidung des Hirten in dieser Nacht; in der Sicht nur für ihn. */
  shepherdAct: { save: boolean; expel: SeatId | null } | null;
  saveUsed: boolean;
  expelUsed: boolean;
  /** Hat das Lamm in dieser Nacht gelinst? In der Sicht nur für das Lamm. */
  lambPeeked: boolean;
  /** Wurde es erwischt? Das erfährt auch das Lamm erst am Morgen. */
  lambCaught: boolean;
  /** Was das Lamm gesehen hat; in der Sicht nur für das Lamm. */
  lambSights: { night: number; target: SeatId }[];
  leader: SeatId | null;
  /** Steht noch eine Wahl aus? Bei Gleichstand wird am nächsten Morgen neu gewählt. */
  electionOpen: boolean;
  elections: ElectionRecord[];
  /** Abgeschlossene Abstimmungen: Am Tisch zeigen alle offen, deshalb öffentlich. */
  history: VoteRecord[];
  departures: Departure[];
  pending: PendingAction[];
  resume: Resume;
  /** Beratungszeit in Sekunden; 0 heißt: bis zum Knopf. */
  debateSeconds: number;
  winner: 'flock' | 'wolves' | 'pair' | 'none' | null;
  rng: RngState;
}

export type WolvesSheepMove =
  /** Vorläufige Nachtwahl; darf bis zum Festlegen geändert werden. */
  | { type: 'tap'; target: SeatId }
  /** Legt die Nachtwahl fest. Bei Zeitablauf ohne Wahl mit `target`; `finish` schließt die Runde gleich ab. */
  | { type: 'confirm'; target?: SeatId; finish?: boolean }
  /** „Weiter“: Erst danach ist der Platz fertig, so kann jeder sein Ergebnis in Ruhe lesen. */
  | { type: 'done' }
  /** Zugelaufenes Schaf: eine der übrigen Karten nehmen (0 oder 1) oder bei der eigenen bleiben (null). */
  | { type: 'swap'; card: number | null; finish?: boolean }
  /** Bandstifter: zwei Personen verbinden, auch sich selbst. */
  | { type: 'bind'; a: SeatId; b: SeatId; finish?: boolean }
  /** Lamm: einmal je Nacht bei den Wölfen linsen. */
  | { type: 'peek' }
  /** Hirte: Hirtenruf (`save`) und Hirtenstab (`expel`), jeweils einmal je Partie. */
  | { type: 'shepherd'; save: boolean; expel: SeatId | null; finish?: boolean }
  | { type: 'elect'; target: SeatId | null }
  | { type: 'endDebate' }
  /** `target` null ist eine Enthaltung und kommt nur durch Zeitablauf zustande. */
  | { type: 'vote'; target: SeatId | null }
  /** Hütehund: nimmt beim Ausscheiden jemanden mit. */
  | { type: 'shoot'; target: SeatId }
  /** Leithammel: gibt beim Ausscheiden die Glocke weiter. */
  | { type: 'passBell'; target: SeatId }
  /** Aufgeben: Der Platz deckt auf und scheidet aus. */
  | { type: 'leave' };

/** So oft wird das Lamm beim Linsen erwischt: im Original blinzelt es, hier ist es Zufall. */
const LAMB_CAUGHT_CHANCE = 1 / 3;

/** Zahl der Wölfe nach der Tabelle im Regelheft. */
export function wolfCount(seats: number): number {
  if (seats >= 18) return 4;
  if (seats >= 12) return 3;
  return 2;
}

const EMPTY_ROLES: RolesInPlay = { shepherd: false, hound: false, binder: false, lamb: false, stray: false, leader: false };

/** Jede Sonderrolle ersetzt ein Schaf; mit dem Zugelaufenen Schaf kommen zwei Karten dazu. */
export function buildDeck(seats: number, rolesInPlay: RolesInPlay = EMPTY_ROLES): Role[] {
  const specials: Role[] = ['examiner'];
  for (const role of ['shepherd', 'hound', 'binder', 'lamb', 'stray'] as const) if (rolesInPlay[role]) specials.push(role);
  const wolves = wolfCount(seats);
  const total = seats + (rolesInPlay.stray ? 2 : 0);
  return [...Array<Role>(wolves).fill('wolf'), ...specials, ...Array<Role>(total - wolves - specials.length).fill('sheep')];
}

export function setup(seats: number, options: Options, seed: string): WolvesSheepState {
  const rng = Rng.fromSeed(seed, 'rollen');
  const on = (id: keyof RolesInPlay) => options[id] === 'on';
  const rolesInPlay: RolesInPlay = { shepherd: on('shepherd'), hound: on('hound'), binder: on('binder'), lamb: on('lamb'), stray: on('stray'), leader: on('leader') };
  const deck = buildDeck(seats, rolesInPlay);
  const shuffled = rng.shuffle(deck);
  const roles = shuffled.slice(0, seats);
  const holder = roles.indexOf('stray');
  return {
    seats,
    rolesInPlay,
    deck,
    roles,
    middle: shuffled.slice(seats),
    strayHolder: holder >= 0 ? holder : null,
    alive: Array<boolean>(seats).fill(true),
    phase: rolesInPlay.stray || rolesInPlay.binder ? 'preround' : 'night',
    day: 1,
    picks: Array<SeatId | null>(seats).fill(null),
    locked: Array<boolean>(seats).fill(false),
    confirmed: Array<boolean>(seats).fill(false),
    votes: Array<SeatId | null>(seats).fill(null),
    voted: Array<boolean>(seats).fill(false),
    examinations: [],
    bound: null,
    nightVictim: null,
    shepherdAct: null,
    saveUsed: false,
    expelUsed: false,
    lambPeeked: false,
    lambCaught: false,
    lambSights: [],
    leader: null,
    electionOpen: rolesInPlay.leader,
    elections: [],
    history: [],
    departures: [],
    pending: [],
    resume: 'morning',
    debateSeconds: Number(options.debate ?? '180'),
    winner: null,
    rng: rng.state,
  };
}

/** Plätze, die noch im Spiel sind. */
export function livingSeats(state: WolvesSheepState): SeatId[] {
  return state.alive.flatMap((alive, seat) => (alive ? [seat] : []));
}

/** Wer die Beratung beenden darf: der Leithammel, sonst der erste Lebende. */
export function speakerOf(state: WolvesSheepState): SeatId | null {
  if (state.leader !== null && state.alive[state.leader]) return state.leader;
  return livingSeats(state)[0] ?? null;
}

/** Der Verbundene eines Platzes oder null. */
export function partnerOf(state: WolvesSheepState, seat: SeatId): SeatId | null {
  if (!state.bound) return null;
  const [a, b] = state.bound;
  if (a === seat) return b;
  if (b === seat) return a;
  return null;
}

/** Sind ein Wolf und ein Schaf verbunden? Dann haben die zwei ein eigenes Ziel. */
function mixedPair(state: WolvesSheepState): boolean {
  if (!state.bound) return false;
  return (state.roles[state.bound[0]] === 'wolf') !== (state.roles[state.bound[1]] === 'wolf');
}

export function currentPlayers(state: WolvesSheepState): Actor[] {
  switch (state.phase) {
    case 'done':
      return [];
    // Nachts handeln alle Lebenden: Dürften nur Rollenträger ziehen, verriete die Liste sie.
    case 'preround':
    case 'night':
    case 'dawn':
      return livingSeats(state).filter((seat) => !state.confirmed[seat]);
    case 'election':
    case 'vote':
      return livingSeats(state).filter((seat) => !state.voted[seat]);
    case 'pending':
      return [state.pending[0]!.seat];
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

/**
 * Wen ein Platz nachts wählen darf. In der Vorrunde kennen sich die Wölfe noch nicht, und die
 * erlaubten Züge gehen an den Browser – deshalb dort für alle dieselbe Auswahl. Hat ein Wolf
 * kein Ziel mehr, darf er zum Schein tippen; das zählt nicht (siehe `countsAsWolfPick`).
 */
export function nightTargets(state: WolvesSheepState, seat: SeatId): SeatId[] {
  const others = livingSeats(state).filter((target) => target !== seat);
  if (state.phase === 'preround' || state.roles[seat] !== 'wolf') return others;
  const partner = partnerOf(state, seat);
  const prey = others.filter((target) => state.roles[target] !== 'wolf' && target !== partner);
  return prey.length > 0 ? prey : others;
}

function countsAsWolfPick(state: WolvesSheepState, wolf: SeatId, target: SeatId): boolean {
  return state.alive[target] === true && state.roles[target] !== 'wolf' && target !== partnerOf(state, wolf);
}

/** Wen der Herdenrat treffen kann: Verbundene dürfen nicht füreinander stimmen. */
function voteTargets(state: WolvesSheepState, seat: SeatId): SeatId[] {
  const partner = partnerOf(state, seat);
  return livingSeats(state).filter((target) => target !== seat && target !== partner);
}

function shepherdMoves(state: WolvesSheepState): WolvesSheepMove[] {
  const saves = !state.saveUsed && state.nightVictim !== null ? [false, true] : [false];
  const expels: (SeatId | null)[] = state.expelUsed ? [null] : [null, ...livingSeats(state)];
  return saves.flatMap((save) => expels.map((expel) => ({ type: 'shepherd' as const, save, expel })));
}

function roundMoves(state: WolvesSheepState, actor: SeatId): WolvesSheepMove[] {
  if (state.confirmed[actor]) return [];
  if (state.locked[actor]) return [{ type: 'done' }];
  const role = state.roles[actor];
  if (state.phase === 'dawn') return role === 'shepherd' ? shepherdMoves(state) : [{ type: 'done' }];
  if (state.phase === 'preround' && role === 'stray') {
    const forced = state.middle.every((card) => card === 'wolf');
    const cards = state.middle.map((_, card) => ({ type: 'swap' as const, card }));
    return forced ? cards : [{ type: 'swap', card: null }, ...cards];
  }
  if (state.phase === 'preround' && role === 'binder') {
    const living = livingSeats(state);
    return living.flatMap((a, i) => living.slice(i + 1).map((b) => ({ type: 'bind' as const, a, b })));
  }
  // Umentscheiden erlaubt `isLegal`; hier genügt das Festlegen, damit Zufallspartien vorankommen.
  const base: WolvesSheepMove[] = state.picks[actor] !== null ? [{ type: 'confirm' }] : nightTargets(state, actor).map((target) => ({ type: 'tap', target }));
  return state.phase === 'night' && role === 'lamb' && !state.lambPeeked ? [...base, { type: 'peek' }] : base;
}

export function legalMoves(state: WolvesSheepState, actor: Actor): WolvesSheepMove[] {
  if (actor === 'system') return state.phase === 'debate' && state.debateSeconds > 0 ? [{ type: 'endDebate' }] : [];
  if (state.phase === 'pending') {
    const head = state.pending[0]!;
    if (head.seat !== actor) return [];
    const targets = livingSeats(state).filter((target) => target !== actor);
    return targets.map((target) => ({ type: head.kind, target }));
  }
  if (!state.alive[actor]) return [];
  switch (state.phase) {
    case 'preround':
    case 'night':
    case 'dawn':
      return roundMoves(state, actor);
    case 'election':
      return state.voted[actor] ? [] : livingSeats(state).map((target) => ({ type: 'elect', target }));
    case 'debate':
      return speakerOf(state) === actor ? [{ type: 'endDebate' }] : [];
    case 'vote':
      return state.voted[actor] ? [] : voteTargets(state, actor).map((target) => ({ type: 'vote', target }));
    case 'done':
      return [];
  }
}

export function isLegal(state: WolvesSheepState, actor: Actor, move: WolvesSheepMove): boolean {
  if (move.type === 'leave') return actor !== 'system' && state.phase !== 'done' && state.alive[actor] === true;
  if (actor === 'system') return move.type === 'endDebate' && legalMoves(state, actor).length > 0;
  const moves = legalMoves(state, actor);
  const listed = (type: WolvesSheepMove['type']) => moves.some((entry) => entry.type === type);
  const picking = listed('tap') || listed('confirm');
  switch (move.type) {
    case 'tap':
      return picking && nightTargets(state, actor).includes(move.target);
    case 'confirm':
      if (!picking) return false;
      if (move.target !== undefined) return nightTargets(state, actor).includes(move.target);
      return state.picks[actor] !== null;
    case 'swap':
      return moves.some((entry) => entry.type === 'swap' && entry.card === move.card);
    case 'bind':
      return moves.some((entry) => entry.type === 'bind' && entry.a === Math.min(move.a, move.b) && entry.b === Math.max(move.a, move.b));
    case 'shepherd':
      return moves.some((entry) => entry.type === 'shepherd' && entry.save === move.save && entry.expel === move.expel);
    case 'elect':
    case 'vote':
      if (move.target === null) return listed(move.type);
      return moves.some((entry) => entry.type === move.type && entry.target === move.target);
    case 'shoot':
    case 'passBell':
      return moves.some((entry) => entry.type === move.type && entry.target === move.target);
    case 'peek':
    case 'done':
    case 'endDebate':
      return listed(move.type);
  }
}

/** Bei Zeitablauf: Wer nichts gewählt hat, bekommt eine zufällige Wahl; im Rat gilt das als Enthaltung. */
export function timeoutMove(state: WolvesSheepState, seat: SeatId): WolvesSheepMove {
  const rng = new Rng(state.rng);
  if (state.phase === 'vote') return { type: 'vote', target: null };
  if (state.phase === 'election') return { type: 'elect', target: null };
  if (state.phase === 'debate') return { type: 'endDebate' };
  if (state.phase === 'pending') return rng.pick(legalMoves(state, seat));
  const first = legalMoves(state, seat)[0];
  if (first?.type === 'done') return first;
  if (first?.type === 'shepherd') return { type: 'shepherd', save: false, expel: null, finish: true };
  if (first?.type === 'swap') return { type: 'swap', card: first.card, finish: true };
  if (first?.type === 'bind') return { ...rng.pick(legalMoves(state, seat)), finish: true } as WolvesSheepMove;
  if (state.picks[seat] !== null) return { type: 'confirm', finish: true };
  return { type: 'confirm', target: rng.pick(nightTargets(state, seat)), finish: true };
}

/** Aufgeben kostet nur diesen Platz; die Herde spielt weiter. */
export function resignMove(state: WolvesSheepState, seat: SeatId): WolvesSheepMove | null {
  return state.phase !== 'done' && state.alive[seat] ? { type: 'leave' } : null;
}

/**
 * Nimmt einen Platz aus dem Spiel, deckt seine Karte auf und zieht die Folgen nach sich: Der
 * Verbundene geht mit, der Hütehund und der Leithammel kommen in die Warteschlange. Wer aufgibt,
 * schießt nicht und gibt die Glocke nicht von Hand weiter, denn er ist ja nicht mehr da.
 */
function eliminate(state: WolvesSheepState, seat: SeatId, cause: DepartureCause, events: GameEvent[]): WolvesSheepState {
  if (!state.alive[seat]) return state;
  const role = state.roles[seat]!;
  const alive = state.alive.slice();
  alive[seat] = false;
  events.push({ type: 'departed', seat, role, cause });
  const pending = state.pending.slice();
  if (cause !== 'left' && role === 'hound') pending.push({ kind: 'shoot', seat });
  let leader = state.leader;
  if (leader === seat) {
    if (cause === 'left') leader = null;
    else pending.push({ kind: 'passBell', seat });
  }
  const next: WolvesSheepState = { ...state, alive, pending, leader, departures: [...state.departures, { seat, role, cause, day: state.day }] };
  const partner = partnerOf(state, seat);
  return partner === null ? next : eliminate(next, partner, 'grief', events);
}

/** Prüft, ob eine Seite gewonnen hat, erst wenn alle Folgen abgearbeitet sind. */
function checkWinner(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const living = livingSeats(state);
  const wolves = living.filter((seat) => state.roles[seat] === 'wolf').length;
  let winner: WolvesSheepState['winner'] = null;
  if (living.length === 0) winner = 'none';
  else if (mixedPair(state) && living.length === 2 && partnerOf(state, living[0]!) === living[1]) winner = 'pair';
  else if (wolves === 0) winner = 'flock';
  else if (wolves === living.length) winner = 'wolves';
  if (winner === null) return state;
  events.push({ type: 'gameOver', winner });
  return { ...state, winner, phase: 'done', pending: [] };
}

/** Stimmen und Wolfswahl auf inzwischen Ausgeschiedene verfallen und müssen neu abgegeben werden. */
function prune(state: WolvesSheepState): WolvesSheepState {
  const gone = (target: SeatId | null | undefined) => target !== null && target !== undefined && !state.alive[target];
  const redo = (i: number) => state.roles[i] === 'wolf' && gone(state.picks[i]);
  return {
    ...state,
    locked: state.locked.map((done, i) => done && !redo(i)),
    confirmed: state.confirmed.map((done, i) => done && !redo(i)),
    picks: state.picks.map((pick) => (gone(pick) ? null : pick)),
    voted: state.voted.map((done, i) => done && !gone(state.votes[i])),
    votes: state.votes.map((vote) => (gone(vote) ? null : vote)),
    nightVictim: gone(state.nightVictim) ? null : state.nightVictim,
  };
}

/** Arbeitet ab, was offen ist. Erst wenn die Schlange leer ist, zählt der Sieg und es geht weiter. */
function flush(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const living = livingSeats(state);
  const pending = state.pending.filter((entry) => living.some((target) => target !== entry.seat));
  if (pending.length > 0) return { ...state, pending, phase: 'pending' };
  const open = checkWinner({ ...state, pending: [] }, events);
  if (open.winner !== null) return open;
  // Hat der Leithammel aufgegeben, geht die Glocke an den ersten Lebenden.
  const lostLeader = open.rolesInPlay.leader && !open.electionOpen && (open.leader === null || !open.alive[open.leader]);
  const next = lostLeader ? { ...open, leader: living[0] ?? null } : open;
  switch (next.resume) {
    case 'morning':
      return startMorning(next, events);
    case 'nextNight':
      return startNight(next, events);
    default:
      return settle(prune({ ...next, phase: next.resume }), events);
  }
}

const freshRound = (state: WolvesSheepState) => ({
  picks: Array<SeatId | null>(state.seats).fill(null),
  locked: Array<boolean>(state.seats).fill(false),
  confirmed: Array<boolean>(state.seats).fill(false),
});

const freshVotes = (state: WolvesSheepState) => ({
  votes: Array<SeatId | null>(state.seats).fill(null),
  voted: Array<boolean>(state.seats).fill(false),
});

function startNight(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  events.push({ type: 'nightFell', day: state.day + 1 });
  return { ...state, ...freshRound(state), phase: 'night', day: state.day + 1, nightVictim: null, shepherdAct: null, lambPeeked: false, lambCaught: false };
}

function startMorning(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  events.push({ type: 'morning', day: state.day });
  return { ...state, ...freshVotes(state), phase: state.electionOpen ? 'election' : 'debate' };
}

/** Das Opfer der Nacht: das erwischte Lamm, sonst die Mehrheit der Wölfe, bei Gleichstand das Los. */
function resolveNight(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const rng = new Rng(state.rng);
  const lamb = state.roles.indexOf('lamb');
  let victim: SeatId | null = null;
  if (state.lambCaught && lamb >= 0 && state.alive[lamb]) {
    victim = lamb;
  } else {
    const counts = new Map<SeatId, number>();
    for (const seat of livingSeats(state)) {
      const pick = state.picks[seat];
      if (state.roles[seat] === 'wolf' && pick !== null && pick !== undefined && countsAsWolfPick(state, seat, pick)) counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }
    const most = Math.max(0, ...counts.values());
    const leaders = [...counts.keys()].filter((seat) => counts.get(seat) === most);
    if (leaders.length > 0) victim = rng.pick(leaders);
  }
  const next: WolvesSheepState = { ...state, nightVictim: victim, rng: rng.state };
  const shepherd = next.roles.indexOf('shepherd');
  // Liegt die Hirtenkarte unaufgedeckt in der Mitte, bleibt die Runde: Niemand darf daran etwas merken.
  if (next.rolesInPlay.shepherd && (shepherd < 0 || next.alive[shepherd])) return { ...next, ...freshRound(next), phase: 'dawn' };
  return resolveDawn(next, events);
}

function resolveDawn(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const act = state.shepherdAct;
  const lost = new Set<SeatId>();
  if (state.nightVictim !== null && !act?.save) lost.add(state.nightVictim);
  if (act?.expel !== null && act?.expel !== undefined) lost.add(act.expel);
  let next: WolvesSheepState = { ...state, resume: 'morning', saveUsed: state.saveUsed || act?.save === true, expelUsed: state.expelUsed || (act?.expel ?? null) !== null };
  // Nach Plätzen geordnet, damit die Reihenfolge nicht verrät, wer vom Stab getroffen wurde.
  for (const seat of [...lost].sort((a, b) => a - b)) next = eliminate(next, seat, 'wolves', events);
  return flush(next, events);
}

/** Die Wahl des Leithammels: die meisten Stimmen; bei Gleichstand wird am nächsten Morgen neu gewählt. */
function resolveElection(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const counts = new Map<SeatId, number>();
  for (const vote of state.votes) if (vote !== null) counts.set(vote, (counts.get(vote) ?? 0) + 1);
  const most = Math.max(0, ...counts.values());
  const leaders = [...counts.keys()].filter((seat) => counts.get(seat) === most);
  const elected = leaders.length === 1 ? leaders[0]! : null;
  events.push({ type: 'elected', seat: elected });
  return {
    ...state,
    ...freshVotes(state),
    phase: 'debate',
    leader: elected,
    electionOpen: elected === null,
    elections: [...state.elections, { day: state.day, votes: state.votes, elected }],
  };
}

/** Wer die meisten Stimmen hat, scheidet aus; bei Gleichstand niemand. Der Leithammel zählt doppelt. */
function resolveVote(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const counts = new Map<SeatId, number>();
  state.votes.forEach((vote, seat) => {
    if (vote !== null) counts.set(vote, (counts.get(vote) ?? 0) + (seat === state.leader ? 2 : 1));
  });
  const most = Math.max(0, ...counts.values());
  const leaders = [...counts.keys()].filter((seat) => counts.get(seat) === most);
  const out = leaders.length === 1 ? leaders[0]! : null;
  events.push({ type: 'voteResult', out, tie: out === null });
  let next: WolvesSheepState = {
    ...state,
    ...freshVotes(state),
    history: [...state.history, { day: state.day, votes: state.votes, out }],
    resume: 'nextNight',
  };
  if (out !== null) next = eliminate(next, out, 'council', events);
  return flush(next, events);
}

/** Ist die laufende Runde komplett, wenn niemand mehr aussteht? */
function settle(state: WolvesSheepState, events: GameEvent[]): WolvesSheepState {
  const living = livingSeats(state);
  const allDone = living.every((seat) => state.confirmed[seat]);
  const allVoted = living.every((seat) => state.voted[seat]);
  if (state.phase === 'preround' && allDone) return { ...state, ...freshRound(state), phase: 'night' };
  if (state.phase === 'night' && allDone) return resolveNight(state, events);
  if (state.phase === 'dawn' && allDone) return resolveDawn(state, events);
  if (state.phase === 'election' && allVoted) return resolveElection(state, events);
  if (state.phase === 'vote' && allVoted) return resolveVote(state, events);
  return state;
}

/** Hält die Festlegung eines Platzes fest; `finish` schließt seine Runde gleich mit ab. */
function lock(state: WolvesSheepState, seat: SeatId, finish?: boolean): WolvesSheepState {
  const locked = state.locked.slice();
  locked[seat] = true;
  const confirmed = state.confirmed.slice();
  if (finish) confirmed[seat] = true;
  return { ...state, locked, confirmed };
}

export function applyMove(state: WolvesSheepState, actor: Actor, move: WolvesSheepMove): MoveResult<WolvesSheepState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const events: GameEvent[] = [];
  const seat = actor as SeatId;
  switch (move.type) {
    case 'tap': {
      const picks = state.picks.slice();
      picks[seat] = move.target;
      return { state: { ...state, picks }, events };
    }
    case 'confirm': {
      const picks = state.picks.slice();
      if (move.target !== undefined) picks[seat] = move.target;
      const target = picks[seat]!;
      // Der Prüfer erfährt das Ergebnis sofort, nicht erst am Morgen.
      const examines = state.phase === 'night' && state.roles[seat] === 'examiner';
      const examinations = examines ? [...state.examinations, { night: state.day, target, role: state.roles[target]! }] : state.examinations;
      return { state: settle(lock({ ...state, picks, examinations }, seat, move.finish), events), events };
    }
    case 'done': {
      const confirmed = state.confirmed.slice();
      confirmed[seat] = true;
      return { state: settle({ ...state, confirmed }, events), events };
    }
    case 'swap': {
      const roles = state.roles.slice();
      const middle = state.middle.slice();
      if (move.card !== null) {
        const taken = middle[move.card]!;
        middle[move.card] = roles[seat]!;
        roles[seat] = taken;
      }
      return { state: settle(lock({ ...state, roles, middle }, seat, move.finish), events), events };
    }
    case 'bind': {
      const bound: [SeatId, SeatId] = [Math.min(move.a, move.b), Math.max(move.a, move.b)];
      return { state: settle(lock({ ...state, bound }, seat, move.finish), events), events };
    }
    case 'peek': {
      const rng = new Rng(state.rng);
      const wolves = livingSeats(state).filter((other) => state.roles[other] === 'wolf');
      const target = rng.pick(wolves);
      const caught = rng.next() < LAMB_CAUGHT_CHANCE;
      return { state: { ...state, rng: rng.state, lambPeeked: true, lambCaught: caught, lambSights: [...state.lambSights, { night: state.day, target }] }, events };
    }
    case 'shepherd':
      return { state: settle(lock({ ...state, shepherdAct: { save: move.save, expel: move.expel } }, seat, move.finish), events), events };
    case 'endDebate':
      events.push({ type: 'councilOpened' });
      return { state: { ...state, ...freshVotes(state), phase: 'vote' }, events };
    case 'elect':
    case 'vote': {
      const votes = state.votes.slice();
      votes[seat] = move.target;
      const voted = state.voted.slice();
      voted[seat] = true;
      return { state: settle({ ...state, votes, voted }, events), events };
    }
    case 'shoot': {
      const rest = { ...state, pending: state.pending.slice(1) };
      return { state: flush(eliminate(rest, move.target, 'hound', events), events), events };
    }
    case 'passBell':
      events.push({ type: 'bellPassed', seat: move.target });
      return { state: flush({ ...state, pending: state.pending.slice(1), leader: move.target }, events), events };
    case 'leave': {
      const resume: Resume = state.phase === 'pending' || state.phase === 'done' ? state.resume : state.phase;
      return { state: flush(eliminate({ ...state, resume }, seat, 'left', events), events), events };
    }
  }
}

export function result(state: WolvesSheepState): Result | null {
  if (state.winner === null) return null;
  if (state.winner === 'none') return { kind: 'draw', reason: 'Niemand ist mehr übrig.' };
  if (state.winner === 'pair') return { kind: 'win', winners: [...state.bound!], reason: 'Der Wolf wohnt beim Lamm: Die Verbundenen sind allein übrig.' };
  const pairMembers: SeatId[] = mixedPair(state) ? state.bound! : [];
  const winners = state.roles.flatMap((role, seat) => ((role === 'wolf') === (state.winner === 'wolves') && !pairMembers.includes(seat) ? [seat] : []));
  return { kind: 'win', winners, reason: state.winner === 'wolves' ? 'Die Wölfe haben die Herde zerstreut.' : 'Alle Wölfe sind entdeckt.' };
}

/**
 * Jeder sieht die eigene Rolle und alle aufgedeckten Karten, Wölfe ab der Nacht einander.
 * Ausgeschiedene sehen alles und müssen schweigen, wie im Original. Das gilt aber erst, wenn sie
 * ihre letzte Handlung hinter sich haben: Der Hütehund schießt ohne dieses Wissen. Zuschauer
 * (die Tafel) sehen nur Öffentliches.
 */
export function playerView(state: WolvesSheepState, seat: SeatId | 'spectator'): WolvesSheepState {
  const stillActing = seat !== 'spectator' && state.pending.some((entry) => entry.seat === seat);
  const allKnowing = state.phase === 'done' || (seat !== 'spectator' && !state.alive[seat] && !stillActing);
  if (allKnowing) return { ...state, rng: [0, 0, 0, 0] };

  const role = seat === 'spectator' ? null : state.roles[seat];
  const isWolf = role === 'wolf' && state.phase !== 'preround';
  const shownRole = (other: SeatId): boolean => other === seat || !state.alive[other] || (isWolf && state.roles[other] === 'wolf');
  const own = <T,>(list: T[], empty: T): T[] => list.map((entry, i) => (i === seat ? entry : empty));
  const isShepherd = role === 'shepherd';
  const isLamb = role === 'lamb';
  const inPair = seat !== 'spectator' && partnerOf(state, seat) !== null && state.phase !== 'preround';
  const seesMiddle = seat !== 'spectator' && state.strayHolder === seat;
  return {
    ...state,
    roles: state.roles.map((entry, other) => (shownRole(other) ? entry : null)),
    middle: seesMiddle ? state.middle : state.middle.map(() => null),
    strayHolder: seesMiddle ? seat : null,
    picks: state.picks.map((pick, other) => (other === seat || (isWolf && state.roles[other] === 'wolf') ? pick : null)),
    locked: own(state.locked, false),
    confirmed: own(state.confirmed, false),
    votes: own(state.votes, null),
    voted: own(state.voted, false),
    examinations: role === 'examiner' ? state.examinations : [],
    bound: role === 'binder' || inPair ? state.bound : null,
    nightVictim: isShepherd ? state.nightVictim : null,
    shepherdAct: isShepherd ? state.shepherdAct : null,
    saveUsed: isShepherd ? state.saveUsed : false,
    expelUsed: isShepherd ? state.expelUsed : false,
    lambPeeked: isLamb ? state.lambPeeked : false,
    lambCaught: false,
    lambSights: isLamb ? state.lambSights : [],
    rng: [0, 0, 0, 0],
  };
}

/** Verteilt die unbekannten Karten passend zu dem, was der Platz weiß. */
export function sampleHidden(view: WolvesSheepState, seat: SeatId, rng: Rng): WolvesSheepState {
  const roles = view.roles.slice();
  for (const { target, role } of view.examinations) roles[target] = role;
  for (const { target } of view.lambSights) roles[target] = 'wolf';
  const open = view.deck.slice();
  for (const role of [...roles, ...view.middle]) {
    if (role === null) continue;
    const index = open.indexOf(role);
    if (index >= 0) open.splice(index, 1);
  }
  const shuffled = rng.shuffle(open);
  // Ein Wolf kennt ab der Nacht das ganze Rudel: Fehlende Wölfe können nur in der Mitte liegen.
  const knowsPack = view.roles[seat] === 'wolf' && view.phase !== 'preround';
  const rest = knowsPack ? [...shuffled.filter((role) => role === 'wolf'), ...shuffled.filter((role) => role !== 'wolf')] : shuffled;
  return {
    ...view,
    roles: roles.map((role) => role ?? rest.pop()!),
    middle: view.middle.map((role) => role ?? rest.pop()!),
    rng: rng.state,
  };
}
