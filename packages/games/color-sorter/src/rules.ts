import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import { ACE, HAND_TYPES, HANDS, handLabel, isFace, JACK, standardDeck } from './cards';
import {
  BOSS_LIST,
  BOSS_REROLL_PRICE,
  BOSSES,
  DREAM_KEYS,
  DREAMS,
  FOILS,
  levelTarget,
  NAIL_FOR_HAND,
  NAIL_KEYS,
  NAILS,
  PACK_SIZE_WEIGHTS,
  PACK_SIZES,
  PACK_WEIGHTS,
  RARE_DREAMS,
  SPELL_KEYS,
  SPELLS,
  TAG_KEYS,
  TOOL_KEYS,
  TOOL_PRICE,
  TOOLS,
} from './content';
import { MOD_KEYS, modDef, RARITY_INFO, type TableInfo } from './mods';
import { decodeUnlocks, lockedFor, type PoolChoice } from './unlocks';
import { favoriteHand, isDebuffed, scoreHand } from './scoring';
import type {
  Card,
  Color,
  Consumable,
  Enhancement,
  Foil,
  GameMode,
  HandType,
  ModInstance,
  Offer,
  OpenPack,
  PackKind,
  PackOffer,
  PackSize,
  Rarity,
  RoundIndex,
  RunState,
  Seal,
  Shop,
  SorterMove,
  SorterState,
  Sticker,
  ViewCard,
} from './types';
import { COLORS } from './types';

/** Level, nach dessen Boss ein Lauf gewonnen ist (Solo, Überleben, Wettrennen). */
export const FINAL_LEVEL = 8;
export const MAX_SELECT = 5;

// ---------------------------------------------------------------- Aufbau

export function setup(seats: number, options: Options, seed: string): SorterState {
  const mode: GameMode = seats === 1 ? 'solo' : ((options.mode as GameMode) ?? 'duel');
  const stake = Math.min(8, Math.max(1, Number(options.stake ?? 1)));
  const pool = (['mine', 'base', 'all'].includes(options.pool ?? '') ? options.pool : 'mine') as PoolChoice;
  const locked = lockedFor(pool, decodeUnlocks(options.unlocks ?? ''));
  // Ein gesperrter Kartensatz wird zum Standard-Satz (die Einrichtung weist darauf hin).
  const deckKind = locked.includes(`deck:${options.deck}`) ? 'standard' : (options.deck ?? 'standard');
  const endless = options.endless === 'on' && (mode === 'solo' || mode === 'survival');
  const keyRng = Rng.fromSeed(seed, 'partie');
  const key = Array.from({ length: 4 }, () => keyRng.int(65536).toString(16).padStart(4, '0')).join('');
  const lives = mode === 'duel' || mode === 'showdown' ? Number(options.lives ?? 4) : 1;

  // Bosse und Sticker hängen nur am Seed: Alle bekommen dieselben.
  const bossRng = Rng.fromSeed(seed, 'bosse');
  const bosses: string[] = [];
  const used = new Set<string>();
  for (let level = 1; level <= 40; level++) {
    const final = level % FINAL_LEVEL === 0;
    let pool = BOSS_LIST.filter((b) => !!b.final === final && b.minLevel <= level && !used.has(b.key));
    if (pool.length === 0) {
      for (const b of BOSS_LIST) if (!!b.final === final) used.delete(b.key);
      pool = BOSS_LIST.filter((b) => !!b.final === final && b.minLevel <= level);
    }
    const boss = bossRng.pick(pool);
    used.add(boss.key);
    bosses.push(boss.key);
  }
  const tagRng = Rng.fromSeed(seed, 'sticker');
  const tags = Array.from({ length: 80 }, () => tagRng.pick(TAG_KEYS));

  // Gleicher Seed für jeden Platz: alle ziehen dieselben Karten, solange sie gleich handeln.
  const deal = Rng.fromSeed(seed, 'karten').state;
  const shop = Rng.fromSeed(seed, 'laden').state;
  const fx = Rng.fromSeed(seed, 'effekte').state;
  const ids = new Rng(Rng.fromSeed(seed, 'kennungen').state).shuffle([...Array(52).keys()]);

  const runs: RunState[] = Array.from({ length: seats }, (_, seat) => {
    const deck = standardDeck().map((card, i): Card => ({ ...card, id: ids[i]! }));
    const run: RunState = {
      seat,
      phase: 'choose',
      level: 1,
      round: 0,
      tokens: deckKind === 'yellow' ? 14 : 4,
      deck,
      pile: [],
      hand: [],
      handSize: 8,
      hands: 4 + (deckKind === 'blue' ? 1 : 0) - (deckKind === 'black' ? 1 : 0),
      discards: 3 + (deckKind === 'red' ? 1 : 0) - (stake >= 5 ? 1 : 0),
      mods: [],
      modSlots: 5 + (deckKind === 'black' ? 1 : 0),
      consumables:
        deckKind === 'magic'
          ? [
              { kind: 'spell', key: 'fool' },
              { kind: 'spell', key: 'fool' },
            ]
          : [],
      consumableSlots: 2 + (deckKind === 'magic' ? 1 : 0),
      handLevels: Object.fromEntries(HAND_TYPES.map((t) => [t, 1])) as Record<HandType, number>,
      handPlays: Object.fromEntries(HAND_TYPES.map((t) => [t, 0])) as Record<HandType, number>,
      tools: deckKind === 'magic' ? ['basket'] : [],
      stickers: [],
      shop: null,
      pack: null,
      current: null,
      lastPayout: null,
      lastSpell: null,
      playedThisLevel: [],
      lastHandType: null,
      toolOffer: null,
      lives,
      nextId: 100,
      nextUid: 1,
      rng: { deal, shop, fx },
      bestHand: 0,
      bossesBeaten: 0,
      bossSwap: null,
      duelsWon: 0,
      discardsUsed: 0,
      livesLost: 0,
    };
    return run;
  });

  const state: SorterState = {
    mode,
    deckKind,
    stake,
    bosses,
    tags,
    runs,
    duel: null,
    winners: null,
    lastDuel: null,
    outCount: 0,
    key,
    endless,
    locked,
  };
  for (const run of runs) {
    const rng = new Rng(run.rng.shop);
    run.toolOffer = pickTool(state, run, rng);
    run.rng.shop = rng.state;
  }
  return state;
}

// ---------------------------------------------------------------- Hilfen

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Ist die Boss-Runde dieses Levels ein Duell? */
export function isDuelLevel(state: Pick<SorterState, 'mode'>, level: number): boolean {
  if (state.mode === 'duel') return level >= 2;
  if (state.mode === 'showdown') return level >= 4;
  return false;
}

function passive(run: RunState, field: 'handSize' | 'hands' | 'discards'): number {
  return run.mods.reduce((sum, m) => sum + (m.spent ? 0 : (modDef(m.key).passive?.[field] ?? 0)), 0);
}

export function effectiveHandSize(run: RunState): number {
  const owl = run.current?.boss === 'owl' ? 1 : 0;
  return Math.max(1, run.handSize + passive(run, 'handSize') - owl);
}

export function modCapacity(run: RunState): number {
  return run.modSlots + run.mods.filter((m) => m.foil === 'clear').length;
}

export function freeModSlots(run: RunState): number {
  return modCapacity(run) - run.mods.length;
}

export function sellValue(mod: ModInstance): number {
  if (mod.sticker === 'rental') return 1;
  const def = modDef(mod.key);
  return Math.max(1, Math.floor((def.price + (mod.foil ? FOILS[mod.foil].price : 0)) / 2)) + (mod.extraSell ?? 0);
}

function discount(run: RunState): number {
  return run.tools.includes('sale') ? 0.25 : 0;
}

function priced(run: RunState, base: number): number {
  return Math.max(1, Math.floor(base * (1 - discount(run))));
}

export function rerollCost(run: RunState): number {
  return run.shop?.rerollCost ?? 5;
}

function rerollBase(run: RunState): number {
  return Math.max(0, 5 - (run.tools.includes('tidy') ? 2 : 0));
}

function weighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r < 0) return item;
  }
  return items[items.length - 1]![0];
}

function pickTool(state: SorterState, run: RunState, rng: Rng): string | null {
  const pool = TOOL_KEYS.filter((k) => !run.tools.includes(k) && !state.locked.includes(`tool:${k}`));
  return pool.length ? rng.pick(pool) : null;
}

/** Mods, die in dieser Partie vorkommen können: freigeschaltet und zur Spielart passend. */
function modAllowed(state: SorterState, key: string): boolean {
  const def = modDef(key);
  if (def.multi && !def.multi.includes(state.mode)) return false;
  return !state.locked.includes(`mod:${key}`);
}

function pickModKey(state: SorterState, run: RunState, rng: Rng, rarity?: Rarity): string {
  const r =
    rarity ??
    weighted<Rarity>(rng, [
      ['common', RARITY_INFO.common.weight],
      ['uncommon', RARITY_INFO.uncommon.weight],
      ['rare', RARITY_INFO.rare.weight],
    ]);
  const owned = new Set(run.mods.map((m) => m.key));
  // Gibt es in dieser Seltenheit nichts Freigeschaltetes, kommt die nächstgewöhnlichere dran – nie etwas Gesperrtes.
  const order: Rarity[] = ['legendary', 'rare', 'uncommon', 'common'];
  for (const rarity of order.slice(order.indexOf(r))) {
    const allowed = MOD_KEYS.filter((k) => modDef(k).rarity === rarity && modAllowed(state, k));
    if (allowed.length === 0) continue;
    const pool = allowed.filter((k) => !owned.has(k));
    return rng.pick(pool.length ? pool : allowed);
  }
  return rng.pick(MOD_KEYS.filter((k) => modDef(k).rarity === r && !modDef(k).multi));
}

function rollFoil(rng: Rng): Foil | undefined {
  const r = rng.next();
  if (r < 0.003) return 'clear';
  if (r < 0.009) return 'iris';
  if (r < 0.037) return 'holo';
  if (r < 0.077) return 'hot';
  return undefined;
}

function rollSticker(stake: number, rng: Rng): Sticker | undefined {
  if (stake >= 4 && rng.chance(0.3)) return 'eternal';
  if (stake >= 7 && rng.chance(0.3)) return 'perishable';
  if (stake >= 8 && rng.chance(0.3)) return 'rental';
  return undefined;
}

function modOffer(state: SorterState, run: RunState, rng: Rng, rarity?: Rarity): Offer {
  const key = pickModKey(state, run, rng, rarity);
  const foil = rollFoil(rng);
  const sticker = rollSticker(state.stake, rng);
  const base = modDef(key).price + (foil ? FOILS[foil].price : 0);
  const offer: Offer = {
    type: 'mod',
    key,
    price: sticker === 'rental' ? 1 : priced(run, base),
  };
  if (foil) offer.foil = foil;
  if (sticker) offer.sticker = sticker;
  return offer;
}

function nailPool(run: RunState): string[] {
  return NAIL_KEYS.filter((k) => {
    const hand = NAILS[k]!.hand;
    return !['five', 'flushHouse', 'flushFive'].includes(hand) || run.handPlays[hand] > 0;
  });
}

function randomCard(run: RunState, rng: Rng, opts: { rank?: number; enhanced?: boolean } = {}): Card {
  const card: Card = {
    id: run.nextId++,
    rank: opts.rank ?? 2 + rng.int(13),
    color: rng.pick(COLORS),
  };
  const enhancements: Enhancement[] = ['granite', 'volume', 'gloss', 'ombre', 'gold', 'blond', 'keratin', 'star'];
  if (opts.enhanced || rng.chance(0.4)) card.enh = rng.pick(enhancements);
  if (rng.chance(0.15)) card.foil = rng.pick<Foil>(['hot', 'holo', 'iris']);
  if (rng.chance(0.15)) card.seal = rng.pick<Seal>(['gold', 'red', 'blue', 'purple']);
  return card;
}

function makeShop(state: SorterState, run: RunState): Shop {
  const rng = new Rng(run.rng.shop);
  const count = 2 + (run.tools.includes('magnet') ? 1 : 0);
  const offers: Offer[] = [];
  for (let i = 0; i < count; i++) {
    const kind = weighted<'mod' | 'spell' | 'nail'>(rng, [
      ['mod', 20],
      ['spell', 4],
      ['nail', 4],
    ]);
    if (kind === 'mod') offers.push(modOffer(state, run, rng));
    else if (kind === 'spell')
      offers.push({
        type: 'consumable',
        item: { kind: 'spell', key: rng.pick(SPELL_KEYS) },
        price: priced(run, 3),
      });
    else
      offers.push({
        type: 'consumable',
        item: { kind: 'nail', key: rng.pick(nailPool(run)) },
        price: priced(run, 3),
      });
  }
  // Sticker aus dem Überspringen wirken im nächsten Laden.
  const stickers = [...run.stickers];
  const take = (key: string) => {
    const i = stickers.indexOf(key);
    if (i < 0) return false;
    stickers.splice(i, 1);
    return true;
  };
  if (take('rare')) offers.unshift({ ...modOffer(state, run, rng, 'rare'), price: 0 });
  // Hofherold: Die Übung der meistgespielten Kombi liegt immer bereit.
  if (run.tools.includes('courtHerald'))
    offers.push({
      type: 'consumable',
      item: { kind: 'nail', key: NAIL_FOR_HAND[favoriteHand(run) ?? 'pair'] },
      price: priced(run, 3),
    });
  const packs: PackOffer[] = [];
  for (let i = 0; i < 2; i++) {
    const kind = weighted<PackKind>(rng, PACK_WEIGHTS);
    const size = weighted<PackSize>(rng, PACK_SIZE_WEIGHTS);
    packs.push({ kind, size, price: priced(run, PACK_SIZES[size].price) });
  }
  if (take('coupon')) for (const o of offers.slice(0, 2)) o.price = 0;
  run.stickers = stickers;
  run.rng.shop = rng.state;
  return { offers, packs, tool: run.toolOffer, rerollCost: rerollBase(run) };
}

function rerollShop(state: SorterState, run: RunState): void {
  const shop = run.shop!;
  const rng = new Rng(run.rng.shop);
  const count = shop.offers.length;
  const offers: Offer[] = [];
  for (let i = 0; i < count; i++) {
    const kind = weighted<'mod' | 'spell' | 'nail'>(rng, [
      ['mod', 20],
      ['spell', 4],
      ['nail', 4],
    ]);
    if (kind === 'mod') offers.push(modOffer(state, run, rng));
    else if (kind === 'spell')
      offers.push({
        type: 'consumable',
        item: { kind: 'spell', key: rng.pick(SPELL_KEYS) },
        price: priced(run, 3),
      });
    else
      offers.push({
        type: 'consumable',
        item: { kind: 'nail', key: rng.pick(nailPool(run)) },
        price: priced(run, 3),
      });
  }
  run.rng.shop = rng.state;
  run.shop = { ...shop, offers, rerollCost: shop.rerollCost + 1 };
}

function openPack(state: SorterState, run: RunState, kind: PackKind, size: PackSize, returnTo: OpenPack['returnTo']): OpenPack {
  const rng = new Rng(run.rng.shop);
  const n = PACK_SIZES[size].items[kind];
  const items: Offer[] = [];
  const distinct = (pool: string[]) => rng.shuffle(pool).slice(0, n);
  if (kind === 'mods') {
    for (let i = 0; i < n; i++) items.push({ ...modOffer(state, run, rng), price: 0 });
  } else if (kind === 'spells') {
    for (const key of distinct(SPELL_KEYS))
      items.push({
        type: 'consumable',
        item: { kind: 'spell', key },
        price: 0,
      });
  } else if (kind === 'nails') {
    for (const key of distinct(nailPool(run))) items.push({ type: 'consumable', item: { kind: 'nail', key }, price: 0 });
  } else if (kind === 'dreams') {
    for (const key of distinct(DREAM_KEYS))
      items.push({
        type: 'consumable',
        item: {
          kind: 'dream',
          key: rng.chance(0.03) ? rng.pick(RARE_DREAMS) : key,
        },
        price: 0,
      });
  } else {
    for (let i = 0; i < n; i++) items.push({ type: 'card', card: randomCard(run, rng), price: 0 });
  }
  run.rng.shop = rng.state;
  // Zauber und Träume wirken sofort: Dafür liegen Karten aus dem Deck bereit wie eine Hand.
  let hand: Card[] = [];
  if (kind === 'spells' || kind === 'dreams') {
    const fx = new Rng(run.rng.fx);
    hand = fx.shuffle(run.deck).slice(0, effectiveHandSize(run));
    run.rng.fx = fx.state;
  }
  return { kind, items, picksLeft: PACK_SIZES[size].picks, hand, returnTo };
}

// ---------------------------------------------------------------- Karten ändern

function updateCard(run: RunState, id: number, change: (card: Card) => Card): void {
  const swap = (list: Card[]) => list.map((c) => (c.id === id ? change({ ...c }) : c));
  run.deck = swap(run.deck);
  run.hand = swap(run.hand);
  run.pile = swap(run.pile);
  if (run.pack) run.pack.hand = swap(run.pack.hand);
}

function destroyCards(run: RunState, ids: number[]): void {
  const gone = new Set(ids);
  run.deck = run.deck.filter((c) => !gone.has(c.id));
  run.hand = run.hand.filter((c) => !gone.has(c.id));
  run.pile = run.pile.filter((c) => !gone.has(c.id));
  if (run.pack) run.pack.hand = run.pack.hand.filter((c) => !gone.has(c.id));
}

/** Neue Karten kommen ins Deck – und während einer Runde gleich auf die Hand. */
function addCards(run: RunState, cards: Card[]): void {
  run.deck = [...run.deck, ...cards];
  if (run.phase === 'play') run.hand = [...run.hand, ...cards];
}

function addMod(run: RunState, key: string, extra: Partial<ModInstance> = {}): boolean {
  if (freeModSlots(run) <= 0 && extra.foil !== 'clear') return false;
  const def = modDef(key);
  const mod: ModInstance = { uid: run.nextUid++, key, ...extra };
  if (def.initial !== undefined) mod.value = def.initial;
  if (mod.sticker === 'perishable') mod.roundsLeft = 5;
  for (const k of Object.keys(mod) as (keyof ModInstance)[]) if (mod[k] === undefined) delete mod[k];
  // Das Hofäffchen ist eifersüchtig: Jeder neue Mod nimmt ihm alles.
  run.mods = [...run.mods.map((m) => (m.key === 'monkey' && m.value ? { ...m, value: 0 } : m)), mod];
  return true;
}

function addConsumable(run: RunState, item: Consumable): boolean {
  if (run.consumables.length >= run.consumableSlots) return false;
  run.consumables = [...run.consumables, item];
  return true;
}

function levelUp(run: RunState, hand: HandType, by = 1): void {
  run.handLevels = {
    ...run.handLevels,
    [hand]: Math.max(1, run.handLevels[hand] + by),
  };
}

// ---------------------------------------------------------------- Runden

function drawCards(run: RunState, events: GameEvent[]): void {
  const target = effectiveHandSize(run);
  const round = run.current!;
  const boss = round.boss;
  const fx = new Rng(run.rng.fx);
  const drawn: number[] = [];
  while (run.hand.length < target && run.pile.length > 0) {
    const [card, ...rest] = run.pile;
    run.pile = rest;
    run.hand = [...run.hand, card!];
    drawn.push(card!.id);
    let hidden = false;
    if (boss === 'ghost' && !round.firstDone) hidden = true;
    if (boss === 'frog' && card!.enh !== 'granite' && isFace(card!.rank)) hidden = true;
    if (boss === 'shark' && round.firstDone) hidden = true;
    if (boss === 'storm' && fx.chance(1 / 7)) hidden = true;
    if (hidden) round.faceDown = [...round.faceDown, card!.id];
  }
  run.rng.fx = fx.state;
  if (drawn.length) events.push({ type: 'drawn', seat: run.seat, count: drawn.length });
}

/** Boss eines Levels – für alle gleich, außer jemand hat ihn neu gewählt. */
export function bossFor(state: Pick<SorterState, 'bosses'>, run: Pick<RunState, 'level' | 'bossSwap'>): string {
  if (run.bossSwap && run.bossSwap.level === run.level) return run.bossSwap.key;
  return state.bosses[(run.level - 1) % state.bosses.length]!;
}

/** Darf der Boss gerade neu gewählt werden? */
export function canRerollBoss(state: SorterState, run: RunState): boolean {
  if (run.phase !== 'choose' || run.round !== 2 || isDuelLevel(state, run.level)) return false;
  if (run.tokens < BOSS_REROLL_PRICE) return false;
  return run.tools.includes('scope') && !(run.bossSwap && run.bossSwap.level === run.level);
}

function rerollBoss(state: SorterState, run: RunState, events: GameEvent[]): void {
  const current = bossFor(state, run);
  const final = run.level % FINAL_LEVEL === 0;
  const pool = BOSS_LIST.filter((b) => !!b.final === final && b.minLevel <= run.level && b.key !== current);
  const rng = new Rng(run.rng.shop);
  const key = rng.pick(pool).key;
  run.rng.shop = rng.state;
  run.tokens -= BOSS_REROLL_PRICE;
  run.bossSwap = {
    level: run.level,
    key,
    count: (run.bossSwap?.level === run.level ? run.bossSwap.count : 0) + 1,
  };
  events.push({ type: 'bossRerolled', seat: run.seat, boss: key });
}

/** Öffentliche Lage am Tisch für die Mehrspieler-Mods. */
export function tableInfo(state: SorterState, seat: SeatId): TableInfo {
  if (state.runs.length < 2) return { others: 0, behind: 0 };
  const alive = state.runs.filter((r) => r.phase !== 'out');
  const leader = Math.max(...state.runs.map((r) => r.level));
  return {
    others: alive.filter((r) => r.seat !== seat).length,
    behind: Math.max(0, leader - state.runs[seat]!.level),
  };
}

/** Nimmt einen Gefallen aus dem Vorrat, wenn er da ist. */
function takeSticker(run: RunState, key: string): boolean {
  const i = run.stickers.indexOf(key);
  if (i < 0) return false;
  run.stickers = run.stickers.filter((_, k) => k !== i);
  return true;
}

function startRound(state: SorterState, run: RunState, duel: boolean, events: GameEvent[]): void {
  let boss = !duel && run.round === 2 ? bossFor(state, run) : null;
  // Maskenball und Kompass: Die Herrschaft kommt ohne Marotte (und ohne Zielaufschlag).
  const calm = boss && takeSticker(run, 'masquerade') ? boss : undefined;
  if (calm) boss = null;
  const praise = !duel && takeSticker(run, 'praise') ? 0.75 : 1;
  const factor = ROUND_FACTORS[run.round]! * (boss ? (BOSSES[boss]?.targetFactor ?? 1) : 1) * praise;
  const hands = Math.max(1, run.hands + passive(run, 'hands') + (run.tools.includes('extraHand') ? 1 : 0) + (takeSticker(run, 'hourglass') ? 1 : 0));
  const discards = Math.max(0, run.discards + passive(run, 'discards') + (run.tools.includes('bin') ? 1 : 0));
  run.current = {
    target: duel ? 0 : Math.round(levelTarget(run.level, state.stake) * factor),
    score: 0,
    handsLeft: boss === 'cactus' ? 1 : hands,
    discardsLeft: boss === 'croco' ? 0 : discards,
    startDiscards: boss === 'croco' ? 0 : discards,
    boss,
    duel,
    playedTypes: [],
    firstDone: false,
    silenced: boss === 'seaSerpent',
    faceDown: [],
    ...(calm ? { calm } : {}),
  };
  const rng = new Rng(run.rng.deal);
  run.pile = rng.shuffle(run.deck);
  run.rng.deal = rng.state;
  run.hand = [];
  run.phase = 'play';
  if (boss === 'phoenix') shuffleMods(run);
  events.push({
    type: 'roundStart',
    seat: run.seat,
    level: run.level,
    round: run.round,
    boss,
    duel,
    target: run.current.target,
  });
  drawCards(run, events);
}

function shuffleMods(run: RunState): void {
  const fx = new Rng(run.rng.fx);
  run.mods = fx.shuffle(run.mods);
  run.rng.fx = fx.state;
}

/** Zielfaktor je Runde: Vorhut, Wächter, Boss. */
export const ROUND_FACTORS = [1, 1.5, 2.2];
/** Grundbelohnung je Runde in Token. */
export const ROUND_REWARDS = [3, 4, 6];
/** Ordnungsbonus: 1 T je so viele T im Vorrat … */
export const BONUS_STEP = 6;

/** … höchstens so viele (mit Sparbuch mehr). */
export function bonusCap(run: RunState): number {
  return run.tools.includes('book') ? 8 : 4;
}

/** Abrechnung nach einer gewonnenen Runde, danach in die Sortier-Zentrale. */
function winRound(state: SorterState, run: RunState, events: GameEvent[]): void {
  const round = run.current!;
  const green = state.deckKind === 'green';
  const reward = round.duel ? 5 : run.round === 0 && state.stake >= 2 ? 0 : ROUND_REWARDS[run.round]!;
  const hands = round.handsLeft * (green ? 2 : 1) + (green ? round.discardsLeft : 0);
  const bonus = green ? 0 : Math.min(bonusCap(run), Math.floor(Math.max(0, run.tokens) / BONUS_STEP));
  let extra = 0;

  // Karten, die in der Hand geblieben sind.
  for (const card of run.hand) {
    if (isDebuffed(card, run)) continue;
    if (card.enh === 'gold') extra += 3;
    if (card.seal === 'blue' && run.lastHandType)
      addConsumable(run, {
        kind: 'nail',
        key: NAIL_FOR_HAND[run.lastHandType],
      });
  }
  // Mods am Rundenende.
  const mods: ModInstance[] = [];
  for (const mod of run.mods) {
    let next: ModInstance | null = { ...mod };
    if (!mod.spent) {
      const end = modDef(mod.key).onRoundEnd?.(mod, run);
      if (end?.tokens) extra += end.tokens;
      if (end && 'mod' in end) next = end.mod ?? null;
    }
    if (next?.sticker === 'rental') extra -= 3;
    if (next?.sticker === 'perishable' && !next.spent) {
      next.roundsLeft = (next.roundsLeft ?? 5) - 1;
      if (next.roundsLeft <= 0) next.spent = true;
    }
    if (next) mods.push(next);
  }
  run.mods = mods;
  // Festschmaus: +3 je gewonnene Audienz bis einschließlich zum nächsten Thronsaal.
  if (run.stickers.includes('stock')) extra += 3;
  if (run.round === 2) {
    run.bossesBeaten++;
    takeSticker(run, 'stock');
  }
  // Brotrecht: +1, wenn in dieser Audienz nicht getauscht wurde.
  if (run.tools.includes('breadRight') && round.discardsLeft >= (round.startDiscards ?? 0)) extra += 1;
  const payout = { reward, hands, bonus, extra };
  run.tokens += reward + hands + bonus + extra;
  run.lastPayout = payout;
  events.push({
    type: 'roundWon',
    seat: run.seat,
    level: run.level,
    round: run.round,
    payout,
    score: round.score,
  });
  finishRound(state, run, events);
}

function finishRound(state: SorterState, run: RunState, events: GameEvent[]): void {
  run.hand = [];
  run.pile = [];
  const wasLast = run.round === 2;
  run.current = null;
  if (wasLast && run.level >= FINAL_LEVEL && (state.mode === 'solo' || state.mode === 'survival' || state.mode === 'race')) {
    if (!state.endless || state.mode === 'race') {
      run.phase = 'won';
      return;
    }
    if (run.level === FINAL_LEVEL) events.push({ type: 'cleared', seat: run.seat, level: run.level });
  }
  run.shop = makeShop(state, run);
  run.phase = 'shop';
}

/** Zweite Chance: löst sich auf, statt dass ein Leben verloren geht. */
function saveBySecondChance(run: RunState, events: GameEvent[]): boolean {
  const mod = run.mods.find((m) => m.key === 'secondChance' && !m.spent);
  if (!mod) return false;
  run.mods = run.mods.filter((m) => m.uid !== mod.uid);
  events.push({ type: 'saved', seat: run.seat, uid: mod.uid });
  return true;
}

function loseRound(state: SorterState, run: RunState, events: GameEvent[]): void {
  if (state.mode !== 'solo' && saveBySecondChance(run, events)) {
    run.lastPayout = { reward: 0, hands: 0, bonus: 0, extra: 0 };
    finishRound(state, run, events);
    return;
  }
  run.lives -= 1;
  run.livesLost += 1;
  events.push({
    type: 'roundLost',
    seat: run.seat,
    level: run.level,
    round: run.round,
    lives: run.lives,
    score: run.current?.score ?? 0,
  });
  if (run.lives <= 0) {
    knockOut(state, run, events);
    return;
  }
  // Mehrspieler mit Leben: weiter in die Zentrale, ohne Belohnung.
  run.lastPayout = { reward: 0, hands: 0, bonus: 0, extra: 0 };
  finishRound(state, run, events);
}

function knockOut(state: SorterState, run: RunState, events: GameEvent[]): void {
  run.phase = 'out';
  run.current = null;
  run.hand = [];
  run.pile = [];
  run.shop = null;
  run.pack = null;
  state.outCount += 1;
  run.outAt = state.outCount;
  events.push({ type: 'out', seat: run.seat });
}

/** Nach dem Laden: nächste Runde bzw. nächstes Level. */
function advance(state: SorterState, run: RunState, events: GameEvent[]): void {
  run.shop = null;
  if (run.round === 2) {
    run.level += 1;
    run.round = 0;
    run.playedThisLevel = [];
    const rng = new Rng(run.rng.shop);
    run.toolOffer = pickTool(state, run, rng);
    run.rng.shop = rng.state;
  } else {
    run.round = (run.round + 1) as RoundIndex;
  }
  enterRound(state, run, events);
}

/** Vor einer Runde: auswählen – oder am Treffpunkt aufs Duell warten. */
function enterRound(state: SorterState, run: RunState, events: GameEvent[]): void {
  if (run.round === 2 && isDuelLevel(state, run.level)) {
    run.phase = 'wait';
    events.push({ type: 'waiting', seat: run.seat, level: run.level });
  } else {
    run.phase = 'choose';
  }
}

/** Treffpunkt: Sind alle da, beginnt das Duell; sind alle fertig, wird abgerechnet. */
function settleMeeting(state: SorterState, events: GameEvent[]): void {
  for (let guard = 0; guard < 4; guard++) {
    const alive = state.runs.filter((r) => r.phase !== 'out');
    if (alive.length < 2 || !alive.every((r) => r.phase === 'wait')) return;
    const level = Math.max(...alive.map((r) => r.level));
    if (!alive.every((r) => r.level === level)) return;
    if (!state.duel) {
      state.duel = { level, scores: state.runs.map(() => null) };
      events.push({
        type: 'duelStart',
        level,
        seats: alive.map((r) => r.seat),
      });
      for (const run of alive) startRound(state, run, true, events);
      return;
    }
    const scores = state.duel.scores;
    if (!alive.every((r) => scores[r.seat] !== null)) return;
    const values = alive.map((r) => scores[r.seat]!);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const losers = min === max ? [] : alive.filter((r) => scores[r.seat] === min).map((r) => r.seat);
    state.lastDuel = { level, scores: [...scores], losers };
    state.duel = null;
    events.push({ type: 'duelResult', level, scores: [...scores], losers });
    for (const run of alive) {
      run.current = {
        target: 0,
        score: scores[run.seat] ?? 0,
        handsLeft: 0,
        discardsLeft: 0,
        boss: null,
        duel: true,
        playedTypes: [],
        firstDone: true,
        silenced: false,
        faceDown: [],
      };
      if (losers.length && !losers.includes(run.seat)) run.duelsWon += 1;
      if (losers.includes(run.seat) && !saveBySecondChance(run, events)) {
        run.lives -= 1;
        run.livesLost += 1;
        events.push({ type: 'lifeLost', seat: run.seat, lives: run.lives });
        if (run.lives <= 0) {
          knockOut(state, run, events);
          continue;
        }
      }
      winRound(state, run, events);
    }
    return;
  }
}

function progress(run: RunState): number {
  return (run.phase === 'won' ? 1_000_000 : 0) + run.level * 10_000 + run.round * 1_000 + (run.outAt ?? 999);
}

function checkEnd(state: SorterState, events: GameEvent[]): void {
  if (state.winners) return;
  const runs = state.runs;
  const finished = (r: RunState) => r.phase === 'out' || r.phase === 'won';
  let winners: SeatId[] | null = null;
  if (state.mode === 'solo') {
    if (finished(runs[0]!)) winners = runs[0]!.phase === 'won' || runs[0]!.level > FINAL_LEVEL ? [0] : [];
  } else if (state.mode === 'duel' || state.mode === 'showdown') {
    const alive = runs.filter((r) => r.phase !== 'out');
    if (alive.length === 1) winners = [alive[0]!.seat];
    else if (alive.length === 0) {
      const last = Math.max(...runs.map((r) => r.outAt ?? 0));
      winners = runs.filter((r) => r.outAt === last).map((r) => r.seat);
    }
  } else if (state.mode === 'race') {
    const won = runs.filter((r) => r.phase === 'won');
    if (won.length) winners = won.map((r) => r.seat);
    else if (runs.every(finished)) winners = best(runs);
  } else if (runs.every(finished)) {
    winners = best(runs);
  }
  if (winners) {
    state.winners = winners;
    events.push({ type: 'gameOver', winners });
  }
}

function best(runs: RunState[]): SeatId[] {
  const top = Math.max(...runs.map(progress));
  return runs.filter((r) => progress(r) === top).map((r) => r.seat);
}

// ---------------------------------------------------------------- Zauber, Nägel, Träume

function useConsumable(state: SorterState, run: RunState, item: Consumable, targets: Card[], events: GameEvent[]): void {
  const fx = new Rng(run.rng.fx);
  const shopRng = new Rng(run.rng.shop);
  if (item.kind === 'nail') {
    levelUp(run, NAILS[item.key]!.hand, run.tools.includes('diploma') ? 2 : 1);
    run.lastSpell = item;
  } else if (item.kind === 'spell') {
    const def = SPELLS[item.key]!;
    if (def.enhance) for (const t of targets) updateCard(run, t.id, (c) => ({ ...c, enh: def.enhance }));
    switch (item.key) {
      case 'fool':
        if (run.lastSpell && !(run.lastSpell.kind === 'spell' && run.lastSpell.key === 'fool')) addConsumable(run, run.lastSpell);
        break;
      case 'hierophant':
        run.tokens += 2;
        break;
      case 'dye': {
        const [source, ...rest] = targets;
        for (const t of rest) updateCard(run, t.id, (c) => ({ ...c, color: source!.color }));
        break;
      }
      case 'strength': {
        const [up, down] = targets;
        if (up) updateCard(run, up.id, (c) => ({ ...c, rank: Math.min(ACE, c.rank + 1) }));
        if (down) updateCard(run, down.id, (c) => ({ ...c, rank: Math.max(2, c.rank - 1) }));
        break;
      }
      case 'swap': {
        const [left, right] = targets;
        if (left && right) {
          updateCard(run, left.id, (c) => ({ ...c, rank: right.rank }));
          updateCard(run, right.id, (c) => ({ ...c, rank: left.rank }));
        }
        break;
      }
      case 'hanged':
        destroyCards(
          run,
          targets.map((t) => t.id),
        );
        run.tokens += targets.length;
        break;
      case 'harvest':
        run.tokens += Math.min(16, 2 * run.bossesBeaten);
        break;
      case 'polish': {
        const target = run.mods.find((m) => !m.foil);
        if (target) run.mods = run.mods.map((m) => (m.uid === target.uid ? { ...m, foil: 'holo' as Foil } : m));
        break;
      }
      case 'priestess':
        addConsumable(run, { kind: 'nail', key: NAIL_FOR_HAND[favoriteHand(run) ?? 'pair'] });
        break;
      case 'judgement':
        addMod(run, pickModKey(state, run, shopRng, 'common'));
        break;
    }
    if (item.key !== 'fool') run.lastSpell = item;
  } else {
    const hand = run.phase === 'pack' ? (run.pack?.hand ?? []) : run.hand;
    const destroyRandom = (n: number) => {
      const ids = fx.shuffle(hand.map((c) => c.id)).slice(0, n);
      destroyCards(run, ids);
    };
    switch (item.key) {
      case 'familyPhoto':
        destroyRandom(1);
        addCards(
          run,
          [0, 1, 2].map(() => randomCard(run, fx, { rank: JACK + fx.int(3), enhanced: true })),
        );
        break;
      case 'snowman':
        destroyRandom(1);
        addCards(
          run,
          [0, 1].map(() => randomCard(run, fx, { rank: ACE, enhanced: true })),
        );
        break;
      case 'numbers':
        destroyRandom(1);
        addCards(
          run,
          [0, 1, 2, 3].map(() => randomCard(run, fx, { rank: 2 + fx.int(9), enhanced: true })),
        );
        break;
      case 'crestBook':
        for (const t of targets)
          updateCard(run, t.id, (c) => ({
            ...c,
            seal: fx.pick<Seal>(['gold', 'red', 'blue', 'purple']),
          }));
        break;
      case 'aura':
        for (const t of targets)
          updateCard(run, t.id, (c) => ({
            ...c,
            foil: fx.pick<Foil>(['hot', 'holo', 'iris']),
          }));
        break;
      case 'spook':
        addMod(run, pickModKey(state, run, shopRng, 'rare'));
        run.tokens = 0;
        break;
      case 'swirl': {
        const color = fx.pick(COLORS);
        for (const c of hand) updateCard(run, c.id, (x) => ({ ...x, color }));
        break;
      }
      case 'bubble': {
        const plain = run.mods.filter((m) => !m.foil);
        if (plain.length) {
          const target = fx.pick(plain);
          run.mods = run.mods.map((m) => (m.uid === target.uid ? { ...m, foil: 'clear' } : m));
        }
        run.handSize = Math.max(1, run.handSize - 1);
        break;
      }
      case 'cleanup':
        destroyRandom(5);
        run.tokens += 20;
        break;
      case 'magicMirror': {
        const [first, ...others] = run.mods;
        if (first) {
          const leaving = others.filter((m) => m.sticker !== 'eternal');
          const gone = leaving.length ? fx.pick(leaving).uid : null;
          const copy: ModInstance = { ...first, uid: run.nextUid++ };
          if (copy.foil === 'clear') delete copy.foil;
          run.mods = [...run.mods.filter((m) => m.uid !== gone), copy];
        }
        break;
      }
      case 'hourglass':
        run.stickers = [...run.stickers, 'hourglass'];
        run.handSize = Math.max(1, run.handSize - 1);
        break;
      case 'compass':
        run.stickers = [...run.stickers, 'masquerade'];
        break;
      case 'soul':
        addMod(run, pickModKey(state, run, shopRng, 'legendary'));
        break;
      case 'blackHole':
        for (const type of HAND_TYPES) levelUp(run, type);
        break;
    }
  }
  run.rng.fx = fx.state;
  run.rng.shop = shopRng.state;
  events.push({
    type: 'used',
    seat: run.seat,
    item,
    targets: targets.map((t) => t.id),
  });
}

function targetsOf(item: Consumable): [number, number] {
  if (item.kind === 'spell') return SPELLS[item.key]!.targets;
  if (item.kind === 'dream') return DREAMS[item.key]!.targets;
  return [0, 0];
}

/** Braucht die Karte Handkarten, die es gerade nicht gibt? */
function canUse(run: RunState, item: Consumable, hand: Card[], targetCount: number): boolean {
  const [min, max] = targetsOf(item);
  if (targetCount < min || targetCount > max) return false;
  if (min > 0 && hand.length === 0) return false;
  if (item.kind === 'spell' && item.key === 'judgement' && freeModSlots(run) <= 0) return false;
  if (item.kind === 'spell' && item.key === 'polish' && !run.mods.some((m) => !m.foil)) return false;
  if (item.kind === 'dream' && (item.key === 'spook' || item.key === 'soul') && freeModSlots(run) <= 0) return false;
  if (item.kind === 'dream' && item.key === 'magicMirror' && (run.mods.length === 0 || (freeModSlots(run) <= 0 && !run.mods.slice(1).some((m) => m.sticker !== 'eternal')))) return false;
  if (item.kind === 'spell' && item.key === 'fool' && (!run.lastSpell || (run.lastSpell.kind === 'spell' && run.lastSpell.key === 'fool'))) return false;
  return true;
}

// ---------------------------------------------------------------- Züge

const ACTIVE = new Set(['choose', 'play', 'shop', 'pack']);

export function currentPlayers(state: SorterState): Actor[] {
  if (state.winners) return [];
  return state.runs.filter((r) => ACTIVE.has(r.phase)).map((r) => r.seat);
}

function subsets(n: number, min: number, max: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, current: number[]) => {
    if (current.length >= min && current.length > 0) out.push([...current]);
    if (current.length === max) return;
    for (let i = start; i < n; i++) walk(i + 1, [...current, i]);
  };
  walk(0, []);
  if (min === 0) out.unshift([]);
  return out;
}

export function legalMoves(state: SorterState, actor: Actor): SorterMove[] {
  if (state.winners || actor === 'system') return [];
  const run = state.runs[actor];
  if (!run || !ACTIVE.has(run.phase)) return [];
  const moves: SorterMove[] = [];
  const handCount = run.hand.length;

  const common = () => {
    run.consumables.forEach((item, index) => {
      const [min, max] = targetsOf(item);
      const hand = run.phase === 'play' ? run.hand : [];
      for (const cards of subsets(hand.length, min, max)) if (canUse(run, item, hand, cards.length)) moves.push({ type: 'use', index, cards });
      moves.push({ type: 'sellConsumable', index });
    });
    run.mods.forEach((mod, index) => {
      if (mod.sticker !== 'eternal') moves.push({ type: 'sellMod', index });
      if (index > 0) moves.push({ type: 'moveMod', from: index, to: index - 1 });
    });
  };

  if (run.phase === 'choose') {
    moves.push({ type: 'start' });
    if (run.round < 2) {
      moves.push({ type: 'skip' });
      if (run.tools.includes('touringStage')) moves.push({ type: 'skip', alt: true });
    }
    if (canRerollBoss(state, run)) moves.push({ type: 'rerollBoss' });
    common();
  } else if (run.phase === 'play') {
    for (const cards of subsets(handCount, 1, Math.min(MAX_SELECT, handCount))) {
      moves.push({ type: 'play', cards });
      if (run.current!.discardsLeft > 0) moves.push({ type: 'discard', cards });
    }
    if (handCount > 1) moves.push({ type: 'sortHand', by: 'rank' }, { type: 'sortHand', by: 'color' });
    common();
  } else if (run.phase === 'shop') {
    const shop = run.shop!;
    shop.offers.forEach((offer, index) => {
      if (offer && canBuy(run, offer)) moves.push({ type: 'buy', index });
    });
    shop.packs.forEach((pack, index) => {
      if (pack && run.tokens >= pack.price) moves.push({ type: 'buyPack', index });
    });
    if (shop.tool && run.tokens >= priced(run, TOOL_PRICE)) moves.push({ type: 'buyTool' });
    if (run.tokens >= shop.rerollCost) moves.push({ type: 'reroll' });
    common();
    moves.push({ type: 'next' });
  } else if (run.phase === 'pack') {
    const pack = run.pack!;
    pack.items.forEach((offer, index) => {
      for (const cards of pickTargets(run, offer)) moves.push({ type: 'pick', index, cards });
    });
    moves.push({ type: 'skipPack' });
  }
  return moves;
}

function canBuy(run: RunState, offer: Offer): boolean {
  if (run.tokens < offer.price) return false;
  if (offer.type === 'mod') return freeModSlots(run) > 0 || offer.foil === 'clear';
  if (offer.type === 'consumable') return offer.item.kind === 'nail' || run.consumables.length < run.consumableSlots;
  return true;
}

/** Mögliche Ziel-Auswahlen beim Nehmen aus einer Lieferung; leer, wenn das Nehmen nicht geht. */
function pickTargets(run: RunState, offer: Offer): number[][] {
  if (offer.type === 'mod') return freeModSlots(run) > 0 || offer.foil === 'clear' ? [[]] : [];
  if (offer.type === 'card') return [[]];
  const hand = run.pack?.hand ?? [];
  const [min, max] = targetsOf(offer.item);
  return subsets(hand.length, min, max).filter((cards) => canUse(run, offer.item, hand, cards.length));
}

function validSelection(cards: unknown, length: number, min: number, max: number): cards is number[] {
  if (!Array.isArray(cards) || cards.length < min || cards.length > max) return false;
  if (!cards.every((i) => Number.isInteger(i) && i >= 0 && i < length)) return false;
  return new Set(cards).size === cards.length;
}

export function isLegal(state: SorterState, actor: Actor, move: SorterMove): boolean {
  if (state.winners || actor === 'system' || typeof move !== 'object' || move === null) return false;
  const run = state.runs[actor];
  if (!run || !ACTIVE.has(run.phase)) return false;
  const phase = run.phase;
  switch (move.type) {
    case 'start':
      return phase === 'choose';
    case 'skip':
      return phase === 'choose' && run.round < 2;
    case 'rerollBoss':
      return canRerollBoss(state, run);
    case 'play':
      return phase === 'play' && validSelection(move.cards, run.hand.length, 1, MAX_SELECT);
    case 'discard':
      return phase === 'play' && run.current!.discardsLeft > 0 && validSelection(move.cards, run.hand.length, 1, MAX_SELECT);
    case 'sortHand':
      return phase === 'play' && (move.by === 'rank' || move.by === 'color');
    case 'use': {
      if (phase === 'pack') return false;
      const item = run.consumables[move.index];
      const hand = phase === 'play' ? run.hand : [];
      return !!item && validSelection(move.cards, hand.length, 0, 5) && canUse(run, item, hand, move.cards.length);
    }
    case 'sellConsumable':
      return phase !== 'pack' && !!run.consumables[move.index];
    case 'sellMod':
      return phase !== 'pack' && !!run.mods[move.index] && run.mods[move.index]!.sticker !== 'eternal';
    case 'moveMod':
      return phase !== 'pack' && Number.isInteger(move.from) && Number.isInteger(move.to) && !!run.mods[move.from] && move.to >= 0 && move.to < run.mods.length && move.from !== move.to;
    case 'buy': {
      const offer = run.shop?.offers[move.index];
      return phase === 'shop' && !!offer && canBuy(run, offer);
    }
    case 'buyPack': {
      const pack = run.shop?.packs[move.index];
      return phase === 'shop' && !!pack && run.tokens >= pack.price;
    }
    case 'buyTool':
      return phase === 'shop' && !!run.shop?.tool && run.tokens >= priced(run, TOOL_PRICE);
    case 'reroll':
      return phase === 'shop' && run.tokens >= rerollCost(run);
    case 'next':
      return phase === 'shop';
    case 'pick': {
      const offer = run.pack?.items[move.index];
      if (phase !== 'pack' || !offer) return false;
      return pickTargets(run, offer).some((cards) => cards.length === move.cards?.length && cards.every((c, i) => c === [...move.cards].sort((a, b) => a - b)[i]));
    }
    case 'skipPack':
      return phase === 'pack';
    default:
      return false;
  }
}

export function applyMove(state: SorterState, actor: Actor, move: SorterMove): MoveResult<SorterState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist gerade nicht erlaubt.');
  const next = clone(state);
  const run = next.runs[actor as SeatId]!;
  const events: GameEvent[] = [];
  const seat = run.seat;

  switch (move.type) {
    case 'start':
      startRound(next, run, false, events);
      break;
    case 'rerollBoss':
      rerollBoss(next, run, events);
      break;
    case 'skip': {
      const offered = next.tags[(run.level - 1) * 2 + run.round] ?? 'bakery';
      const tag = move.alt ? altTag(offered, run.level) : offered;
      events.push({ type: 'skipped', seat, tag });
      run.round = (run.round + 1) as RoundIndex;
      enterRound(next, run, events);
      applyTag(next, run, tag, events);
      break;
    }
    case 'play':
      playHand(
        next,
        run,
        [...move.cards].sort((a, b) => a - b),
        events,
      );
      break;
    case 'discard':
      discardCards(
        next,
        run,
        [...move.cards].sort((a, b) => a - b),
        events,
      );
      break;
    case 'sortHand': {
      const hidden = new Set(run.current?.faceDown ?? []);
      const open = run.hand.filter((c) => !hidden.has(c.id));
      const closed = run.hand.filter((c) => hidden.has(c.id));
      const key = (c: Card) => (c.enh === 'granite' ? -1 : c.rank);
      const colorKey = (c: Card) => (c.enh === 'granite' ? 9 : COLORS.indexOf(c.color));
      open.sort(move.by === 'rank' ? (a, b) => key(b) - key(a) || colorKey(a) - colorKey(b) : (a, b) => colorKey(a) - colorKey(b) || key(b) - key(a));
      run.hand = [...open, ...closed];
      break;
    }
    case 'use': {
      const item = run.consumables[move.index]!;
      run.consumables = run.consumables.filter((_, i) => i !== move.index);
      const targets = [...move.cards].sort((a, b) => a - b).map((i) => run.hand[i]!);
      useConsumable(next, run, item, targets, events);
      break;
    }
    case 'sellConsumable':
      run.consumables = run.consumables.filter((_, i) => i !== move.index);
      run.tokens += 1;
      events.push({ type: 'sold', seat, value: 1 });
      break;
    case 'sellMod': {
      const mod = run.mods[move.index]!;
      run.mods = run.mods.filter((_, i) => i !== move.index);
      run.tokens += sellValue(mod);
      if (run.current) run.current.silenced = false;
      events.push({ type: 'sold', seat, uid: mod.uid, value: sellValue(mod) });
      break;
    }
    case 'moveMod': {
      const mods = [...run.mods];
      const [mod] = mods.splice(move.from, 1);
      mods.splice(move.to, 0, mod!);
      run.mods = mods;
      break;
    }
    case 'buy': {
      const offer = run.shop!.offers[move.index]!;
      run.tokens -= offer.price;
      run.shop!.offers = run.shop!.offers.map((o, i) => (i === move.index ? null : o));
      if (offer.type === 'mod') addMod(run, offer.key, modExtras(offer));
      else if (offer.type === 'card') addCards(run, [offer.card]);
      else if (offer.item.kind === 'nail') useConsumable(next, run, offer.item, [], events);
      else addConsumable(run, offer.item);
      events.push({ type: 'bought', seat, offer });
      break;
    }
    case 'buyPack': {
      const pack = run.shop!.packs[move.index]!;
      run.tokens -= pack.price;
      run.shop!.packs = run.shop!.packs.map((p, i) => (i === move.index ? null : p));
      run.pack = openPack(next, run, pack.kind, pack.size, 'shop');
      run.phase = 'pack';
      events.push({
        type: 'packOpened',
        seat,
        kind: pack.kind,
        size: pack.size,
        items: run.pack.items,
      });
      break;
    }
    case 'buyTool': {
      const key = run.shop!.tool!;
      run.tokens -= priced(run, TOOL_PRICE);
      run.tools = [...run.tools, key];
      run.toolOffer = null;
      run.shop!.tool = null;
      if (key === 'bag') run.handSize += 1;
      if (key === 'basket') run.consumableSlots += 1;
      if (key === 'shelf') {
        run.modSlots += 1;
        run.handSize = Math.max(1, run.handSize - 1);
      }
      if (key === 'tidy') run.shop!.rerollCost = Math.max(0, run.shop!.rerollCost - 2);
      events.push({ type: 'toolBought', seat, key });
      break;
    }
    case 'reroll':
      run.tokens -= rerollCost(run);
      rerollShop(next, run);
      events.push({ type: 'rerolled', seat });
      break;
    case 'next':
      advance(next, run, events);
      break;
    case 'pick': {
      const pack = run.pack!;
      const offer = pack.items[move.index]!;
      pack.items = pack.items.filter((_, i) => i !== move.index);
      pack.picksLeft -= 1;
      if (offer.type === 'mod') addMod(run, offer.key, modExtras(offer));
      else if (offer.type === 'card') addCards(run, [offer.card]);
      else {
        const targets = [...move.cards].sort((a, b) => a - b).map((i) => pack.hand[i]!);
        useConsumable(next, run, offer.item, targets, events);
      }
      events.push({ type: 'picked', seat, offer });
      if (pack.picksLeft <= 0 || pack.items.length === 0) closePack(next, run, events);
      break;
    }
    case 'skipPack':
      closePack(next, run, events);
      break;
  }

  settleMeeting(next, events);
  checkEnd(next, events);
  return { state: next, events };
}

function modExtras(offer: Extract<Offer, { type: 'mod' }>): Partial<ModInstance> {
  const extra: Partial<ModInstance> = {};
  if (offer.foil) extra.foil = offer.foil;
  if (offer.sticker) extra.sticker = offer.sticker;
  return extra;
}

function closePack(state: SorterState, run: RunState, events: GameEvent[]): void {
  const back = run.pack?.returnTo ?? 'shop';
  run.pack = null;
  if (back === 'shop') run.phase = 'shop';
  else enterRound(state, run, events);
}

function applyTag(state: SorterState, run: RunState, tag: string, events: GameEvent[]): void {
  if (tag === 'giftBasket') {
    const rng = new Rng(run.rng.shop);
    const kind = rng.pick<PackKind>(['mods', 'spells', 'nails', 'dreams', 'cards']);
    run.rng.shop = rng.state;
    run.pack = openPack(state, run, kind, 'big', 'choose');
    run.phase = 'pack';
    events.push({ type: 'packOpened', seat: run.seat, kind, size: 'big', items: run.pack.items });
  } else if (tag === 'bakery') {
    run.tokens += Math.min(10, run.mods.length);
  } else if (tag === 'tutoring') {
    // Die schwächste offene Kombi: niedrigste Stufe, bei Gleichstand die schwächere.
    const open = HAND_TYPES.filter((t) => !HANDS[t].secret);
    const weakest = open.reduce((a, b) => (run.handLevels[b] < run.handLevels[a] ? b : a));
    levelUp(run, weakest, 2);
  } else {
    run.stickers = [...run.stickers, tag];
  }
}

/** Wanderbühne: der zweite Gefallen zur Wahl – für alle gleich, nie derselbe wie der erste. */
export function altTag(tag: string, level: number): string {
  const i = TAG_KEYS.indexOf(tag);
  return TAG_KEYS[(i + 1 + (level % (TAG_KEYS.length - 1))) % TAG_KEYS.length]!;
}

function playHand(state: SorterState, run: RunState, indices: number[], events: GameEvent[]): void {
  const round = run.current!;
  const played = indices.map((i) => run.hand[i]!);
  const held = run.hand.filter((_, i) => !indices.includes(i));
  const fx = new Rng(run.rng.fx);

  // Vor der Wertung: Feuer-Echse senkt das Level.
  const table = tableInfo(state, run.seat);
  const preview = scoreHand(run, played, held, new Rng([1, 2, 3, 4]), table);
  if (round.boss === 'lizard') levelUp(run, preview.type, -1);

  const result = scoreHand(run, played, held, fx, table);
  let score = result.score;
  // Regeln der Bosse, die eine Hand ungültig machen: Sie zählt dann 0.
  const notAllowed =
    (round.boss === 'spider' && played.length !== 5) ||
    (round.boss === 'snake' && round.playedTypes.includes(result.type)) ||
    (round.boss === 'lion' && round.playedTypes.length > 0 && round.playedTypes[0] !== result.type);
  if (notAllowed) score = 0;

  run.mods = result.mods;
  run.tokens += notAllowed ? 0 : result.tokens;
  for (const [id, plus] of Object.entries(result.bonus))
    updateCard(run, Number(id), (c) => ({
      ...c,
      bonus: (c.bonus ?? 0) + plus,
    }));
  if (result.broken.length) destroyCards(run, result.broken);
  run.handPlays = {
    ...run.handPlays,
    [result.type]: run.handPlays[result.type] + 1,
  };
  run.lastHandType = result.type;
  run.bestHand = Math.max(run.bestHand, score);
  round.playedTypes = [...round.playedTypes, result.type];
  round.score += score;
  round.handsLeft -= 1;
  round.firstDone = true;
  run.playedThisLevel = [...run.playedThisLevel, ...played.map((c) => c.id)];
  const playedIds = new Set(played.map((c) => c.id));
  run.hand = run.hand.filter((c) => !playedIds.has(c.id));
  round.faceDown = round.faceDown.filter((id) => !playedIds.has(id));
  events.push({
    type: 'scored',
    seat: run.seat,
    cards: played,
    scoring: result.scoringIds,
    handType: result.type,
    label: handLabel(result.type, played),
    steps: result.steps,
    chips: result.chips,
    mult: result.mult,
    score,
    notAllowed,
    broken: result.broken,
    total: round.score,
    duel: round.duel,
  });

  if (!round.duel && round.score >= round.target) {
    run.rng.fx = fx.state;
    winRound(state, run, events);
    return;
  }
  if (round.handsLeft <= 0) {
    run.rng.fx = fx.state;
    endHandsOut(state, run, events);
    return;
  }
  // Wilder Keiler: zwei zufällige Handkarten weg.
  if (round.boss === 'boar' && run.hand.length) {
    const gone = new Set(fx.shuffle(run.hand.map((c) => c.id)).slice(0, 2));
    run.hand = run.hand.filter((c) => !gone.has(c.id));
    events.push({ type: 'boarDiscard', seat: run.seat, count: gone.size });
  }
  run.rng.fx = fx.state;
  if (round.boss === 'phoenix') shuffleMods(run);
  drawCards(run, events);
  if (run.hand.length === 0) endHandsOut(state, run, events);
}

function endHandsOut(state: SorterState, run: RunState, events: GameEvent[]): void {
  const round = run.current!;
  if (round.duel && state.duel) {
    state.duel.scores[run.seat] = round.score;
    run.phase = 'wait';
    run.hand = [];
    events.push({ type: 'duelDone', seat: run.seat, score: round.score });
    return;
  }
  loseRound(state, run, events);
}

function discardCards(state: SorterState, run: RunState, indices: number[], events: GameEvent[]): void {
  const round = run.current!;
  const cards = indices.map((i) => run.hand[i]!);
  const ids = new Set(cards.map((c) => c.id));
  run.hand = run.hand.filter((c) => !ids.has(c.id));
  round.faceDown = round.faceDown.filter((id) => !ids.has(id));
  round.discardsLeft -= 1;
  run.discardsUsed += 1;
  for (const card of cards) {
    if (card.seal === 'purple')
      addConsumable(run, {
        kind: 'spell',
        key: SPELL_KEYS[(card.id * 7 + run.level) % SPELL_KEYS.length]!,
      });
  }
  run.mods = run.mods.map((mod) => {
    const def = modDef(mod.key);
    if (mod.spent || !def.onDiscard) return mod;
    const out = def.onDiscard(
      cards.filter((c) => !isDebuffed(c, run)),
      mod,
      run,
    );
    if (out.tokens) run.tokens += out.tokens;
    return out.mod ?? mod;
  });
  events.push({ type: 'discarded', seat: run.seat, cards });
  drawCards(run, events);
  if (run.hand.length === 0) endHandsOut(state, run, events);
}

// ---------------------------------------------------------------- Ergebnis und Sicht

export function result(state: SorterState): Result | null {
  if (!state.winners) return null;
  if (state.mode === 'solo') {
    const level = state.runs[0]!.level;
    if (!state.winners.length) return { kind: 'loss', reason: `Hoftag ${level}` };
    return {
      kind: 'win',
      winners: [0],
      reason: state.endless ? `Endlos bis Hoftag ${level}` : 'geschafft',
    };
  }
  return { kind: 'win', winners: state.winners };
}

const hiddenCard = (index: number): ViewCard => ({
  id: -1 - index,
  hidden: true,
});

/** Platzhalter für geheime Duell-Punkte in der Sicht. */
export const HIDDEN_SCORE = -1;

/**
 * Jeder sieht den eigenen Lauf (ohne die Reihenfolge des Stapels und ohne verdeckte
 * Karten) und von den anderen nur, was am Tisch sichtbar wäre: Level, Leben, Token, Mods.
 */
export function playerView(state: SorterState, seat: SeatId | 'spectator'): SorterState {
  const zero = {
    deal: [0, 0, 0, 0],
    shop: [0, 0, 0, 0],
    fx: [0, 0, 0, 0],
  } as RunState['rng'];
  // Duell-Punkte der anderen bleiben bis zur Abrechnung geheim – außer mit dem Spion.
  const spy = seat === 'spectator' || !!state.runs[seat]?.mods.some((m) => m.key === 'spy' && !m.spent);
  const duel =
    state.duel && !spy
      ? {
          ...state.duel,
          scores: state.duel.scores.map((s, i) => (s === null || i === seat ? s : HIDDEN_SCORE)),
        }
      : state.duel;
  return {
    ...state,
    duel,
    runs: state.runs.map((run) => {
      if (run.seat === seat) {
        const faceDown = new Set(run.current?.faceDown ?? []);
        const hand = run.hand.map((c, i) => (faceDown.has(c.id) ? (hiddenCard(i) as unknown as Card) : c));
        // Der Stapel als Zusammensetzung, verdeckte Handkarten mitgezählt – sonst ließen sie sich erschließen.
        const unknown = [...run.pile, ...run.hand.filter((c) => faceDown.has(c.id))].sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.rank - b.rank || a.id - b.id);
        return {
          ...run,
          hand,
          pile: unknown,
          pileCount: run.pile.length,
          rng: zero,
        };
      }
      return {
        ...run,
        hand: run.hand.map((_, i) => hiddenCard(i) as unknown as Card),
        pile: [],
        pileCount: run.pile.length,
        deck: [],
        shop: null,
        pack: null,
        consumables: run.consumables.map(() => ({
          kind: 'spell' as const,
          key: '?',
        })),
        rng: zero,
        current: run.current
          ? {
              ...run.current,
              faceDown: [],
              score: run.current.duel && !spy ? HIDDEN_SCORE : run.current.score,
            }
          : null,
      };
    }),
  };
}

/** Ereignisse anderer Plätze ohne Karten und Angebote. */
export function eventView(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null {
  if (typeof event.seat !== 'number' || event.seat === seat) return event;
  // Im Duell verraten Ereignisse keine Punkte; wer den Spion hat, sieht sie in der Sicht.
  const secret = (event.type === 'scored' && event.duel === true) || event.type === 'duelDone';
  const keep = ['type', 'seat', 'level', 'round', 'lives', 'label', 'handType', 'boss', 'duel', 'target', 'payout', 'tag', 'kind', 'size', ...(secret ? [] : ['score', 'total'])];
  return Object.fromEntries(Object.entries(event).filter(([key]) => keep.includes(key))) as GameEvent;
}
