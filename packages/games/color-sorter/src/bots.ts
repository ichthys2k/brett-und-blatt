import { Rng, type BotDefinition, type BotLevel } from '@brett-und-blatt/engine';
import { BOSSES, DREAMS, levelTarget, NAILS, SPELLS } from './content';
import { ACE, detectHand, HANDS } from './cards';
import { modDef, SOLO_TABLE, type TableInfo } from './mods';
import { altTag, bossFor, legalMoves, MAX_SELECT, sellValue, tableInfo } from './rules';
import { previewHand } from './scoring';
import type { Card, Consumable, HandType, ModInstance, Offer, PackOffer, RoundState, RunState, SorterMove, SorterState, ViewCard } from './types';
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

const COMBOS: number[][][] = [];
/** Alle Auswahlen aus n Karten (1 bis 5), zwischengespeichert. */
function combosOf(n: number): number[][] {
  return (COMBOS[n] ??= combos(n, Math.min(MAX_SELECT, n)));
}

type Play = { cards: number[]; score: number; type: HandType };

/**
 * Beste Auswahl aus `hand` nach geschätzten Punkten (verdeckte Karten bleiben außen vor).
 * Mit `cycle` spielt der Bot bei gleichen Punkten mehr Karten mit: Was nicht zählt, wird
 * so ohne Verwerfen ausgetauscht – und es bleiben die höheren Karten in der Hand.
 */
function bestFor(run: RunState, hand: (Card | ViewCard)[], table: TableInfo, cycle = false): Play | null {
  const open = hand.map((c, i) => (isOpen(c) ? i : -1)).filter((i) => i >= 0);
  if (open.length === 0) return null;
  let best: Play | null = null;
  let bestKeep = 0;
  const round = run.current;
  const boss = round?.boss;
  const types = round?.playedTypes ?? [];
  for (const pick of combosOf(open.length)) {
    if (boss === 'spider' && pick.length !== 5 && open.length >= 5) continue;
    const cards = pick.map((k) => open[k]!);
    const played = cards.map((i) => hand[i] as Card);
    const held = open.filter((i) => !cards.includes(i)).map((i) => hand[i] as Card);
    const { score, type } = previewHand(run, played, held, table);
    if (boss === 'snake' && types.includes(type)) continue;
    if (boss === 'lion' && types.length > 0 && types[0] !== type) continue;
    const keep = cycle ? held.reduce((s, c) => s + c.rank, 0) : 0;
    const better =
      !best ||
      score > best.score ||
      (score === best.score && (cycle ? cards.length > best.cards.length || (cards.length === best.cards.length && keep > bestKeep) : cards.length < best.cards.length));
    if (better) {
      best = { cards, score, type };
      bestKeep = keep;
    }
  }
  return best;
}

/** Beste spielbare Auswahl nach geschätzten Punkten (verdeckte Karten bleiben außen vor). */
export function bestPlay(run: RunState, table: TableInfo = SOLO_TABLE): Play | null {
  return bestFor(run, run.hand, table);
}

/** Wie sehr Bosse über die Wertung hinaus schaden (Ziehen, Verwerfen, Regeln). */
const BOSS_PENALTY: Record<string, number> = {
  cactus: 3,
  croco: 1.3,
  ghost: 1.3,
  shark: 1.3,
  snake: 1.3,
  lion: 1.3,
  spider: 1.2,
  golem: 1.2,
  seaSerpent: 1.2,
  frog: 1.15,
  owl: 1.15,
  boar: 1.15,
  storm: 1.1,
  phoenix: 1.1,
  lizard: 1.1,
};

// ---------------------------------------------------------------- Schätzen per Stichprobe

/** Rechenrahmen eines Zugs: Zufall, Tisch und Bedenkzeit. */
interface Think {
  rng: Rng;
  table: TableInfo;
  now: () => number;
  end: number;
}

function think(ctx: { rng: Rng; now: () => number; timeBudgetMs: number }, table: TableInfo): Think {
  return { rng: ctx.rng, table, now: ctx.now, end: ctx.now() + ctx.timeBudgetMs };
}

/** Eine gedachte Runde ohne Boss – für Schätzungen im Laden. */
function plainRound(run: RunState): RoundState {
  return { target: 0, score: 0, handsLeft: run.hands, discardsLeft: run.discards, boss: null, duel: false, playedTypes: [], firstDone: true, silenced: false, faceDown: [] };
}

/** Zufällige Probehände aus dem ganzen Deck (für alle Kandidaten dieselben). */
function sampleHands(deck: Card[], size: number, count: number, rng: Rng): Card[][] {
  const out: Card[][] = [];
  for (let n = 0; n < count; n++) out.push(rng.shuffle(deck).slice(0, size));
  return out;
}

/**
 * Feste Probehände je Ladenbesuch: Sonst schwankt die Schätzung von Zug zu Zug, und der Bot
 * verkauft einen Mod, den er eben noch für gut hielt.
 */
function shopSamples(run: RunState, count: number): Card[][] {
  const rng = Rng.fromSeed(`${run.seat}/${run.level}/${run.round}/${run.deck.length}`, 'bot-samples');
  return sampleHands(run.deck, Math.min(run.deck.length, 14), count, rng);
}

const handSizeWith = (run: RunState, mods: ModInstance[]) => run.handSize + mods.reduce((s, m) => s + (m.spent ? 0 : (modDef(m.key).passive?.handSize ?? 0)), 0);

/**
 * Welcher Anteil der Schätzung pro Hand im Spiel wirklich ankommt (gemessen: etwa 40 %,
 * weil der Pool großzügiger ist als Hand und Verwerfen).
 */
const ROUND_SHARE = 0.4;

/** Wie viele Karten man im Lauf einer Runde ungefähr zu sehen bekommt (Hand plus Verwerfen). */
const POOL_EXTRA = 4;

/**
 * Schnelle Schätzung der besten Hand aus einem Kartenpool: statt aller Teilmengen nur die
 * sinnvollen Kombis (höchste Karte, Paare bis Fünfling, Full House, Farben, Straßen).
 */
function quickBest(probe: RunState, pool: Card[], size: number, table: TableInfo, found?: { type: HandType | null }): number {
  const plain = pool.filter((c) => c.enh !== 'granite');
  const sets: Card[][] = [];
  const byRank = new Map<number, Card[]>();
  for (const card of plain) byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
  const groups = [...byRank.values()].sort((a, b) => b.length - a.length || b[0]!.rank - a[0]!.rank);
  const high = [...plain].sort((a, b) => b.rank - a.rank);
  if (high[0]) sets.push([high[0]]);
  const multi = groups.filter((g) => g.length >= 2);
  for (const g of multi.slice(0, 3)) {
    sets.push(g.slice(0, Math.min(5, g.length)));
    if (g.length >= 3) sets.push(g.slice(0, 2));
  }
  if (multi.length >= 2) sets.push([...multi[0]!.slice(0, 2), ...multi[1]!.slice(0, 2)]);
  const trips = groups.find((g) => g.length >= 3);
  const pair = trips && groups.find((g) => g !== trips && g.length >= 2);
  if (trips && pair) sets.push([...trips.slice(0, 3), ...pair.slice(0, 2)]);
  for (const color of COLORS) {
    const same = high.filter((c) => c.color === color || c.enh === 'ombre');
    if (same.length >= 5) sets.push(same.slice(0, 5));
  }
  for (let low = 10; low >= 2; low--) {
    const run5: Card[] = [];
    for (let r = low; r < low + 5; r++) {
      const hit = byRank.get(r);
      if (!hit) break;
      run5.push(hit[0]!);
    }
    if (run5.length === 5) sets.push(run5);
  }
  const round = probe.current;
  const types = round?.playedTypes ?? [];
  let best = 0;
  for (let played of sets) {
    let held = pool.filter((c) => !played.includes(c)).slice(0, Math.max(0, size - played.length));
    // Spinnen-Königin: genau fünf Karten – mit den schwächsten auffüllen.
    if (round?.boss === 'spider' && played.length < 5) {
      const filler = [...held].sort((a, b) => a.rank - b.rank).slice(0, 5 - played.length);
      played = [...played, ...filler];
      held = held.filter((c) => !filler.includes(c));
    }
    const { score, type } = previewHand(probe, played, held, table);
    if (round?.boss === 'snake' && types.includes(type)) continue;
    if (round?.boss === 'lion' && types.length > 0 && types[0] !== type) continue;
    if (score > best) {
      best = score;
      if (found) found.type = type;
    }
  }
  return best;
}

/** Hauptkombi des Teams: die Kombi, die in den Probehänden die meisten Punkte bringt. */
function focusType(run: RunState, hands: Card[][], t: Think): HandType | null {
  const probe: RunState = { ...run, current: plainRound(run) };
  const size = Math.max(1, handSizeWith(run, run.mods));
  const sums = new Map<HandType, number>();
  for (const hand of hands) {
    const found: { type: HandType | null } = { type: null };
    const score = quickBest(probe, hand.slice(0, size + POOL_EXTRA), size, t.table, found);
    if (found.type) sums.set(found.type, (sums.get(found.type) ?? 0) + score);
  }
  let best: HandType | null = null;
  for (const [type, sum] of sums) if (!best || sum > sums.get(best)!) best = type;
  return best;
}

/** Durchschnittliche beste Hand mit diesen Mods und Kombi-Leveln. */
function strength(run: RunState, mods: ModInstance[], hands: Card[][], t: Think, levels = run.handLevels): number {
  const probe: RunState = { ...run, mods, handLevels: levels, current: plainRound(run) };
  const size = Math.max(1, handSizeWith(run, mods));
  let sum = 0;
  for (const hand of hands) sum += quickBest(probe, hand.slice(0, size + POOL_EXTRA), size, t.table);
  return sum / Math.max(1, hands.length);
}

/** Wie viel ein Mod über die gewertete Hand hinaus bringt (Token, Wachstum), als Anteil. */
function extraWorth(key: string, run: RunState): number {
  const early = run.level <= 3 ? 1 : run.level <= 5 ? 0.6 : 0.2;
  switch (key) {
    case 'piggy':
      return 0.2 * early;
    case 'baker':
    case 'sunny':
    case 'tree':
      return 0.04 * early;
    case 'patience':
      return 0.05 * early;
    case 'recycler':
      return 0.04 * early;
    case 'robot':
      return 0.12;
    case 'monkey':
    case 'broccoli':
    case 'snail':
      return 0.1;
    case 'king':
      return run.level <= 6 ? 0.5 : 0.2;
    case 'unicorn':
      return 0.4;
    default:
      return 0;
  }
}

/** Zugewinn eines neuen Mods (Anteil an der bisherigen Stärke). */
function modGain(run: RunState, mods: ModInstance[], offer: Extract<Offer, { type: 'mod' }>, hands: Card[][], base: number, t: Think): number {
  const def = modDef(offer.key);
  const candidate: ModInstance = { uid: -1, key: offer.key, foil: offer.foil, sticker: offer.sticker, value: def.initial };
  let with_ = strength(run, orderMods([...mods, candidate]), hands, t);
  if (def.passive?.hands) with_ *= Math.max(1, run.hands + def.passive.hands) / Math.max(1, run.hands);
  let gain = with_ / Math.max(1, base) - 1 + extraWorth(offer.key, run);
  if (offer.sticker === 'perishable') gain *= 0.5;
  if (offer.sticker === 'rental') gain -= run.level <= 4 ? 0.15 : 0.05;
  if (offer.foil === 'clear') gain += 0.3;
  return gain;
}

/** Was jeder vorhandene Mod beiträgt (Stärke ohne ihn im Vergleich). */
function modShares(run: RunState, hands: Card[][], base: number, t: Think): number[] {
  return run.mods.map((mod, i) => {
    if (mod.spent) return -1;
    const without = strength(
      run,
      run.mods.filter((_, k) => k !== i),
      hands,
      t,
    );
    return 1 - without / Math.max(1, base) + extraWorth(mod.key, run);
  });
}

// ---------------------------------------------------------------- Reihenfolge der Mods

/** Mods, die Mult malnehmen – sie gehören nach rechts, hinter alles, was Mult addiert. */
const TIMES = new Set(['twins', 'family', 'santaFan', 'apple', 'king', 'painter', 'bug', 'earlyBird', 'herald', 'royalCouple']);
const isTimes = (mod: ModInstance) => TIMES.has(mod.key) || mod.foil === 'iris';

function orderMods(mods: ModInstance[]): ModInstance[] {
  return [...mods.filter((m) => !isTimes(m)), ...mods.filter(isTimes)];
}

/** Ein Schritt zur besseren Reihenfolge: einen addierenden Mod vor einen malnehmenden schieben. */
function reorderMove(run: RunState): SorterMove | null {
  for (let i = 1; i < run.mods.length; i++) {
    if (isTimes(run.mods[i - 1]!) && !isTimes(run.mods[i]!)) return { type: 'moveMod', from: i, to: i - 1 };
  }
  return null;
}

// ---------------------------------------------------------------- Verwerfen

/** Welche Karten wegwerfen? Ziel: Farbe oder Paare stärken (Faustregel für mittel). */
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

/** Kandidaten fürs Verwerfen: was man behält – die beste Kombi, eine Farbe, eine Straße, Paare. */
function discardCandidates(run: RunState, best: Play): number[][] {
  const hand = run.hand as (Card | ViewCard)[];
  const open = hand.map((c, i) => (isOpen(c) ? i : -1)).filter((i) => i >= 0);
  const card = (i: number) => hand[i] as Card;
  const keeps: number[][] = [];
  keeps.push(detectHand(best.cards.map(card)).scoring.map((k) => best.cards[k]!));
  for (const color of COLORS) {
    const same = open.filter((i) => card(i).color === color || card(i).enh === 'ombre');
    if (same.length >= 3 && same.length < 5) keeps.push(same);
  }
  for (let low = 2; low <= 10; low++) {
    const picked: number[] = [];
    for (let r = low; r < low + 5; r++) {
      const hit = open.find((i) => card(i).rank === r);
      if (hit !== undefined) picked.push(hit);
    }
    if (picked.length >= 3 && picked.length < 5) keeps.push(picked);
  }
  const counts = new Map<number, number>();
  for (const i of open) counts.set(card(i).rank, (counts.get(card(i).rank) ?? 0) + 1);
  const multiples = open.filter((i) => counts.get(card(i).rank)! >= 2);
  if (multiples.length > 0) keeps.push(multiples);
  keeps.push([...open].sort((a, b) => card(b).rank - card(a).rank).slice(0, 3));
  const highest = Math.max(...counts.values());
  if (highest >= 2) keeps.push(open.filter((i) => counts.get(card(i).rank) === highest));

  // Verdeckte Karten zuerst abwerfen, wenn offene nachkommen (Gespenst nach der ersten Hand, Sturm).
  const round = run.current;
  const redraw = round?.boss === 'storm' || (round?.boss === 'ghost' && round.firstDone);
  const hidden = redraw ? hand.map((c, i) => (isOpen(c) ? -1 : i)).filter((i) => i >= 0) : [];
  const out: number[][] = [];
  const seen = new Set<string>();
  if (hidden.length > 0) keeps.push(open);
  for (const keep of keeps) {
    // Weg kommen die schwächsten Karten außerhalb – höchstens fünf.
    const rest = [...hidden, ...open.filter((i) => !keep.includes(i)).sort((a, b) => card(a).rank - card(b).rank)];
    // Alles außerhalb abwerfen – oder nur die schwächsten zwei, um Optionen zu behalten.
    for (const count of [MAX_SELECT, 2]) {
      const cards = rest.slice(0, count).sort((a, b) => a - b);
      const key = cards.join(',');
      if (cards.length === 0 || seen.has(key)) continue;
      seen.add(key);
      out.push(cards);
    }
  }
  return out;
}

/**
 * Schwer: Verwerfen lohnt, wenn die Hand danach im Schnitt deutlich mehr bringt.
 * Nachgezogen wird per Stichprobe aus dem Stapel (die Sicht kennt seine Zusammensetzung,
 * nicht die Reihenfolge). Bewertet wird höchstens bis zum fehlenden Rest.
 */
function smartDiscard(run: RunState, best: Play | null, needed: number, t: Think): number[] | null {
  const pile = run.pile.length > 0 ? run.pile : [];
  // Ohne erlaubte Kombi (Goldener Löwe, Riesen-Schlange) die Kandidaten ohne Bossregel suchen.
  const free = best ?? bestFor({ ...run, current: run.current && { ...run.current, playedTypes: [] } }, run.hand, t.table);
  if (!free) return null;
  const candidates = discardCandidates(run, free);
  if (candidates.length === 0 || pile.length === 0) return null;
  const capped = (score: number) => Math.min(score, needed);
  const sums = candidates.map(() => 0);
  const counts = candidates.map(() => 0);
  const kept = candidates.map((cards) => run.hand.filter((_, i) => !cards.includes(i)));
  const MIN = 12;
  const MAX = 200;
  for (let n = 0; n < MAX; n++) {
    if (n >= MIN && t.now() > t.end) break;
    candidates.forEach((cards, k) => {
      const drawn = t.rng.shuffle(pile).slice(0, cards.length);
      const hand = [...kept[k]!.filter(isOpen), ...drawn];
      sums[k]! += capped(quickBest(run, hand, hand.length, t.table));
      counts[k]! += 1;
    });
  }
  let bestK = -1;
  // Verwerfen über die Hände verteilen: vor der letzten Hand alles nutzen, sonst nur bei klarem Gewinn.
  const round = run.current!;
  const margin = round.handsLeft <= 1 ? 1.0 : round.discardsLeft >= round.handsLeft ? 1.05 : 1.2;
  // Vergleich mit derselben Schätzung für die Hand, wie sie ist.
  const now = run.hand.filter(isOpen);
  let bestValue = Math.max(capped(best?.score ?? 0), capped(quickBest(run, now, now.length, t.table))) * margin;
  candidates.forEach((_, k) => {
    const value = sums[k]! / Math.max(1, counts[k]!);
    if (value > bestValue) {
      bestValue = value;
      bestK = k;
    }
  });
  return bestK >= 0 ? candidates[bestK]! : null;
}

// ---------------------------------------------------------------- Verbrauchsgegenstände

/** Ziele für eine Zauber- oder Traumkarte: die besten bzw. passenden Handkarten. */
function targetsFor(item: Consumable, hand: (Card | ViewCard)[]): number[] | null {
  const [min, max] = item.kind === 'spell' ? SPELLS[item.key]!.targets : item.kind === 'dream' ? DREAMS[item.key]!.targets : [0, 0];
  if (max === 0) return [];
  const open = hand.map((c, i) => (isOpen(c) ? i : -1)).filter((i) => i >= 0);
  if (open.length < min) return null;
  const byRank = [...open].sort((a, b) => (hand[b] as Card).rank - (hand[a] as Card).rank);
  if (item.kind === 'spell' && item.key === 'dye') {
    // Färberei: Die häufigste Farbe gibt den Ton an, die linke Karte muss sie haben.
    const count = (c: Card['color']) => open.filter((i) => (hand[i] as Card).color === c).length;
    const color = COLORS.reduce((a, b) => (count(b) > count(a) ? b : a));
    const source = open.find((i) => (hand[i] as Card).color === color);
    if (source === undefined) return null;
    const off = open.filter((i) => i > source && (hand[i] as Card).color !== color).slice(0, max - 1);
    return off.length >= min - 1 ? [source, ...off] : null;
  }
  if (item.key === 'hanged') return byRank.slice(-max).sort((a, b) => a - b);
  if (item.key === 'swap') return null;
  if (item.key === 'strength') {
    const up = byRank.find((i) => (hand[i] as Card).rank < ACE);
    return up === undefined ? null : [up];
  }
  return byRank.slice(0, max).sort((a, b) => a - b);
}

/** Lohnen sich diese Verbrauchsgegenstände ohne Ziel jetzt? Nagelstudio-Karten immer. */
const SAFE_NO_TARGET = new Set(['harvest', 'polish', 'priestess', 'judgement', 'fool', 'blackHole', 'soul', 'compass', 'hourglass']);
const safeNow = (item: Consumable) => item.kind === 'nail' || SAFE_NO_TARGET.has(item.key);

function useMove(run: RunState, moves: SorterMove[], withTargets: boolean): SorterMove | null {
  for (let index = 0; index < run.consumables.length; index++) {
    const item = run.consumables[index]!;
    if (item.key === '?') continue;
    const cards = withTargets ? targetsFor(item, run.hand) : [];
    if (cards === null) continue;
    if (cards.length === 0 && !safeNow(item)) continue;
    const move = moves.find((m) => m.type === 'use' && m.index === index && m.cards.length === cards.length && m.cards.every((c, i) => c === cards[i]));
    if (move) return move;
  }
  return null;
}

// ---------------------------------------------------------------- Laden (Faustregeln: leicht, mittel)

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

function simpleShopMove(run: RunState, moves: SorterMove[], level: BotLevel, rng: Rng): SorterMove {
  const reserve = level === 'medium' ? 3 : 0;
  const use = useMove(run, moves, false);
  if (use) return use;
  const buys = moves.filter((m): m is Extract<SorterMove, { type: 'buy' }> => m.type === 'buy');
  const shop = run.shop!;
  if (level === 'easy' && rng.chance(0.4)) return moves.find((m) => m.type === 'next')!;
  const ranked = buys.map((m) => ({ move: m, offer: shop.offers[m.index]! })).sort((a, b) => offerValue(run, b.offer) - offerValue(run, a.offer));
  for (const { move, offer } of ranked) {
    if (offer.price === 0 || run.tokens - offer.price >= reserve || offer.type === 'mod') return move;
  }
  const tool = moves.find((m) => m.type === 'buyTool');
  if (tool && run.tokens - 10 >= reserve) return tool;
  const pack = moves.find((m) => m.type === 'buyPack' && (shop.packs[m.index]?.price ?? 99) <= run.tokens - reserve && (shop.packs[m.index]?.kind !== 'mods' || run.mods.length < run.modSlots));
  if (pack) return pack;
  return moves.find((m) => m.type === 'next')!;
}

// ---------------------------------------------------------------- Laden (schwer: per Stichprobe)

const NAIL_HAND: Record<string, HandType> = Object.fromEntries(Object.values(NAILS).map((n) => [n.key, n.hand]));

/** Ein Kombi-Level mehr – als Anteil an der bisherigen Stärke. */
function nailGain(run: RunState, key: string, hands: Card[][], base: number, t: Think, focus: HandType | null = null): number {
  const type = NAIL_HAND[key];
  if (!type) return 0;
  const levels = { ...run.handLevels, [type]: run.handLevels[type] + 1 };
  const gain = strength(run, run.mods, hands, t, levels) / Math.max(1, base) - 1;
  // Auf eine Kombi setzen: Ihre Stufen tragen weiter als verstreute.
  if (!focus) return gain;
  return type === focus ? gain * 2 : gain * 0.5;
}

/** Was ein Werkzeug ungefähr bringt (Anteil an der Stärke bzw. am Vorankommen). */
function toolGain(run: RunState, key: string, saving: boolean): number {
  switch (key) {
    case 'extraHand':
      return 1 / Math.max(1, run.hands);
    case 'shelf':
      return run.mods.length >= run.modSlots - 1 ? 0.2 : 0.05;
    case 'bag':
      return 0.15;
    case 'diploma':
      return 0.15;
    case 'bin':
      return 0.08;
    case 'book':
      return saving ? 0.15 : 0.03;
    case 'magnet':
    case 'courtHerald':
      return 0.08;
    case 'sale':
      return 0.06;
    case 'tidy':
    case 'breadRight':
      return 0.04;
    default:
      return 0.02;
  }
}

function packGain(run: RunState, pack: PackOffer, free: number): number {
  const big = pack.size === 'normal' ? 1 : 1.4;
  switch (pack.kind) {
    case 'mods':
      return free > 0 ? 0.22 * big : 0;
    case 'nails':
      return 0.2 * big;
    case 'dreams':
      return 0.04 * big;
    case 'spells':
      return 0.03 * big;
    default:
      return 0.01;
  }
}

/** Das nächste Ziel, auf das der Laden vorbereitet: der nächste Boss. */
function nextBossTarget(state: SorterState, run: RunState): number {
  // Nach dem Boss geht es im nächsten Level weiter.
  const level = run.round === 2 ? run.level + 1 : run.level;
  const boss = BOSSES[bossFor(state, { level, bossSwap: run.bossSwap })];
  return levelTarget(level, state.stake) * 2.2 * (boss?.targetFactor ?? 1);
}

function hardShopMove(state: SorterState, run: RunState, moves: SorterMove[], t: Think): SorterMove {
  const use = useMove(run, moves, false);
  if (use) return use;
  const reorder = reorderMove(run);
  if (reorder) return reorder;
  const shop = run.shop!;
  const next = moves.find((m) => m.type === 'next')!;
  const hands = shopSamples(run, 40);
  const base = strength(run, run.mods, hands, t);
  const free = run.modSlots - run.mods.length;
  const focus = focusType(run, hands, t);

  // Sparen nur, wenn das Team für den nächsten Boss reicht: Dann bringt der Ordnungsbonus mehr.
  const roundScore = base * run.hands * ROUND_SHARE;
  const goal = nextBossTarget(state, run);
  const comfort = roundScore / Math.max(1, goal);
  // Erst die Mod-Plätze füllen, dann sparen – früh bringt jeder Mod mehr als der Bonus.
  const settled = free <= 0 && run.level >= 2;
  const reserve = !settled ? 0 : comfort >= 2 ? 24 : comfort >= 1.3 ? 12 : 0;
  const saving = reserve > 0;
  const minGain = free > 0 ? 0.02 : comfort >= 2 ? 0.15 : 0.05;

  type Option = { move: SorterMove; gain: number; price: number; sell?: number };
  const options: Option[] = [];
  const shares = free <= 0 && run.mods.length > 0 ? modShares(run, hands, base, t) : [];
  const weakest = shares
    .map((share, i) => ({ share, i }))
    .filter(({ i }) => run.mods[i]!.sticker !== 'eternal')
    .sort((a, b) => a.share - b.share)[0];

  shop.offers.forEach((offer, index) => {
    if (!offer) return;
    if (offer.type === 'mod') {
      if (free > 0 || offer.foil === 'clear') {
        options.push({ move: { type: 'buy', index }, gain: modGain(run, run.mods, offer, hands, base, t), price: offer.price });
      } else if (weakest) {
        // Volle Leiste: Tausch gegen den schwächsten Mod, wenn der neue klar mehr bringt.
        const rest = run.mods.filter((_, k) => k !== weakest.i);
        const restBase = strength(run, rest, hands, t);
        const gain = ((1 + modGain(run, rest, offer, hands, restBase, t)) * restBase) / Math.max(1, base) - 1;
        const sell = sellValue(run.mods[weakest.i]!);
        if (gain > 0.1) options.push({ move: { type: 'sellMod', index: weakest.i }, gain, price: offer.price - sell, sell: weakest.i });
      }
    } else if (offer.type === 'consumable' && offer.item.kind === 'nail') {
      // Nägel doppelt gewichtet: Kombi-Stufen bleiben und tragen bis Level 8 (gemessen besser).
      options.push({ move: { type: 'buy', index }, gain: 2 * nailGain(run, offer.item.key, hands, base, t, focus), price: offer.price });
    } else if (offer.type === 'consumable' && run.consumables.length < run.consumableSlots) {
      const gain = offer.item.key === 'harvest' ? Math.min(16, 2 * run.bossesBeaten) / 40 : 0.02;
      options.push({ move: { type: 'buy', index }, gain, price: offer.price });
    }
  });
  shop.packs.forEach((pack, index) => {
    if (pack) options.push({ move: { type: 'buyPack', index }, gain: packGain(run, pack, free), price: pack.price });
  });
  const tool = moves.find((m) => m.type === 'buyTool');
  if (tool && shop.tool) options.push({ move: tool, gain: toolGain(run, shop.tool, saving), price: 10 });

  const affordable = options
    .filter((o) => o.gain >= minGain && o.price <= run.tokens && run.tokens - o.price >= Math.min(reserve, run.tokens))
    .filter((o) => moves.some((m) => JSON.stringify(m) === JSON.stringify(o.move)))
    .sort((a, b) => b.gain - a.gain);
  if (affordable[0]) return affordable[0].move;

  // Neu sortieren, wenn noch Platz ist (oder ein schwacher Mod liegt) und genug Token übrig sind.
  const reroll = moves.find((m) => m.type === 'reroll');
  const weakTeam = free > 0 || (weakest !== undefined && weakest.share < 0.35);
  const spare = run.tokens - shop.rerollCost;
  if (reroll && spare >= Math.max(reserve, 6) && (weakTeam || spare >= 30)) return reroll;
  return next;
}

/** Den Mod verkaufen, der am wenigsten beiträgt (schwer per Stichprobe, sonst den billigsten). */
function sellWeakest(run: RunState, level: BotLevel, t: Think): SorterMove | null {
  const sellable = run.mods.map((m, i) => ({ m, i })).filter(({ m }) => m.sticker !== 'eternal');
  if (sellable.length === 0) return null;
  if (level === 'hard') {
    const probe: RunState = { ...run, current: null };
    const hands = shopSamples(probe, 30);
    const shares = modShares(probe, hands, strength(probe, run.mods, hands, t), t);
    sellable.sort((a, b) => shares[a.i]! - shares[b.i]!);
  } else sellable.sort((a, b) => sellValue(a.m) - sellValue(b.m));
  return { type: 'sellMod', index: sellable[0]!.i };
}

/**
 * Wie schwer der Boss dieses Levels für das eigene Team ist (1 = wie eine gewöhnliche Runde):
 * höheres Ziel, gesperrte Farben oder Karten per Stichprobe, dazu ein Aufschlag für Regeln,
 * die sich nicht in der Wertung zeigen.
 */
function bossPain(state: SorterState, run: RunState, t: Think): number {
  const key = bossFor(state, run);
  const boss = BOSSES[key];
  const hands = shopSamples(run, 30);
  const plain = strength(run, run.mods, hands, t);
  const probe: RunState = { ...run, current: { ...plainRound(run), boss: key, silenced: false } };
  const size = Math.max(1, handSizeWith(run, run.mods) - (key === 'owl' ? 1 : 0));
  let sum = 0;
  for (const hand of hands) sum += quickBest(probe, hand.slice(0, size + POOL_EXTRA), size, t.table);
  const hit = sum / Math.max(1, hands.length) / Math.max(1, plain);
  return ((boss?.targetFactor ?? 1) * (BOSS_PENALTY[key] ?? 1)) / Math.max(0.05, hit);
}

/** Was ein Sticker fürs Überspringen wert ist (wie viel von einem guten Mod). */
function tagWorth(run: RunState, tag: string): number {
  const free = run.modSlots - run.mods.length;
  switch (tag) {
    case 'rare':
      return free > 0 ? 1 : 0.5;
    case 'giftBasket':
      return 0.4;
    case 'tutoring':
      return 0.5;
    case 'stock':
      return 0.5;
    case 'coupon':
      return 0.4;
    case 'praise':
      return 0.3;
    case 'bakery':
      return Math.min(10, run.mods.length) / 25;
    default:
      return 0;
  }
}

/**
 * Schwer: Vorhut oder Wächter überspringen (gibt den Zug zurück), wenn der Sticker viel wert ist und das Team
 * die nächste Runde auch ohne Ladenbesuch sicher schafft.
 */
function skipMove(state: SorterState, run: RunState, moves: SorterMove[], t: Think): SorterMove | null {
  if (state.mode !== 'solo' && state.mode !== 'survival' && state.mode !== 'race') return null;
  const offered = state.tags[(run.level - 1) * 2 + run.round];
  const skip = moves.find((m) => m.type === 'skip' && !m.alt);
  const alt = moves.find((m) => m.type === 'skip' && m.alt);
  if (run.level < 2 || !offered || !skip) return null;
  // Wanderbühne: zwischen zwei Gefallen wählen.
  const [move, tag] = alt && tagWorth(run, altTag(offered, run.level)) > tagWorth(run, offered) ? [alt, altTag(offered, run.level)] : [skip, offered];
  if (tagWorth(run, tag) < 0.4) return null;
  const base = strength(run, run.mods, shopSamples(run, 40), t);
  const nextRound = run.round + 1;
  const factor = nextRound === 2 ? 2.2 * (BOSSES[bossFor(state, run)]?.targetFactor ?? 1) : 1.5;
  const target = levelTarget(run.level, state.stake) * factor;
  return base * run.hands * ROUND_SHARE >= target * 1.5 ? move : null;
}

/** Aus einer Lieferung wählen; schwer schätzt Mods und Nägel per Stichprobe. */
function packMove(run: RunState, moves: SorterMove[], level: BotLevel, t: Think): SorterMove {
  const pack = run.pack!;
  const picks = moves.filter((m): m is Extract<SorterMove, { type: 'pick' }> => m.type === 'pick');
  if (picks.length === 0) return moves.find((m) => m.type === 'skipPack')!;
  const smart = level === 'hard' && (pack.kind === 'mods' || pack.kind === 'nails');
  const hands = smart ? shopSamples(run, 40) : [];
  const base = smart ? strength(run, run.mods, hands, t) : 0;
  let best: { move: SorterMove; value: number } | null = null;
  for (const move of picks) {
    const offer = pack.items[move.index]!;
    let value = offerValue(run, offer);
    if (smart && offer.type === 'mod') value = 100 * modGain(run, run.mods, offer, hands, base, t);
    else if (smart && offer.type === 'consumable' && offer.item.kind === 'nail') value = 1 + 100 * nailGain(run, offer.item.key, hands, base, t, focusType(run, hands, t));
    else if (offer.type === 'consumable' && offer.item.kind !== 'nail') {
      const wanted = targetsFor(offer.item, pack.hand);
      if (wanted === null) continue;
      if (wanted.length === 0 && !SAFE_NO_TARGET.has(offer.item.key)) value -= 5;
      if (wanted.length !== move.cards.length || !wanted.every((c, i) => c === move.cards[i])) continue;
    } else if (offer.type === 'consumable' && offer.item.kind === 'nail' && NAIL_HAND[offer.item.key] === favorite(run)) value += 5;
    if (!best || value > best.value) best = { move, value };
  }
  return best && best.value > 0 ? best.move : (moves.find((m) => m.type === 'skipPack') ?? picks[0]!);
}

/**
 * Der Narrenhof-Bot schätzt jede mögliche Auswahl mit der echten Wertung
 * (ohne Zufall) und spielt die beste. Er kennt nur seine Sicht – also nicht die
 * Reihenfolge des Stapels.
 *
 * - leicht: spielt oft nicht die beste Hand, verwirft nie, kauft wahllos
 * - mittel: beste Hand, verwirft nach Faustregeln, kauft nach Seltenheit
 * - schwer: bewertet Mods, Nägel und Verwerfen per Stichprobe, ordnet die Mods,
 *   spart erst für den Ordnungsbonus, wenn das Team für den nächsten Boss reicht
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
    const t = think(ctx, tableInfo(state, ctx.seat));

    if (level === 'hard' && run.phase !== 'pack') {
      const reorder = reorderMove(run);
      if (reorder) return reorder;
    }
    if (run.phase === 'choose') {
      const use = useMove(run, moves, false);
      if (use) return use;
      // Schwer: lästige Bosse mit Fernrohr oder Satellit neu wählen, wenn genug Token übrig sind.
      const reroll = moves.find((m) => m.type === 'rerollBoss');
      if (reroll && level === 'hard' && run.tokens >= 10 && bossPain(state, run, t) >= 2.5) return reroll;
      const skip = level === 'hard' ? skipMove(state, run, moves, t) : null;
      if (skip) return skip;
      return moves.find((m) => m.type === 'start')!;
    }
    if (run.phase === 'shop') return level === 'hard' ? hardShopMove(state, run, moves, t) : simpleShopMove(run, moves, level, ctx.rng);
    if (run.phase === 'pack') return packMove(run, moves, level, t);

    // Runde
    const round = run.current!;
    if (level !== 'easy') {
      const use = useMove(run, moves, true);
      if (use) return use;
    }
    const hidden = run.hand.map((c, i) => (isOpen(c) ? -1 : i)).filter((i) => i >= 0);
    const needed = round.duel ? Infinity : round.target - round.score;
    const canDiscard = round.discardsLeft > 0 && level !== 'easy';
    const findMove = (type: 'play' | 'discard', cards: number[]) => moves.find((m) => m.type === type && m.cards.length === cards.length && m.cards.every((c, i) => c === cards[i]));
    const best = bestFor(run, run.hand, t.table, level === 'hard');
    // See-Schlange: Erst zählt nichts, bis ein Mod verkauft ist – den schwächsten abgeben.
    if (round.silenced && level !== 'easy') {
      const sell = sellWeakest(run, level, t);
      if (sell) return sell;
    }
    if (!best) {
      // Keine Kombi zählt (Bossregel): verwerfen, um eine passende zu finden. Sind alle Karten
      // verdeckt (Schloss-Gespenst), zieht Verwerfen nur wieder verdeckte – dann blind spielen.
      if (canDiscard && hidden.length < run.hand.length) {
        const cards = level === 'hard' ? smartDiscard(run, null, needed, t) : chooseDiscard(run, level, []).sort((a, b) => a - b);
        const move = cards && findMove('discard', cards);
        if (move) return move;
      }
      return findMove('play', hidden.slice(0, MAX_SELECT)) ?? moves.find((m) => m.type === 'play')!;
    }
    if (level === 'easy' && ctx.rng.chance(0.4)) {
      const plays = moves.filter((m) => m.type === 'play');
      return ctx.rng.pick(plays);
    }
    if (level === 'hard') {
      if (canDiscard && best.score < needed) {
        const cards = smartDiscard(run, best, needed, t);
        const move = cards && findMove('discard', cards);
        if (move) return move;
      }
    } else {
      const weak = HANDS[best.type].mult <= 2;
      const enough = best.score >= needed || best.score * round.handsLeft >= needed;
      if (canDiscard && !(best.score >= needed) && (!enough || (round.duel && weak) || (weak && round.handsLeft <= 2))) {
        const keep = detectHand(best.cards.map((i) => run.hand[i] as Card)).scoring.map((k) => best.cards[k]!);
        const cards = chooseDiscard(run, level, keep).sort((a, b) => a - b);
        const move = cards.length > 0 && findMove('discard', cards);
        if (move) return move;
      }
    }
    // Verdeckte Karten blind mitspielen: Vielleicht ergänzen sie die Kombi.
    if (hidden.length > 0 && level !== 'easy' && best.score < needed && round.boss !== 'spider' && !run.mods.some((m) => m.key === 'e404')) {
      const move = findMove('play', [...best.cards, ...hidden.slice(0, MAX_SELECT - best.cards.length)].sort((a, b) => a - b));
      if (move) return move;
    }
    return findMove('play', best.cards) ?? moves.find((m) => m.type === 'play')!;
  },
};
