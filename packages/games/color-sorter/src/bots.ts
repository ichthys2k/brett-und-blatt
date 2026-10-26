import type { BotDefinition, BotLevel, Rng } from '@brett-und-blatt/engine';
import { DREAMS, SPELLS } from './content';
import { detectHand, HANDS } from './cards';
import { modDef, SOLO_TABLE, type TableInfo } from './mods';
import { bossFor, legalMoves, MAX_SELECT, sellValue, tableInfo } from './rules';
import { previewHand } from './scoring';
import type { Card, Consumable, HandType, Offer, RunState, SorterMove, SorterState, ViewCard } from './types';
import { COLORS } from './types';

const isOpen = (card: ViewCard | Card): card is Card => !('hidden' in card);

function combos(n: number, max: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, current: number[]) => {
    if (current.length > 0) out.push([...current]);
    if (current.length === max) return;
    for (let i = start; i < n; i++) walk(i + 1, [...current, i]);
  };
  walk(0, []);
  return out;
}

/** Beste spielbare Auswahl nach geschätzten Punkten (verdeckte Karten bleiben außen vor). */
export function bestPlay(run: RunState, table: TableInfo = SOLO_TABLE): { cards: number[]; score: number; type: HandType } | null {
  const hand = run.hand as (Card | ViewCard)[];
  const open = hand.map((c, i) => (isOpen(c) ? i : -1)).filter((i) => i >= 0);
  if (open.length === 0) return null;
  let best: { cards: number[]; score: number; type: HandType } | null = null;
  const boss = run.current?.boss;
  for (const pick of combos(open.length, Math.min(MAX_SELECT, open.length))) {
    const cards = pick.map((k) => open[k]!);
    if (boss === 'spider' && cards.length !== 5 && open.length >= 5) continue;
    const played = cards.map((i) => hand[i] as Card);
    const held = open.filter((i) => !cards.includes(i)).map((i) => hand[i] as Card);
    const { score, type } = previewHand(run, played, held, table);
    const types = run.current?.playedTypes ?? [];
    if (boss === 'snake' && types.includes(type)) continue;
    if (boss === 'lion' && types.length > 0 && types[0] !== type) continue;
    // Bei gleichen Punkten weniger Karten spielen – der Rest bleibt für später.
    if (!best || score > best.score || (score === best.score && cards.length < best.cards.length)) best = { cards, score, type };
  }
  return best;
}

const NASTY_BOSSES = new Set(['cactus', 'croco', 'spider', 'bear', 'ape', 'dragon', 'snake', 'lion', 'unicorn', 'seaSerpent']);

/** Welche Karten wegwerfen? Ziel: Farben-Satz oder Paare stärken. */
function chooseDiscard(run: RunState, level: BotLevel, keep: number[]): number[] {
  const hand = run.hand as (Card | ViewCard)[];
  const open = hand.map((c, i) => (isOpen(c) ? i : -1)).filter((i) => i >= 0);
  if (level !== 'easy') {
    // Farbe mit den meisten Karten sammeln, wenn schon drei da sind.
    const counts = COLORS.map((color) => ({
      color,
      n: open.filter((i) => (hand[i] as Card).color === color && (hand[i] as Card).enh !== 'granite').length,
    }));
    counts.sort((a, b) => b.n - a.n);
    const top = counts[0]!;
    if (top.n >= 3 && top.n < 5) {
      const off = open.filter((i) => (hand[i] as Card).color !== top.color || (hand[i] as Card).enh === 'granite');
      return off.sort((a, b) => (hand[a] as Card).rank - (hand[b] as Card).rank).slice(0, MAX_SELECT);
    }
  }
  const rest = open.filter((i) => !keep.includes(i)).sort((a, b) => (hand[a] as Card).rank - (hand[b] as Card).rank);
  return rest.slice(0, MAX_SELECT);
}

/** Ziele für eine Zauber- oder Traumkarte: die besten bzw. passenden Handkarten. */
function targetsFor(item: Consumable, hand: (Card | ViewCard)[]): number[] | null {
  const [min, max] = item.kind === 'spell' ? SPELLS[item.key]!.targets : item.kind === 'dream' ? DREAMS[item.key]!.targets : [0, 0];
  if (max === 0) return [];
  const open = hand.map((c, i) => (isOpen(c) ? i : -1)).filter((i) => i >= 0);
  if (open.length < min) return null;
  const byRank = [...open].sort((a, b) => (hand[b] as Card).rank - (hand[a] as Card).rank);
  const def = item.kind === 'spell' ? SPELLS[item.key]! : null;
  if (def?.color) {
    const off = open.filter((i) => (hand[i] as Card).color !== def.color);
    return off.length >= min ? off.slice(0, max) : null;
  }
  if (item.key === 'hanged') return byRank.slice(-max);
  if (item.key === 'death') return open.length >= 2 ? [byRank[byRank.length - 1]!, byRank[0]!].sort((a, b) => a - b) : null;
  if (item.key === 'strength') return byRank.filter((i) => (hand[i] as Card).rank < 13).slice(0, max);
  return byRank.slice(0, max);
}

/** Lohnen sich diese Verbrauchsgegenstände ohne Ziel jetzt? */
const SAFE_NO_TARGET = new Set(['hermit', 'temperance', 'priestess', 'emperor', 'judgement', 'fool', 'blackHole', 'soul', 'wheel']);

function useMove(run: RunState, moves: SorterMove[], withTargets: boolean): SorterMove | null {
  for (let index = 0; index < run.consumables.length; index++) {
    const item = run.consumables[index]!;
    if (item.key === '?') continue;
    const cards = withTargets ? targetsFor(item, run.hand) : [];
    if (cards === null) continue;
    if (cards.length === 0 && !SAFE_NO_TARGET.has(item.key)) continue;
    const move = moves.find((m) => m.type === 'use' && m.index === index && m.cards.length === cards.length && m.cards.every((c, i) => c === cards[i]));
    if (move) return move;
  }
  return null;
}

function offerValue(run: RunState, offer: Offer): number {
  if (offer.type === 'mod') {
    const def = modDef(offer.key);
    const rarity = { common: 1, uncommon: 2, rare: 4, legendary: 8 }[def.rarity];
    return rarity * 10 + def.price + (offer.foil ? 5 : 0) - (offer.sticker === 'rental' ? 8 : 0);
  }
  if (offer.type === 'consumable' && offer.item.kind === 'nail') return 6;
  if (offer.type === 'consumable') return 3;
  return 1;
}

function favorite(run: RunState): HandType {
  let best: HandType = 'pair';
  for (const [type, count] of Object.entries(run.handPlays) as [HandType, number][]) if (count > run.handPlays[best]) best = type;
  return best;
}

function shopMove(run: RunState, moves: SorterMove[], level: BotLevel, rng: Rng): SorterMove {
  const reserve = level === 'hard' ? 10 : level === 'medium' ? 3 : 0;
  const use = useMove(run, moves, false);
  if (use) return use;
  const buys = moves.filter((m): m is Extract<SorterMove, { type: 'buy' }> => m.type === 'buy');
  const shop = run.shop!;
  if (level === 'easy' && rng.chance(0.4)) return moves.find((m) => m.type === 'next')!;
  const ranked = buys
    .map((m) => ({ move: m, offer: shop.offers[m.index]! }))
    .filter(({ offer }) => offer.type !== 'consumable' || offer.item.kind !== 'nail' || NAIL_HAND(offer.item.key) === favorite(run) || level !== 'hard')
    .sort((a, b) => offerValue(run, b.offer) - offerValue(run, a.offer));
  for (const { move, offer } of ranked) {
    if (offer.price === 0 || run.tokens - offer.price >= reserve || offer.type === 'mod') return move;
  }
  const tool = moves.find((m) => m.type === 'buyTool');
  if (tool && run.tokens - 10 >= reserve) return tool;
  const pack = moves.find((m) => m.type === 'buyPack' && (shop.packs[m.index]?.price ?? 99) <= run.tokens - reserve && (shop.packs[m.index]?.kind !== 'mods' || run.mods.length < run.modSlots));
  if (pack) return pack;
  // Volle Mod-Leiste: den schwächsten verkaufen, wenn ein deutlich besserer lockt (nur schwer).
  if (level === 'hard' && run.mods.length >= run.modSlots) {
    const better = shop.offers.find((o) => o?.type === 'mod' && o.price <= run.tokens + 3 && modDef(o.key).rarity !== 'common');
    const weakest = run.mods
      .map((m, i) => ({ i, m }))
      .filter(({ m }) => m.sticker !== 'eternal')
      .sort((a, b) => sellValue(a.m) - sellValue(b.m))[0];
    if (better && weakest && modDef(run.mods[weakest.i]!.key).rarity === 'common') {
      const sell = moves.find((m) => m.type === 'sellMod' && m.index === weakest.i);
      if (sell) return sell;
    }
  }
  return moves.find((m) => m.type === 'next')!;
}

function NAIL_HAND(key: string): HandType | null {
  const map: Record<string, HandType> = {
    oil: 'high',
    clearCoat: 'pair',
    french: 'twoPair',
    babyboomer: 'three',
    stiletto: 'straight',
    fullcover: 'flush',
    acrylic: 'fullHouse',
    nailArt: 'four',
    fiberglass: 'straightFlush',
    glitter: 'five',
    rhinestone: 'flushHouse',
    chrome: 'flushFive',
  };
  return map[key] ?? null;
}

function packMove(run: RunState, moves: SorterMove[]): SorterMove {
  const pack = run.pack!;
  const picks = moves.filter((m): m is Extract<SorterMove, { type: 'pick' }> => m.type === 'pick');
  if (picks.length === 0) return moves.find((m) => m.type === 'skipPack')!;
  // Mods nach Wert, Nägel für die Lieblings-Kombi, Zauber mit sinnvollen Zielen.
  let best: { move: SorterMove; value: number } | null = null;
  for (const move of picks) {
    const offer = pack.items[move.index]!;
    let value = offerValue(run, offer);
    if (offer.type === 'consumable' && offer.item.kind !== 'nail') {
      const wanted = targetsFor(offer.item, pack.hand);
      if (wanted === null) continue;
      if (wanted.length === 0 && !SAFE_NO_TARGET.has(offer.item.key)) value -= 5;
      if (wanted.length !== move.cards.length || !wanted.every((c, i) => c === move.cards[i])) continue;
    }
    if (offer.type === 'consumable' && offer.item.kind === 'nail' && NAIL_HAND(offer.item.key) === favorite(run)) value += 5;
    if (!best || value > best.value) best = { move, value };
  }
  return best && best.value > 0 ? best.move : (moves.find((m) => m.type === 'skipPack') ?? picks[0]!);
}

/**
 * Der Farbensortierer-Bot schätzt jede mögliche Auswahl mit der echten Wertung
 * (ohne Zufall) und spielt die beste. Er kennt nur seine Sicht – also nicht die
 * Reihenfolge des Stapels.
 *
 * - leicht: spielt oft nicht die beste Hand, verwirft nie, kauft wahllos
 * - mittel: beste Hand, verwirft, was nicht zählt
 * - schwer: sammelt Farben, hält Token für den Ordnungsbonus, tauscht Mods
 */
export const sorterBot: BotDefinition<SorterState, SorterMove> = {
  id: 'color-sorter',
  name: 'Sortier-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = ctx.view;
    const run = state.runs[ctx.seat]!;
    const moves = legalMoves(state, ctx.seat);
    if (moves.length === 0) throw new Error('Keine Züge');
    const level = ctx.level;

    if (run.phase === 'choose') {
      const use = useMove(run, moves, false);
      if (use) return use;
      // Schwer: lästige Bosse mit Fernrohr oder Satellit neu wählen, wenn genug Token übrig sind.
      const reroll = moves.find((m) => m.type === 'rerollBoss');
      if (reroll && level === 'hard' && NASTY_BOSSES.has(bossFor(state, run)) && run.tokens >= 15) return reroll;
      return moves.find((m) => m.type === 'start')!;
    }
    if (run.phase === 'shop') return shopMove(run, moves, level, ctx.rng);
    if (run.phase === 'pack') return packMove(run, moves);

    // Runde
    const round = run.current!;
    if (level !== 'easy') {
      const use = useMove(run, moves, true);
      if (use) return use;
    }
    const best = bestPlay(run, tableInfo(state, ctx.seat));
    if (!best) return moves.find((m) => m.type === 'play')!;
    if (level === 'easy' && ctx.rng.chance(0.4)) {
      const plays = moves.filter((m) => m.type === 'play');
      return ctx.rng.pick(plays);
    }
    const needed = round.duel ? Infinity : round.target - round.score;
    const canDiscard = round.discardsLeft > 0 && level !== 'easy';
    const weak = HANDS[best.type].mult <= 2;
    const enough = best.score >= needed || best.score * round.handsLeft >= needed * (level === 'hard' ? 1.3 : 1);
    if (canDiscard && !(best.score >= needed) && (!enough || (round.duel && weak) || (weak && round.handsLeft <= 2))) {
      const keep = detectHand(best.cards.map((i) => run.hand[i] as Card)).scoring.map((k) => best.cards[k]!);
      const cards = chooseDiscard(run, level, keep).sort((a, b) => a - b);
      if (cards.length > 0) {
        const move = moves.find((m) => m.type === 'discard' && m.cards.length === cards.length && m.cards.every((c, i) => c === cards[i]));
        if (move) return move;
      }
    }
    const move = moves.find((m) => m.type === 'play' && m.cards.length === best.cards.length && m.cards.every((c, i) => c === best.cards[i]));
    return move ?? moves.find((m) => m.type === 'play')!;
  },
};
