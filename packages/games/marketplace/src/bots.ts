import type { BotDefinition, SeatId } from '@brett-und-blatt/engine';
import { COMMUNITY_FIELDS, FIELD_COUNT, GUILDS, WHOLE_BONUS, guildOf, priceOf } from './board';
import { buildCost, buildableFields, isTradable, legalMoves, redeemCost, rentOf, type MarketMove, type MarketState, type MarketView } from './rules';

/** Wahrscheinlichkeit einer Augensumme mit zwei Würfeln. */
const DICE = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((w) => w / 36);

/** Was ein Betrieb einem Platz über den Listenpreis hinaus wert ist. */
function premium(state: MarketState, seat: SeatId, field: number): number {
  const g = guildOf(field)!;
  if (g === -1) return 1 + COMMUNITY_FIELDS.filter((f) => state.owner[f] === seat).length;
  const others = GUILDS[g]!.fields.filter((f) => f !== field);
  const mine = others.filter((f) => state.owner[f] === seat).length;
  const scale = Math.min(1, (state.rounds - state.round) / 8);
  if (mine === 2) return Math.ceil(priceOf(field) * 0.75 * scale) + WHOLE_BONUS / 2;
  if (mine === 1) return Math.ceil(priceOf(field) * 0.25 * scale);
  return 0;
}

/** Was in den nächsten Würfen im schlimmsten Fall oder im Schnitt zu zahlen wäre. */
function danger(state: MarketState, seat: SeatId): number {
  const pos = state.players[seat]!.pos;
  let expected = 0;
  let worst = 0;
  for (let sum = 2; sum <= 12; sum++) {
    const field = (pos + sum) % FIELD_COUNT;
    if (guildOf(field) === null || state.owner[field] === seat) continue;
    const rent = rentOf(state, field);
    expected += rent * DICE[sum]!;
    worst = Math.max(worst, rent);
  }
  return Math.max(expected * 2, worst * 0.6);
}

/** Schwer: Wie wahrscheinlich landet ein Mitspieler beim nächsten Wurf auf diesem Feld? */
function hitChance(state: MarketState, seat: SeatId, field: number): number {
  let chance = 0;
  state.players.forEach((p, i) => {
    if (i === seat || p.gone || p.jailTurns >= 0) return;
    chance += DICE[(field - p.pos + FIELD_COUNT) % FIELD_COUNT] ?? 0;
  });
  return chance;
}

function reserve(state: MarketState, seat: SeatId, level: string): number {
  if (state.rounds - state.round <= 2) return 1;
  if (level === 'easy') return 8;
  if (level === 'medium') return 5;
  return Math.max(5, Math.ceil(danger(state, seat)));
}

function wantBuy(state: MarketState, seat: SeatId, field: number, level: string): boolean {
  const cash = state.players[seat]!.cash;
  const price = priceOf(field);
  if (cash < price) return false;
  // Haben die anderen wenig in der Kasse, ist die Versteigerung billiger als der Listenpreis.
  if (level !== 'easy') {
    const richest = Math.max(0, ...state.players.map((p, i) => (i === seat || p.gone ? 0 : p.cash)));
    if (richest + 2 < price * 0.7) return false;
  }
  return cash - price >= reserve(state, seat, level) || premium(state, seat, field) >= price * 0.5;
}

/** Sucht ein Angebot, das eine Zunft vollendet: erst Tausch, dann Kauf. */
function findOffer(state: MarketState, seat: SeatId): MarketMove | null {
  const cash = state.players[seat]!.cash;
  for (let g = 0; g < GUILDS.length; g++) {
    const fields = GUILDS[g]!.fields;
    if (fields.filter((f) => state.owner[f] === seat).length !== 2) continue;
    const target = fields.find((f) => state.owner[f] !== seat)!;
    const holder = state.owner[target]!;
    if (holder < 0 || !isTradable(state, target) || state.players[holder]!.gone) continue;
    if (fields.some((f) => state.owner[f] === seat && !isTradable(state, f))) continue;
    for (let h = 0; h < GUILDS.length; h++) {
      if (h === g) continue;
      const theirs = GUILDS[h]!.fields;
      const mine = theirs.find((f) => state.owner[f] === seat);
      if (mine === undefined || theirs.filter((f) => state.owner[f] === holder).length !== 2) continue;
      if (!isTradable(state, mine) || theirs.some((f) => state.owner[f] === holder && !isTradable(state, f))) continue;
      const diff = priceOf(target) - priceOf(mine);
      if (diff > 0 ? cash < diff : state.players[holder]!.cash < -diff) continue;
      return { type: 'offer', to: holder, give: [mine], take: [target], pay: diff };
    }
    const offer = Math.ceil(priceOf(target) * 1.5);
    if (cash - offer >= 2) return { type: 'offer', to: holder, give: [], take: [target], pay: offer };
  }
  return null;
}

function judgeOffer(state: MarketState, seat: SeatId): boolean {
  if (state.partnerOffer) return true;
  const offer = state.offer!;
  const value = (fields: number[], owner: SeatId) => fields.reduce((sum, f) => sum + priceOf(f) + premium(state, owner, f), 0);
  // Was ich bekomme, was ich hergebe; Brezeln zählen voll.
  const gain = value(offer.give, seat) + offer.pay;
  const loss = value(offer.take, seat);
  // Ein Gegner, der eine Zunft vollendet, wird gefährlicher: Das muss sich lohnen.
  const completes = offer.take.some((f) => {
    const g = guildOf(f)!;
    return g >= 0 && GUILDS[g]!.fields.filter((x) => x !== f).every((x) => state.owner[x] === offer.from);
  });
  const mineCompletes = offer.give.some((f) => {
    const g = guildOf(f)!;
    return g >= 0 && GUILDS[g]!.fields.filter((x) => x !== f).every((x) => state.owner[x] === seat);
  });
  return gain >= loss + (completes && !mineCompletes ? Math.ceil(loss * 0.4) : 0);
}

function chooseManage(state: MarketState, seat: SeatId, level: string, moves: MarketMove[]): MarketMove | null {
  const cash = state.players[seat]!.cash;
  const left = state.rounds - state.round;
  const keep = reserve(state, seat, level);
  if (!state.offerUsed && state.options.trade && level !== 'easy') {
    const offer = findOffer(state, seat);
    if (offer) return offer;
  }
  const ask = moves.find((m) => m.type === 'askPartner');
  if (ask) return ask;
  if (level === 'easy') return null;
  if (left > 6) {
    const redeem = moves.find((m) => m.type === 'redeem' && cash - redeemCost(m.field) >= keep + 3);
    if (redeem) return redeem;
  }
  const build = moves
    .filter((m): m is Extract<MarketMove, { type: 'build' }> => m.type === 'build')
    .filter((m) => cash - buildCost(state, guildOf(m.field)!) >= keep + 2)
    .sort((a, b) => (level === 'hard' ? hitChance(state, seat, b.field) - hitChance(state, seat, a.field) : 0) || guildOf(b.field)! - guildOf(a.field)!)[0];
  return build ?? null;
}

export function chooseKraemerMove(view: MarketView, seat: SeatId, level: string, rng: { next(): number }): MarketMove {
  const state = view;
  const moves = legalMoves(state, seat);
  const player = state.players[seat]!;
  // Leicht: spielt zufälliger.
  const sloppy = level === 'easy' && rng.next() < 0.4;

  switch (state.phase) {
    case 'roll': {
      if (player.jailTurns >= 0) {
        if (player.pardon) return { type: 'usePardon' };
        if (player.cash >= 15 && level !== 'easy') return { type: 'payBail' };
      }
      return (!sloppy && chooseManage(state, seat, level, moves)) || { type: 'roll' };
    }
    case 'end':
      return (!sloppy && chooseManage(state, seat, level, moves)) || { type: 'endTurn' };
    case 'buy':
      return !sloppy && wantBuy(state, seat, state.field!, level) ? { type: 'buy' } : { type: 'decline' };
    case 'auction': {
      const auction = state.auction!;
      const worthPaying = level === 'easy' ? Math.floor(priceOf(auction.field) * 0.5) : priceOf(auction.field) + premium(state, seat, auction.field) - 1;
      const limit = Math.min(worthPaying, player.cash - 2);
      return limit > auction.bid ? { type: 'bid' } : { type: 'fold' };
    }
    case 'sealed': {
      const field = state.sealed!.field;
      const want = Math.floor((priceOf(field) + premium(state, seat, field)) * (level === 'easy' ? 0.4 : 0.8));
      return { type: 'sealedBid', amount: Math.max(0, Math.min(want, player.cash - 2)) };
    }
    case 'errand': {
      for (const step of [1, 2, 3] as const) {
        const field = (player.pos + step) % FIELD_COUNT;
        if (guildOf(field) !== null && state.owner[field] === -1 && player.cash >= priceOf(field)) return { type: 'errand', choice: step };
      }
      return { type: 'errand', choice: 'cash' };
    }
    case 'audience': {
      const best = buildableFields(state, seat)
        .filter((f) => player.cash >= Math.ceil(buildCost(state, guildOf(f)!) / 2))
        .sort((a, b) => guildOf(b)! - guildOf(a)!)[0];
      return best !== undefined && GUILDS[guildOf(best)!]!.build >= 4 ? { type: 'audience', build: best } : { type: 'audience', build: null };
    }
    case 'well': {
      const free = moves
        .flatMap((m) => (m.type === 'well' && m.field !== null ? [m.field] : []))
        .sort((a, b) => premium(state, seat, b) - premium(state, seat, a) || priceOf(b) - priceOf(a))[0];
      return free !== undefined && player.cash - priceOf(free) >= reserve(state, seat, level) ? { type: 'well', field: free } : { type: 'well', field: null };
    }
    case 'fair':
      return (level !== 'easy' && findOffer(state, seat)) || { type: 'pass' };
    case 'reply':
      return (level === 'easy' ? rng.next() < 0.3 && judgeOffer(state, seat) : judgeOffer(state, seat)) ? { type: 'accept' } : { type: 'reject' };
    default:
      return moves[0]!;
  }
}

export const kraemerBot: BotDefinition<MarketState, MarketMove, MarketView> = {
  id: 'kraemer',
  name: 'Krämer',
  levels: ['easy', 'medium', 'hard'],
  chooseMove: ({ view, seat, level, rng }) => chooseKraemerMove(view, seat, level, rng),
  delayMs: ({ move }) => (move.type === 'roll' ? 700 : move.type === 'bid' || move.type === 'fold' ? 350 : 500),
};

