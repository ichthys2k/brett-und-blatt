import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';
import {
  BAIL,
  CARDS,
  COMMUNITY_FIELDS,
  COMMUNITY_RENT,
  CRIER_FIELDS,
  FIELD_COUNT,
  GO_MONEY,
  GUILDS,
  JAIL,
  NEWS,
  NEWS_DOUBLE,
  PARTNER_BONUS,
  WHOLE_BONUS,
  guildOf,
  priceOf,
  type CardId,
  type NewsId,
} from './board';

export type Phase = 'roll' | 'buy' | 'auction' | 'sealed' | 'errand' | 'audience' | 'well' | 'fair' | 'reply' | 'end' | 'finished';

export interface PlayerState {
  pos: number;
  cash: number;
  /** −1 = frei, sonst Fehlversuche im Kerker. */
  jailTurns: number;
  pardon: boolean;
  blessed: boolean;
  /** Hat aufgegeben; der Platz wird übersprungen. */
  gone: boolean;
}

export interface TradeOffer {
  from: SeatId;
  to: SeatId;
  give: number[];
  take: number[];
  /** Brezeln von `from` an `to`; negativ andersherum. */
  pay: number;
}

export interface MarketState {
  seats: number;
  options: { years: number; start: number; news: boolean; partnership: boolean; trade: boolean; sealed: boolean };
  rounds: number;
  round: number;
  turn: SeatId;
  phase: Phase;
  players: PlayerState[];
  owner: number[];
  level: number[];
  mortgaged: boolean[];
  /** Ersteigert: gezahlter Preis, sonst −1 (Listenpreis). Bei der Wertung zählt, was der Betrieb gekostet hat. */
  paid: number[];
  partners: { guild: number; seats: [SeatId, SeatId] }[];
  debts: { from: SeatId; to: SeatId | -1; amount: number }[];
  news: NewsId | null;
  newsDeck: (NewsId | null)[];
  newsUsed: NewsId[];
  cardDeck: (CardId | null)[];
  cardDiscard: CardId[];
  rng: RngState | null;
  dice: [number, number] | null;
  doubles: number;
  /** Muss der Platz (noch einmal) würfeln? */
  mustRoll: boolean;
  offerUsed: boolean;
  partnerAsked: number[];
  actions: number;
  field: number | null;
  auction: { field: number; active: SeatId[]; bid: number; leader: SeatId | null; bidder: SeatId } | null;
  sealed: { field: number; bids: (number | null)[]; done: boolean[] } | null;
  offer: TradeOffer | null;
  partnerOffer: { from: SeatId; to: SeatId; guild: number } | null;
  fairQueue: SeatId[];
  lastCard: CardId | null;
}

export type MarketView = MarketState;

export type MarketMove =
  | { type: 'roll' }
  | { type: 'payBail' }
  | { type: 'usePardon' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'bid' }
  | { type: 'fold' }
  | { type: 'sealedBid'; amount: number }
  | { type: 'errand'; choice: 'cash' | 1 | 2 | 3 }
  | { type: 'audience'; build: number | null }
  | { type: 'well'; field: number | null }
  | { type: 'build'; field: number }
  | { type: 'sellBuild'; field: number }
  | { type: 'mortgage'; field: number }
  | { type: 'redeem'; field: number }
  | { type: 'offer'; to: SeatId; give: number[]; take: number[]; pay: number }
  | { type: 'pass' }
  | { type: 'accept' }
  | { type: 'reject' }
  | { type: 'askPartner'; guild: number }
  | { type: 'endTurn' }
  | { type: 'resign'; seat: SeatId };

/** Mehr Verwaltung je Zug gibt es nicht; so kann niemand eine Partie endlos aufhalten. */
const MAX_ACTIONS = 40;

export function setup(seats: number, options: Options, seed: string): MarketState {
  const yearsOption = options.years ?? 'auto';
  const years = yearsOption === 'auto' ? (seats >= 5 ? 2 : 3) : Number(yearsOption);
  const start = Number(options.start ?? 40);
  const rng = Rng.fromSeed(seed, 'marketplace');
  const state: MarketState = {
    seats,
    options: { years, start, news: options.news !== 'off', partnership: options.partnership !== 'off', trade: options.trade !== 'off', sealed: options.auction === 'sealed' },
    rounds: years * 8,
    round: 0,
    turn: 0,
    phase: 'roll',
    // Ausgleich aus der Probe: Spätere Plätze kommen später an die freien Betriebe.
    players: Array.from({ length: seats }, (_, seat) => ({ pos: 0, cash: start + seat, jailTurns: -1, pardon: false, blessed: false, gone: false })),
    owner: new Array(FIELD_COUNT).fill(-1),
    level: new Array(FIELD_COUNT).fill(0),
    mortgaged: new Array(FIELD_COUNT).fill(false),
    paid: new Array(FIELD_COUNT).fill(-1),
    partners: [],
    debts: [],
    news: null,
    newsDeck: [],
    newsUsed: [],
    cardDeck: rng.shuffle([...CARDS]),
    cardDiscard: [],
    rng: rng.state,
    dice: null,
    doubles: 0,
    mustRoll: true,
    offerUsed: false,
    partnerAsked: [],
    actions: 0,
    field: null,
    auction: null,
    sealed: null,
    offer: null,
    partnerOffer: null,
    fairQueue: [],
    lastCard: null,
  };
  beginSeason(state, []);
  settle(state);
  return state;
}

function shuffleWith<T>(state: MarketState, list: T[]): T[] {
  const rng = new Rng(state.rng!);
  const out = rng.shuffle(list);
  state.rng = rng.state;
  return out;
}

function beginSeason(state: MarketState, events: GameEvent[]): void {
  if (!state.options.news) return;
  if (state.newsDeck.length === 0) {
    state.newsDeck = shuffleWith(state, [...NEWS]);
    state.newsUsed = [];
  }
  state.news = state.newsDeck.pop() as NewsId;
  state.newsUsed.push(state.news);
  events.push({ type: 'news', news: state.news });
  if (state.news === 'peace' && state.options.trade) state.fairQueue = activeSeats(state);
}

const activeSeats = (state: MarketState): SeatId[] => state.players.flatMap((p, seat) => (p.gone ? [] : [seat]));

/** Nächster Schritt, wenn nichts mehr offen ist. */
function settle(state: MarketState): void {
  state.fairQueue = state.fairQueue.filter((seat) => !state.players[seat]!.gone);
  if (state.fairQueue.length > 0) state.phase = 'fair';
  else state.phase = state.mustRoll ? 'roll' : 'end';
  state.field = null;
}

// ---------- Abfragen ----------

export const isPartner = (state: MarketState, seat: SeatId, guild: number): boolean => state.partners.some((p) => p.guild === guild && p.seats.includes(seat));
export const hasWhole = (state: MarketState, seat: SeatId, guild: number): boolean => GUILDS[guild]!.fields.every((f) => state.owner[f] === seat);
export const canDouble = (state: MarketState, seat: SeatId, guild: number): boolean => hasWhole(state, seat, guild) || isPartner(state, seat, guild);
export const buildCost = (state: MarketState, guild: number): number => GUILDS[guild]!.build + (state.news === 'frost' ? 1 : 0);
export const goMoney = (state: MarketState): number => (state.news === 'kingVisit' ? GO_MONEY * 2 : GO_MONEY);

export function rentOf(state: MarketState, field: number): number {
  const owner = state.owner[field]!;
  if (owner < 0 || state.mortgaged[field]) return 0;
  const g = guildOf(field)!;
  if (g === -1) {
    if (state.news === 'flood' && (field === 6 || field === 14)) return 0;
    return COMMUNITY_RENT * COMMUNITY_FIELDS.filter((f) => state.owner[f] === owner && !state.mortgaged[f]).length;
  }
  const level = state.level[field]!;
  let rent = GUILDS[g]!.ware[level]!;
  if (level === 0 && canDouble(state, owner, g)) rent *= 2;
  if (state.news !== null && NEWS_DOUBLE[state.news] === g) rent *= 2;
  if (state.news === 'badHarvest' && g === 0) rent = Math.ceil(rent / 2);
  return rent;
}

/** Vermögen nach der Wertung des Plans; die Leiste in der Mitte zeigt es jederzeit. */
export function worth(state: MarketState, seat: SeatId): number {
  let total = state.players[seat]!.cash;
  for (let field = 0; field < FIELD_COUNT; field++) {
    if (state.owner[field] !== seat) continue;
    const price = priceOf(field);
    const paid = state.paid[field]!;
    // Ein Pfand ist ein Darlehen über den halben Listenpreis; ein billig ersteigerter Betrieb zählt entsprechend weniger.
    if (paid >= 0) total += state.mortgaged[field] ? Math.max(0, paid - Math.ceil(price / 2)) : paid;
    else total += state.mortgaged[field] ? Math.ceil(price / 2) : price;
    const g = guildOf(field)!;
    if (g >= 0) total += state.level[field]! * GUILDS[g]!.build;
  }
  GUILDS.forEach((_, g) => {
    if (hasWhole(state, seat, g)) total += WHOLE_BONUS;
    else if (isPartner(state, seat, g)) total += PARTNER_BONUS;
  });
  for (const debt of state.debts) {
    if (debt.from === seat) total -= debt.amount;
    if (debt.to === seat) total += debt.amount;
  }
  return total;
}

/** Betriebe des Platzes, auf denen als Nächstes gebaut werden darf (gleichmäßig). */
export function buildableFields(state: MarketState, seat: SeatId): number[] {
  const out: number[] = [];
  GUILDS.forEach((guild, g) => {
    if (!canDouble(state, seat, g)) return;
    const mine = guild.fields.filter((f) => state.owner[f] === seat);
    if (mine.some((f) => state.mortgaged[f])) return;
    const low = Math.min(...mine.map((f) => state.level[f]!));
    if (low >= 2) return;
    for (const f of mine) if (state.level[f] === low) out.push(f);
  });
  return out;
}

export function sellableFields(state: MarketState, seat: SeatId): number[] {
  const out: number[] = [];
  GUILDS.forEach((guild) => {
    const mine = guild.fields.filter((f) => state.owner[f] === seat);
    if (mine.length === 0) return;
    const high = Math.max(...mine.map((f) => state.level[f]!));
    if (high > 0) for (const f of mine) if (state.level[f] === high) out.push(f);
  });
  return out;
}

export function mortgageableFields(state: MarketState, seat: SeatId): number[] {
  const out: number[] = [];
  for (let f = 0; f < FIELD_COUNT; f++) {
    if (state.owner[f] !== seat || state.mortgaged[f]) continue;
    const g = guildOf(f)!;
    if (g >= 0 && GUILDS[g]!.fields.some((other) => state.owner[other] === seat && state.level[other]! > 0)) continue;
    out.push(f);
  }
  return out;
}

export const redeemCost = (field: number): number => Math.ceil(priceOf(field) / 2) + Math.max(1, Math.ceil(priceOf(field) * 0.1));

/** Gebaute, verpfändete und Partnerschafts-Betriebe lassen sich nicht handeln. */
export function isTradable(state: MarketState, field: number): boolean {
  const g = guildOf(field);
  if (g === null || state.owner[field]! < 0 || state.level[field]! > 0 || state.mortgaged[field]) return false;
  return !state.partners.some((p) => p.guild === g);
}

/** Zünfte, in denen dieser Platz zwei Betriebe hat und ein anderer den dritten: Hier darf er die Partnerschaft anbieten. */
export function partnerOptions(state: MarketState, seat: SeatId): { guild: number; other: SeatId }[] {
  if (!state.options.partnership) return [];
  const out: { guild: number; other: SeatId }[] = [];
  GUILDS.forEach((guild, g) => {
    if (state.partners.some((p) => p.guild === g) || state.partnerAsked.includes(g)) return;
    const owners = guild.fields.map((f) => state.owner[f]!);
    if (owners.filter((o) => o === seat).length !== 2) return;
    const other = owners.find((o) => o !== seat)!;
    if (other >= 0) out.push({ guild: g, other });
  });
  return out;
}

function validOffer(state: MarketState, from: SeatId, move: Extract<MarketMove, { type: 'offer' }>): boolean {
  if (!state.options.trade || move.to === from || !Number.isInteger(move.to) || move.to < 0 || move.to >= state.seats || state.players[move.to]!.gone) return false;
  if (!Array.isArray(move.give) || !Array.isArray(move.take) || !Number.isInteger(move.pay)) return false;
  if (move.give.length === 0 && move.take.length === 0) return false;
  if (new Set([...move.give, ...move.take]).size !== move.give.length + move.take.length) return false;
  if (!move.give.every((f) => state.owner[f] === from && isTradable(state, f))) return false;
  if (!move.take.every((f) => state.owner[f] === move.to && isTradable(state, f))) return false;
  if (move.pay > 0 && state.players[from]!.cash < move.pay) return false;
  if (move.pay < 0 && state.players[move.to]!.cash < -move.pay) return false;
  return true;
}

export function currentPlayers(state: MarketState): Actor[] {
  switch (state.phase) {
    case 'finished':
      return [];
    case 'auction':
      return [state.auction!.bidder];
    case 'sealed':
      return state.sealed!.done.flatMap((done, seat) => (done ? [] : [seat]));
    case 'fair':
      return [state.fairQueue[0]!];
    case 'reply':
      return [state.offer?.to ?? state.partnerOffer!.to];
    default:
      return [state.turn];
  }
}

function manageMoves(state: MarketState, seat: SeatId): MarketMove[] {
  if (state.actions >= MAX_ACTIONS) return [];
  const moves: MarketMove[] = [];
  const cash = state.players[seat]!.cash;
  for (const f of sellableFields(state, seat)) moves.push({ type: 'sellBuild', field: f });
  for (const f of mortgageableFields(state, seat)) moves.push({ type: 'mortgage', field: f });
  if (state.phase === 'buy') return moves;
  for (const f of buildableFields(state, seat)) if (cash >= buildCost(state, guildOf(f)!)) moves.push({ type: 'build', field: f });
  for (let f = 0; f < FIELD_COUNT; f++) if (state.owner[f] === seat && state.mortgaged[f] && cash >= redeemCost(f)) moves.push({ type: 'redeem', field: f });
  for (const { guild } of partnerOptions(state, seat)) moves.push({ type: 'askPartner', guild });
  return moves;
}

/** Beispiele für Angebote; erlaubt ist mehr, das prüft `isLegal`. */
function sampleOffers(state: MarketState, seat: SeatId): MarketMove[] {
  if (!state.options.trade) return [];
  const moves: MarketMove[] = [];
  for (let f = 0; f < FIELD_COUNT && moves.length < 6; f++) {
    if (!isTradable(state, f)) continue;
    const owner = state.owner[f]!;
    const pay = Math.ceil(priceOf(f) * 1.5);
    if (owner !== seat && !state.players[owner]!.gone && state.players[seat]!.cash >= pay) moves.push({ type: 'offer', to: owner, give: [], take: [f], pay });
  }
  return moves;
}

export function legalMoves(state: MarketState, actor: Actor): MarketMove[] {
  if (actor === 'system' || !currentPlayers(state).includes(actor)) return [];
  const seat = actor;
  const player = state.players[seat]!;
  switch (state.phase) {
    case 'roll': {
      const moves: MarketMove[] = [{ type: 'roll' }];
      if (player.jailTurns >= 0) {
        if (player.cash >= BAIL) moves.push({ type: 'payBail' });
        if (player.pardon) moves.push({ type: 'usePardon' });
      }
      moves.push(...manageMoves(state, seat));
      if (!state.offerUsed) moves.push(...sampleOffers(state, seat));
      return moves;
    }
    case 'end': {
      const moves: MarketMove[] = [{ type: 'endTurn' }, ...manageMoves(state, seat)];
      if (!state.offerUsed) moves.push(...sampleOffers(state, seat));
      return moves;
    }
    case 'buy': {
      const moves: MarketMove[] = [{ type: 'decline' }];
      if (player.cash >= priceOf(state.field!)) moves.push({ type: 'buy' });
      moves.push(...manageMoves(state, seat));
      return moves;
    }
    case 'auction': {
      const moves: MarketMove[] = [{ type: 'fold' }];
      if (player.cash > state.auction!.bid) moves.push({ type: 'bid' });
      return moves;
    }
    case 'sealed': {
      const price = priceOf(state.sealed!.field);
      const amounts = new Set([0, Math.min(player.cash, 1), Math.min(player.cash, Math.ceil(price / 2)), Math.min(player.cash, price)]);
      return [...amounts].map((amount) => ({ type: 'sealedBid' as const, amount }));
    }
    case 'errand':
      return [{ type: 'errand', choice: 'cash' }, { type: 'errand', choice: 1 }, { type: 'errand', choice: 2 }, { type: 'errand', choice: 3 }];
    case 'audience': {
      const moves: MarketMove[] = [{ type: 'audience', build: null }];
      for (const f of buildableFields(state, seat)) if (player.cash >= Math.ceil(buildCost(state, guildOf(f)!) / 2)) moves.push({ type: 'audience', build: f });
      return moves;
    }
    case 'well': {
      const moves: MarketMove[] = [{ type: 'well', field: null }];
      for (let f = 0; f < FIELD_COUNT; f++) if (guildOf(f) !== null && state.owner[f] === -1 && player.cash >= priceOf(f)) moves.push({ type: 'well', field: f });
      return moves;
    }
    case 'fair':
      return [{ type: 'pass' }, ...sampleOffers(state, seat)];
    case 'reply':
      return [{ type: 'accept' }, { type: 'reject' }];
    default:
      return [];
  }
}

export function isLegal(state: MarketState, actor: Actor, move: MarketMove): boolean {
  if (actor === 'system' || !currentPlayers(state).includes(actor)) return move?.type === 'resign';
  if (!move || typeof move !== 'object') return false;
  if (move.type === 'offer') {
    if (state.phase === 'fair') return validOffer(state, actor, move);
    return (state.phase === 'roll' || state.phase === 'end') && !state.offerUsed && validOffer(state, actor, move);
  }
  if (move.type === 'sealedBid') return state.phase === 'sealed' && Number.isInteger(move.amount) && move.amount >= 0 && move.amount <= state.players[actor]!.cash;
  if (move.type === 'resign') return true;
  return legalMoves(state, actor).some((m) => JSON.stringify(m) === JSON.stringify(move));
}

// ---------- Geld ----------

/** Zahlen. Reicht es nicht, werden Bauten verkauft und Betriebe verpfändet; der Rest wird Schuldschein. */
function pay(state: MarketState, seat: SeatId, to: SeatId | -1, amount: number, events: GameEvent[]): void {
  const player = state.players[seat]!;
  while (player.cash < amount) {
    const sell = sellableFields(state, seat).sort((a, b) => priceOf(a) - priceOf(b))[0];
    if (sell !== undefined) {
      state.level[sell]!--;
      player.cash += Math.ceil(GUILDS[guildOf(sell)!]!.build / 2);
      events.push({ type: 'autoSold', seat, field: sell });
      continue;
    }
    const pledge = mortgageableFields(state, seat).sort((a, b) => priceOf(a) - priceOf(b))[0];
    if (pledge === undefined) break;
    state.mortgaged[pledge] = true;
    player.cash += Math.ceil(priceOf(pledge) / 2);
    events.push({ type: 'autoMortgaged', seat, field: pledge });
  }
  const paid = Math.min(player.cash, amount);
  player.cash -= paid;
  if (to >= 0) state.players[to]!.cash += paid;
  if (paid < amount) {
    state.debts.push({ from: seat, to, amount: amount - paid });
    events.push({ type: 'debt', seat, to, amount: amount - paid });
  }
  if (amount > 0) events.push({ type: 'paid', seat, to, amount });
}

// ---------- Ziehen und Landen ----------

function advance(state: MarketState, seat: SeatId, steps: number, events: GameEvent[]): void {
  const player = state.players[seat]!;
  const from = player.pos;
  player.pos = (from + steps) % FIELD_COUNT;
  events.push({ type: 'moved', seat, from, to: player.pos });
  if (player.pos < from) {
    player.cash += goMoney(state);
    events.push({ type: 'goMoney', seat, amount: goMoney(state) });
  }
}

function toJail(state: MarketState, seat: SeatId, events: GameEvent[]): void {
  const player = state.players[seat]!;
  player.pos = JAIL;
  player.jailTurns = 0;
  state.mustRoll = false;
  state.doubles = 0;
  events.push({ type: 'jailed', seat });
}

function drawCard(state: MarketState, seat: SeatId, events: GameEvent[]): void {
  if (state.cardDeck.length === 0) {
    state.cardDeck = shuffleWith(state, state.cardDiscard);
    state.cardDiscard = [];
  }
  const card = state.cardDeck.pop() as CardId;
  const player = state.players[seat]!;
  state.lastCard = card === 'pardon' ? null : card;
  events.push({ type: 'card', seat, card });
  if (card === 'pardon') {
    player.pardon = true;
    return;
  }
  state.cardDiscard.push(card);
  switch (card) {
    case 'errand':
      state.phase = 'errand';
      return;
    case 'toJail':
      toJail(state, seat, events);
      break;
    case 'blessing':
      player.blessed = true;
      break;
    case 'birthday':
      for (const other of activeSeats(state)) if (other !== seat) pay(state, other, seat, 1, events);
      break;
    case 'festival':
      for (const other of activeSeats(state)) if (other !== seat) pay(state, seat, other, 1, events);
      break;
    case 'repairs': {
      let bill = 0;
      for (let f = 0; f < FIELD_COUNT; f++) if (state.owner[f] === seat) bill += state.level[f]!;
      pay(state, seat, -1, bill, events);
      break;
    }
    case 'praise':
      player.cash += 4;
      break;
    case 'toGate':
      player.pos = 0;
      events.push({ type: 'moved', seat, from: -1, to: 0 });
      player.cash += goMoney(state);
      events.push({ type: 'goMoney', seat, amount: goMoney(state) });
      break;
    case 'pilgrimage':
      advance(state, seat, (11 - player.pos + FIELD_COUNT) % FIELD_COUNT, events);
      land(state, seat, events);
      break;
    case 'purse':
      player.cash += 3;
      break;
    case 'crooked':
      pay(state, seat, -1, 3, events);
      break;
  }
}

/** Wirkung des Feldes. Braucht es eine Entscheidung, steht danach die passende Phase im Spielstand. */
function land(state: MarketState, seat: SeatId, events: GameEvent[]): void {
  const player = state.players[seat]!;
  const field = player.pos;
  const g = guildOf(field);
  if (g !== null) {
    const owner = state.owner[field]!;
    if (owner === -1) {
      state.phase = 'buy';
      state.field = field;
    } else if (owner !== seat) {
      let rent = rentOf(state, field);
      if (rent > 0 && player.blessed) {
        rent = Math.ceil(rent / 2);
        player.blessed = false;
      }
      if (rent > 0) {
        pay(state, seat, owner, rent, events);
        events.push({ type: 'ware', seat, owner, field, amount: rent });
      }
    }
    return;
  }
  if (CRIER_FIELDS.includes(field)) {
    drawCard(state, seat, events);
    return;
  }
  switch (field) {
    case 4:
      pay(state, seat, -1, Math.max(2, Math.ceil(player.cash * 0.1)), events);
      break;
    case 33:
      pay(state, seat, -1, 4, events);
      break;
    case 11:
      player.cash += state.news === 'pilgrims' ? 4 : 2;
      break;
    case 18:
      player.cash += 2;
      if (state.options.trade) state.fairQueue = activeSeats(state);
      break;
    case 20: {
      const canBuild = buildableFields(state, seat).some((f) => player.cash >= Math.ceil(buildCost(state, guildOf(f)!) / 2));
      if (canBuild) state.phase = 'audience';
      else player.cash += 4;
      break;
    }
    case 27:
      toJail(state, seat, events);
      break;
    case 29:
      player.cash += 1;
      break;
    case 35: {
      const free = state.owner.some((o, f) => o === -1 && guildOf(f) !== null && player.cash >= priceOf(f));
      if (free) state.phase = 'well';
      break;
    }
  }
}

function buyField(state: MarketState, seat: SeatId, field: number, price: number, events: GameEvent[]): void {
  state.players[seat]!.cash -= price;
  state.owner[field] = seat;
  events.push({ type: 'bought', seat, field, price });
}

function closeAuction(state: MarketState, events: GameEvent[]): void {
  const auction = state.auction!;
  if (auction.leader !== null) {
    buyField(state, auction.leader, auction.field, auction.bid, events);
    state.paid[auction.field] = auction.bid;
  }
  state.auction = null;
  settle(state);
}

/** Nächster Bieter; wer nicht mehr erhöhen kann, steigt von selbst aus. */
function nextBidder(state: MarketState, events: GameEvent[]): void {
  const auction = state.auction!;
  auction.active = auction.active.filter((seat) => seat === auction.leader || state.players[seat]!.cash > auction.bid);
  const others = auction.active.filter((seat) => seat !== auction.leader);
  if (others.length === 0) {
    closeAuction(state, events);
    return;
  }
  for (let step = 1; step <= state.seats; step++) {
    const seat = (auction.bidder + step) % state.seats;
    if (others.includes(seat)) {
      auction.bidder = seat;
      return;
    }
  }
}

function startAuction(state: MarketState, field: number, events: GameEvent[]): void {
  events.push({ type: 'auction', field });
  if (state.options.sealed) {
    state.sealed = { field, bids: new Array(state.seats).fill(null), done: state.players.map((p) => p.gone || p.cash === 0) };
    state.phase = 'sealed';
    if (state.sealed.done.every(Boolean)) {
      state.sealed = null;
      settle(state);
    }
    return;
  }
  state.auction = { field, active: activeSeats(state), bid: 0, leader: null, bidder: (state.turn + state.seats - 1) % state.seats };
  state.phase = 'auction';
  nextBidder(state, events);
}

function closeSealed(state: MarketState, events: GameEvent[]): void {
  const sealed = state.sealed!;
  let best = 0;
  let winner: SeatId | null = null;
  // Gleichstand: Wer zuerst an der Reihe ist, gewinnt.
  for (let step = 0; step < state.seats; step++) {
    const seat = (state.turn + step) % state.seats;
    const bid = sealed.bids[seat] ?? 0;
    if (bid > best) {
      best = bid;
      winner = seat;
    }
  }
  events.push({ type: 'sealedOpen', bids: sealed.bids });
  if (winner !== null) {
    buyField(state, winner, sealed.field, best, events);
    state.paid[sealed.field] = best;
  }
  state.sealed = null;
  settle(state);
}

function nextTurn(state: MarketState, events: GameEvent[]): void {
  let seat = state.turn;
  do {
    seat = (seat + 1) % state.seats;
    if (seat === 0) {
      state.round++;
      if (state.round >= state.rounds) {
        state.phase = 'finished';
        state.turn = 0;
        events.push({ type: 'gameOver' });
        return;
      }
      if (state.round % 2 === 0) beginSeason(state, events);
    }
  } while (state.players[seat]!.gone);
  state.turn = seat;
  state.mustRoll = true;
  state.doubles = 0;
  state.offerUsed = false;
  state.partnerAsked = [];
  state.actions = 0;
  state.dice = null;
  settle(state);
}

function roll(state: MarketState, seat: SeatId, events: GameEvent[]): void {
  const rng = new Rng(state.rng!);
  const a = 1 + Math.floor(rng.next() * 6);
  const b = 1 + Math.floor(rng.next() * 6);
  state.rng = rng.state;
  state.dice = [a, b];
  events.push({ type: 'rolled', seat, a, b });
  const player = state.players[seat]!;
  const double = a === b;

  if (player.jailTurns >= 0) {
    player.jailTurns++;
    state.mustRoll = false;
    if (!double && player.jailTurns < 3) {
      settle(state);
      return;
    }
    if (!double) pay(state, seat, -1, BAIL, events);
    player.jailTurns = -1;
    state.phase = 'end';
    advance(state, seat, a + b, events);
    land(state, seat, events);
    if (state.phase === 'end') settle(state);
    return;
  }

  if (double) {
    state.doubles++;
    if (state.doubles === 3) {
      toJail(state, seat, events);
      settle(state);
      return;
    }
  }
  state.mustRoll = double;
  state.phase = 'end';
  advance(state, seat, a + b, events);
  land(state, seat, events);
  if (state.phase === 'end') settle(state);
}

function resign(state: MarketState, seat: SeatId, events: GameEvent[]): void {
  const player = state.players[seat]!;
  player.gone = true;
  events.push({ type: 'resigned', seat });
  // Die Betriebe werden wieder frei.
  for (let f = 0; f < FIELD_COUNT; f++) {
    if (state.owner[f] !== seat) continue;
    state.owner[f] = -1;
    state.level[f] = 0;
    state.mortgaged[f] = false;
    state.paid[f] = -1;
  }
  state.partners = state.partners.filter((p) => !p.seats.includes(seat));
  state.debts = state.debts.filter((d) => d.from !== seat && d.to !== seat);
  state.fairQueue = state.fairQueue.filter((s) => s !== seat);
  if (activeSeats(state).length < 2) {
    state.phase = 'finished';
    state.auction = null;
    state.sealed = null;
    state.offer = null;
    state.partnerOffer = null;
    return;
  }
  if (state.offer && (state.offer.from === seat || state.offer.to === seat)) state.offer = null;
  if (state.partnerOffer && (state.partnerOffer.from === seat || state.partnerOffer.to === seat)) state.partnerOffer = null;
  if (state.phase === 'reply' && !state.offer && !state.partnerOffer) settle(state);
  if (state.auction) {
    state.auction.active = state.auction.active.filter((s) => s !== seat);
    if (state.auction.leader === seat) {
      state.auction.leader = null;
      state.auction.bid = 0;
    }
    if (state.auction.bidder === seat || state.auction.leader === null) nextBidder(state, events);
    if (state.auction && state.auction.active.length === 0) closeAuction(state, events);
  }
  if (state.sealed) {
    state.sealed.done[seat] = true;
    state.sealed.bids[seat] = 0;
    if (state.sealed.done.every(Boolean)) closeSealed(state, events);
  }
  if (state.turn === seat && state.phase !== 'auction' && state.phase !== 'sealed' && state.phase !== 'finished') {
    if (state.offer || state.partnerOffer) {
      state.offer = null;
      state.partnerOffer = null;
    }
    state.fairQueue = [];
    nextTurn(state, events);
  } else if (state.phase === 'fair' && state.fairQueue.length === 0) settle(state);
}

export function applyMove(prev: MarketState, actor: Actor, move: MarketMove): MoveResult<MarketState> {
  if (actor === 'system' && move.type !== 'resign') throw new Error('Kein Systemzug in Marktplatz.');
  if (actor !== 'system' && move.type !== 'resign' && !isLegal(prev, actor, move)) throw new Error('Unerlaubter Zug.');
  const state: MarketState = structuredClone(prev);
  const events: GameEvent[] = [];
  state.lastCard = null;

  if (move.type === 'resign') {
    resign(state, move.seat, events);
    return { state, events };
  }
  const seat = actor as SeatId;
  const player = state.players[seat]!;

  switch (move.type) {
    case 'roll':
      roll(state, seat, events);
      break;
    case 'payBail':
      player.cash -= BAIL;
      player.jailTurns = -1;
      events.push({ type: 'freed', seat, how: 'bail' });
      break;
    case 'usePardon':
      player.pardon = false;
      state.cardDiscard.push('pardon');
      player.jailTurns = -1;
      events.push({ type: 'freed', seat, how: 'pardon' });
      break;
    case 'buy':
      buyField(state, seat, state.field!, priceOf(state.field!), events);
      settle(state);
      break;
    case 'decline':
      startAuction(state, state.field!, events);
      break;
    case 'bid': {
      const auction = state.auction!;
      auction.bid++;
      auction.leader = seat;
      events.push({ type: 'bid', seat, amount: auction.bid });
      nextBidder(state, events);
      break;
    }
    case 'fold': {
      const auction = state.auction!;
      auction.active = auction.active.filter((s) => s !== seat);
      nextBidder(state, events);
      break;
    }
    case 'sealedBid': {
      const sealed = state.sealed!;
      sealed.bids[seat] = move.amount;
      sealed.done[seat] = true;
      if (sealed.done.every(Boolean)) closeSealed(state, events);
      break;
    }
    case 'errand':
      state.phase = 'end';
      if (move.choice === 'cash') player.cash += 2;
      else {
        advance(state, seat, move.choice, events);
        land(state, seat, events);
      }
      if (state.phase === 'end') settle(state);
      break;
    case 'audience':
      if (move.build === null) player.cash += 4;
      else {
        player.cash -= Math.ceil(buildCost(state, guildOf(move.build)!) / 2);
        state.level[move.build]!++;
        events.push({ type: 'built', seat, field: move.build });
      }
      settle(state);
      break;
    case 'well':
      if (move.field !== null) buyField(state, seat, move.field, priceOf(move.field), events);
      settle(state);
      break;
    case 'build':
      player.cash -= buildCost(state, guildOf(move.field)!);
      state.level[move.field]!++;
      state.actions++;
      events.push({ type: 'built', seat, field: move.field });
      break;
    case 'sellBuild':
      state.level[move.field]!--;
      player.cash += Math.ceil(GUILDS[guildOf(move.field)!]!.build / 2);
      state.actions++;
      break;
    case 'mortgage':
      state.mortgaged[move.field] = true;
      player.cash += Math.ceil(priceOf(move.field) / 2);
      state.actions++;
      events.push({ type: 'mortgaged', seat, field: move.field });
      break;
    case 'redeem':
      player.cash -= redeemCost(move.field);
      state.mortgaged[move.field] = false;
      state.actions++;
      break;
    case 'offer':
      if (state.phase !== 'fair') state.offerUsed = true;
      state.offer = { from: seat, to: move.to, give: move.give, take: move.take, pay: move.pay };
      state.phase = 'reply';
      events.push({ type: 'offered', seat, to: move.to });
      break;
    case 'pass':
      state.fairQueue.shift();
      settle(state);
      break;
    case 'askPartner': {
      const other = partnerOptions(state, seat).find((o) => o.guild === move.guild)!.other;
      state.partnerAsked.push(move.guild);
      state.partnerOffer = { from: seat, to: other, guild: move.guild };
      state.phase = 'reply';
      events.push({ type: 'offered', seat, to: other });
      break;
    }
    case 'accept':
    case 'reject': {
      const accepted = move.type === 'accept';
      if (state.offer) {
        const offer = state.offer;
        // Das Angebot kann durch nichts mehr ungültig werden, solange die Antwort aussteht.
        if (accepted) {
          for (const f of offer.give) state.owner[f] = offer.to;
          for (const f of offer.take) state.owner[f] = offer.from;
          state.players[offer.from]!.cash -= offer.pay;
          state.players[offer.to]!.cash += offer.pay;
        }
        events.push({ type: accepted ? 'traded' : 'refused', seat: offer.from, to: offer.to });
        // Am Jahrmarkt und beim Handelsfrieden ist danach der Nächste dran.
        if (state.fairQueue[0] === offer.from) state.fairQueue.shift();
        state.offer = null;
      } else {
        const offer = state.partnerOffer!;
        if (accepted) {
          state.partners.push({ guild: offer.guild, seats: [offer.from, offer.to] });
          events.push({ type: 'partnered', guild: offer.guild, seats: [offer.from, offer.to] });
        } else events.push({ type: 'refused', seat: offer.from, to: offer.to });
        state.partnerOffer = null;
      }
      settle(state);
      break;
    }
    case 'endTurn':
      nextTurn(state, events);
      break;
  }
  return { state, events };
}

export function result(state: MarketState): Result | null {
  if (state.phase !== 'finished') return null;
  const seats = activeSeats(state);
  const best = Math.max(...seats.map((seat) => worth(state, seat)));
  return { kind: 'win', winners: seats.filter((seat) => worth(state, seat) === best) };
}

export function playerView(state: MarketState, seat: SeatId | 'spectator'): MarketView {
  return {
    ...state,
    rng: null,
    cardDeck: state.cardDeck.map(() => null),
    newsDeck: state.newsDeck.map(() => null),
    players: state.players.map((p, i) => (i === seat ? p : { ...p, pardon: false })),
    sealed: state.sealed && { ...state.sealed, bids: state.sealed.bids.map((bid, i) => (i === seat ? bid : null)) },
  };
}

/** Füllt die verdeckten Stapel mit dem, was noch im Spiel sein kann. */
export function sampleHidden(view: MarketView, seat: SeatId, rng: Rng): MarketState {
  const held = view.players[seat]?.pardon ? ['pardon'] : [];
  const cards = CARDS.filter((c) => !view.cardDiscard.includes(c) && !held.includes(c));
  const news = NEWS.filter((n) => !view.newsUsed.includes(n));
  return {
    ...structuredClone(view),
    rng: rng.state,
    cardDeck: rng.shuffle([...cards]).slice(0, view.cardDeck.length),
    newsDeck: rng.shuffle([...news]).slice(0, view.newsDeck.length),
    sealed: view.sealed && { ...view.sealed, bids: view.sealed.bids.map((bid, i) => (i === seat ? bid : view.sealed!.done[i] ? 0 : null)) },
  };
}

export function timeoutMove(state: MarketState, seat: SeatId): MarketMove {
  switch (state.phase) {
    case 'roll':
      return { type: 'roll' };
    case 'buy':
      return { type: 'decline' };
    case 'auction':
      return { type: 'fold' };
    case 'sealed':
      return { type: 'sealedBid', amount: 0 };
    case 'errand':
      return { type: 'errand', choice: 'cash' };
    case 'audience':
      return { type: 'audience', build: null };
    case 'well':
      return { type: 'well', field: null };
    case 'fair':
      return { type: 'pass' };
    case 'reply':
      return { type: 'reject' };
    default:
      return state.turn === seat ? { type: 'endTurn' } : { type: 'pass' };
  }
}

export function eventView(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null {
  // Den Freibrief behält man verdeckt.
  if (event.type === 'card' && event.card === 'pardon' && event.seat !== seat) return { ...event, card: null };
  return event;
}
