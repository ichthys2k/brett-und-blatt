import { CONTAINS, isFace, SANTA } from './cards';
import { hasColor } from './cards';
import type { Card, Color, GameMode, HandType, ModInstance, Rarity, RunState } from './types';

/** Ein Wertungsschritt: Chips dazu, Mult dazu, Mult mal, Token dazu. */
export interface Effect {
  chips?: number;
  mult?: number;
  xmult?: number;
  tokens?: number;
}

export interface HandContext {
  run: RunState;
  played: Card[];
  scoring: Card[];
  held: Card[];
  type: HandType;
  /** Zufall für Mods wie „Der Bug“ – liefert eine Zahl in [0, 1). */
  random: () => number;
  /** Lage am Tisch (Mehrspieler-Mods). */
  table: TableInfo;
}

/** Was ein Lauf über die anderen weiß: alles öffentlich. */
export interface TableInfo {
  /** Mitspieler, die noch im Spiel sind (ohne einen selbst). */
  others: number;
  /** Level Rückstand auf den Ersten. */
  behind: number;
}

export const SOLO_TABLE: TableInfo = { others: 0, behind: 0 };

export interface ModDef {
  key: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  price: number;
  text: string;
  /** Je gewertete Karte (und je Wiederholung). */
  onCard?: (card: Card, ctx: HandContext, mod: ModInstance) => Effect | null;
  /** Je Karte, die in der Hand bleibt. */
  onHeld?: (card: Card, ctx: HandContext, mod: ModInstance) => Effect | null;
  /** Einmal pro Hand, nach den Karten – in der Reihenfolge der Mods. */
  onHand?: (ctx: HandContext, mod: ModInstance) => Effect | null;
  /** Wie oft eine gewertete Karte zusätzlich zählt. */
  retrigger?: (card: Card, ctx: HandContext) => number;
  /** Nach der Wertung: Zähler fortschreiben. Gibt null zurück, wenn der Mod sich auflöst. */
  afterHand?: (mod: ModInstance, ctx: HandContext) => ModInstance | null;
  /** Am Rundenende nach einem Sieg: Token und Zähler. */
  onRoundEnd?: (mod: ModInstance, run: RunState) => { tokens?: number; mod?: ModInstance | null };
  /** Beim Verwerfen, je verworfene Karte. */
  onDiscard?: (cards: Card[], mod: ModInstance, run: RunState) => { tokens?: number; mod?: ModInstance };
  /** Dauerhafte Wirkung, solange der Mod liegt. */
  passive?: { handSize?: number; hands?: number; discards?: number };
  /** Startwert des Zählers. */
  initial?: number;
  /** Mehrspieler-Mod: liegt nur in diesen Spielarten im Laden. */
  multi?: GameMode[];
}

const contains = (ctx: HandContext, type: HandType) => CONTAINS[ctx.type].includes(type);
const perColor =
  (color: Color, mult: number): ModDef['onCard'] =>
  (card) =>
    hasColor(card, color) ? { mult } : null;

const list: ModDef[] = [
  // Aus dem Emoji-Sortierer übernommen (Werte an Balatro angeglichen)
  {
    key: 'clown',
    name: 'Der Clown',
    emoji: '🤡',
    rarity: 'common',
    price: 2,
    text: '+4 Mult',
    onHand: () => ({ mult: 4 }),
  },
  {
    key: 'coolGuy',
    name: 'Cool Guy',
    emoji: '😎',
    rarity: 'common',
    price: 5,
    text: '+3 Mult je gewertete blaue Karte',
    onCard: perColor('b', 3),
  },
  {
    key: 'inLove',
    name: 'Verliebt',
    emoji: '😍',
    rarity: 'common',
    price: 5,
    text: '+3 Mult je gewertete rote Karte',
    onCard: perColor('r', 3),
  },
  {
    key: 'sunny',
    name: 'Sonnenschein',
    emoji: '🌞',
    rarity: 'common',
    price: 5,
    text: '+3 Mult je gewertete gelbe Karte',
    onCard: perColor('y', 3),
  },
  {
    key: 'broccoli',
    name: 'Brokkoli',
    emoji: '🥦',
    rarity: 'common',
    price: 5,
    text: '+3 Mult je gewertete grüne Karte',
    onCard: perColor('g', 3),
  },
  {
    key: 'nerd',
    name: 'Nerd Face',
    emoji: '🤓',
    rarity: 'common',
    price: 5,
    text: '+2 Mult je Ziffer der bisherigen Rundenpunkte',
    onHand: (ctx) => ({
      mult: 2 * String(Math.max(0, Math.floor(ctx.run.current?.score ?? 0))).length,
    }),
  },
  {
    key: 'bug',
    name: 'Der Bug',
    emoji: '🐛',
    rarity: 'common',
    price: 4,
    text: 'Zu 1/8: ×2 Mult. Zu 1/8: ×0 Mult. Sonst nichts.',
    onHand: (ctx) => {
      const r = ctx.random();
      if (r < 0.125) return { xmult: 2 };
      if (r < 0.25) return { xmult: 0 };
      return null;
    },
  },
  {
    key: 'e404',
    name: '404',
    emoji: '🚫',
    rarity: 'common',
    price: 5,
    text: '+15 Mult bei 3 oder weniger gespielten Karten',
    onHand: (ctx) => (ctx.played.length <= 3 ? { mult: 15 } : null),
  },
  {
    key: 'darkMode',
    name: 'Dark Mode',
    emoji: '🌑',
    rarity: 'uncommon',
    price: 7,
    text: '+30 Chips je gewertete grüne oder blaue Karte',
    onCard: (card) => (hasColor(card, 'g') || hasColor(card, 'b') ? { chips: 30 } : null),
  },
  {
    key: 'pi',
    name: 'Pi',
    emoji: '🥧',
    rarity: 'common',
    price: 4,
    text: '+3,14 Mult',
    onHand: () => ({ mult: 3.14 }),
  },
  {
    key: 'binary',
    name: 'Binär',
    emoji: '0️⃣',
    rarity: 'common',
    price: 5,
    text: '+8 Mult je gewertete 1 und je gewertetes Baby (10)',
    onCard: (card) => (card.enh !== 'granite' && (card.rank === 1 || card.rank === 10) ? { mult: 8 } : null),
  },
  {
    key: 'sixSeven',
    name: '67',
    emoji: '6️⃣',
    rarity: 'uncommon',
    price: 6,
    text: '+6,7 Mult; gewertete 6 und 7: je +6 Chips und +7 Chips',
    onHand: () => ({ mult: 6.7 }),
    onCard: (card) => (card.enh === 'granite' ? null : card.rank === 6 ? { chips: 6 } : card.rank === 7 ? { chips: 7 } : null),
  },

  // Kombi-Mods
  {
    key: 'jolly',
    name: 'Fröhlich',
    emoji: '😄',
    rarity: 'common',
    price: 3,
    text: '+8 Mult, wenn ein Duo dabei ist',
    onHand: (ctx) => (contains(ctx, 'pair') ? { mult: 8 } : null),
  },
  {
    key: 'zany',
    name: 'Verrückt',
    emoji: '🤪',
    rarity: 'common',
    price: 4,
    text: '+12 Mult, wenn ein Triple dabei ist',
    onHand: (ctx) => (contains(ctx, 'three') ? { mult: 12 } : null),
  },
  {
    key: 'ruler',
    name: 'Lineal',
    emoji: '📏',
    rarity: 'common',
    price: 4,
    text: '+12 Mult bei einem Zahlen-Lauf',
    onHand: (ctx) => (contains(ctx, 'straight') ? { mult: 12 } : null),
  },
  {
    key: 'palette',
    name: 'Farbpalette',
    emoji: '🎨',
    rarity: 'common',
    price: 4,
    text: '+10 Mult bei einem Farben-Satz',
    onHand: (ctx) => (contains(ctx, 'flush') ? { mult: 10 } : null),
  },
  {
    key: 'fox',
    name: 'Schlaufuchs',
    emoji: '🦊',
    rarity: 'common',
    price: 3,
    text: '+50 Chips, wenn ein Duo dabei ist',
    onHand: (ctx) => (contains(ctx, 'pair') ? { chips: 50 } : null),
  },
  {
    key: 'knitter',
    name: 'Strickliesel',
    emoji: '🧶',
    rarity: 'common',
    price: 4,
    text: '+80 Chips bei einem Farben-Satz',
    onHand: (ctx) => (contains(ctx, 'flush') ? { chips: 80 } : null),
  },
  {
    key: 'twins',
    name: 'Zwillinge',
    emoji: '👯',
    rarity: 'rare',
    price: 8,
    text: '×2 Mult, wenn ein Duo dabei ist',
    onHand: (ctx) => (contains(ctx, 'pair') ? { xmult: 2 } : null),
  },
  {
    key: 'trio',
    name: 'Dreierbande',
    emoji: '🎺',
    rarity: 'rare',
    price: 8,
    text: '×3 Mult, wenn ein Triple dabei ist',
    onHand: (ctx) => (contains(ctx, 'three') ? { xmult: 3 } : null),
  },
  {
    key: 'family',
    name: 'Großfamilie',
    emoji: '👨‍👩‍👧‍👦',
    rarity: 'rare',
    price: 8,
    text: '×4 Mult, wenn ein Quartett dabei ist',
    onHand: (ctx) => (contains(ctx, 'four') ? { xmult: 4 } : null),
  },
  {
    key: 'order',
    name: 'Ordnungsliebe',
    emoji: '🗂️',
    rarity: 'rare',
    price: 8,
    text: '×3 Mult bei einem Zahlen-Lauf',
    onHand: (ctx) => (contains(ctx, 'straight') ? { xmult: 3 } : null),
  },
  {
    key: 'rainbow',
    name: 'Regenbogen',
    emoji: '🌈',
    rarity: 'rare',
    price: 8,
    text: '×2 Mult bei einem Farben-Satz',
    onHand: (ctx) => (contains(ctx, 'flush') ? { xmult: 2 } : null),
  },

  // Karten-Mods
  {
    key: 'smiley',
    name: 'Smiley',
    emoji: '🙂',
    rarity: 'common',
    price: 4,
    text: '+5 Mult je gewertete Bildkarte',
    onCard: (card) => (card.enh !== 'granite' && isFace(card.rank) ? { mult: 5 } : null),
  },
  {
    key: 'kidFan',
    name: 'Kinderfreund',
    emoji: '🧸',
    rarity: 'common',
    price: 4,
    text: '+30 Chips je gewertete Bildkarte',
    onCard: (card) => (card.enh !== 'granite' && isFace(card.rank) ? { chips: 30 } : null),
  },
  {
    key: 'even',
    name: 'Gerade Sache',
    emoji: '✌️',
    rarity: 'common',
    price: 4,
    text: '+4 Mult je gewertete 2, 4, 6 oder 8',
    onCard: (card) => (card.enh !== 'granite' && card.rank <= 9 && card.rank % 2 === 0 ? { mult: 4 } : null),
  },
  {
    key: 'odd',
    name: 'Ungerade Sache',
    emoji: '☝️',
    rarity: 'common',
    price: 4,
    text: '+31 Chips je gewertete 1, 3, 5, 7 oder 9',
    onCard: (card) => (card.enh !== 'granite' && card.rank <= 9 && card.rank % 2 === 1 ? { chips: 31 } : null),
  },
  {
    key: 'snail',
    name: 'Schneckenhaus',
    emoji: '🐚',
    rarity: 'uncommon',
    price: 8,
    text: '+8 Mult je gewertete 1, 2, 3, 5 oder 8',
    onCard: (card) => (card.enh !== 'granite' && [1, 2, 3, 5, 8].includes(card.rank) ? { mult: 8 } : null),
  },
  {
    key: 'santaFan',
    name: 'Wichtel',
    emoji: '🧝',
    rarity: 'common',
    price: 5,
    text: '+20 Chips und +4 Mult je gewerteter Santa',
    onCard: (card) => (card.enh !== 'granite' && card.rank === SANTA ? { chips: 20, mult: 4 } : null),
  },
  {
    key: 'tree',
    name: 'Tannenbaum',
    emoji: '🎄',
    rarity: 'rare',
    price: 8,
    text: '×1,5 Mult je Santa, der in der Hand bleibt',
    onHeld: (card) => (card.enh !== 'granite' && card.rank === SANTA ? { xmult: 1.5 } : null),
  },
  {
    key: 'echo',
    name: 'Echo',
    emoji: '📣',
    rarity: 'uncommon',
    price: 6,
    text: 'Die erste gewertete Karte zählt doppelt',
    retrigger: (card, ctx) => (ctx.scoring[0] === card ? 1 : 0),
  },
  {
    key: 'hiker',
    name: 'Wanderer',
    emoji: '🥾',
    rarity: 'uncommon',
    price: 5,
    text: 'Jede gewertete Karte bekommt dauerhaft +5 Chips',
    // Die Wirkung steckt in der Wertung (dauerhafter Bonus auf der Karte).
  },

  // Mods mit Zählern
  {
    key: 'collector',
    name: 'Mod-Sammler',
    emoji: '🧩',
    rarity: 'common',
    price: 4,
    text: '+3 Mult je Mod',
    onHand: (ctx) => ({ mult: 3 * ctx.run.mods.length }),
  },
  {
    key: 'banner',
    name: 'Wimpel',
    emoji: '🚩',
    rarity: 'common',
    price: 5,
    text: '+30 Chips je übriges Verwerfen',
    onHand: (ctx) => ({ chips: 30 * (ctx.run.current?.discardsLeft ?? 0) }),
  },
  {
    key: 'iceCream',
    name: 'Eiswaffel',
    emoji: '🍦',
    rarity: 'common',
    price: 5,
    text: '+100 Chips, nach jeder Hand 5 weniger',
    initial: 100,
    onHand: (_, mod) => ({ chips: mod.value ?? 100 }),
    afterHand: (mod) => ((mod.value ?? 100) - 5 <= 0 ? null : { ...mod, value: (mod.value ?? 100) - 5 }),
  },
  {
    key: 'popcorn',
    name: 'Popcorn',
    emoji: '🍿',
    rarity: 'common',
    price: 5,
    text: '+20 Mult, nach jeder Runde 4 weniger',
    initial: 20,
    onHand: (_, mod) => ({ mult: mod.value ?? 20 }),
    onRoundEnd: (mod) => ({
      mod: (mod.value ?? 20) - 4 <= 0 ? null : { ...mod, value: (mod.value ?? 20) - 4 },
    }),
  },
  {
    key: 'bus',
    name: 'Busfahrt',
    emoji: '🚌',
    rarity: 'common',
    price: 6,
    text: '+1 Mult je Hand in Folge ohne gewertete Bildkarte',
    initial: 0,
    onHand: (ctx, mod) => {
      const value = ctx.scoring.some((c) => c.enh !== 'granite' && isFace(c.rank)) ? 0 : (mod.value ?? 0) + 1;
      return value > 0 ? { mult: value } : null;
    },
    afterHand: (mod, ctx) => ({
      ...mod,
      value: ctx.scoring.some((c) => c.enh !== 'granite' && isFace(c.rank)) ? 0 : (mod.value ?? 0) + 1,
    }),
  },
  {
    key: 'growth',
    name: 'Zimmerpflanze',
    emoji: '🪴',
    rarity: 'uncommon',
    price: 6,
    text: '+1 Mult dauerhaft je gespieltem Farben-Satz',
    initial: 0,
    onHand: (ctx, mod) => {
      const value = (mod.value ?? 0) + (contains(ctx, 'flush') ? 1 : 0);
      return value > 0 ? { mult: value } : null;
    },
    afterHand: (mod, ctx) => ({
      ...mod,
      value: (mod.value ?? 0) + (contains(ctx, 'flush') ? 1 : 0),
    }),
  },
  {
    key: 'banana',
    name: 'Banane',
    emoji: '🍌',
    rarity: 'uncommon',
    price: 6,
    text: '×3 Mult. Wird zu 1/100 nach einer Runde gegessen.',
    onHand: () => ({ xmult: 3 }),
  },
  {
    key: 'king',
    name: 'Sortierkönig',
    emoji: '🤴',
    rarity: 'rare',
    price: 9,
    text: '×1 Mult, dazu ×0,25 je gewonnener Runde',
    initial: 1,
    onHand: (_, mod) => ((mod.value ?? 1) > 1 ? { xmult: mod.value ?? 1 } : null),
    onRoundEnd: (mod) => ({ mod: { ...mod, value: (mod.value ?? 1) + 0.25 } }),
  },

  // Werkstatt-Mods (Token)
  {
    key: 'piggy',
    name: 'Sparschwein',
    emoji: '🐷',
    rarity: 'common',
    price: 6,
    text: '+4 T am Ende jeder Runde',
    onRoundEnd: () => ({ tokens: 4 }),
  },
  {
    key: 'patience',
    name: 'Geduld',
    emoji: '🧘',
    rarity: 'common',
    price: 4,
    text: '+2 T am Rundenende, wenn nicht verworfen wurde',
    onRoundEnd: (_, run) => ({
      tokens: run.current && run.current.discardsLeft === run.discards ? 2 : 0,
    }),
  },
  {
    key: 'egg',
    name: 'Goldei',
    emoji: '🥚',
    rarity: 'common',
    price: 4,
    text: 'Verkaufswert steigt nach jeder Runde um 3 T',
    onRoundEnd: (mod) => ({
      mod: { ...mod, extraSell: (mod.extraSell ?? 0) + 3 },
    }),
  },
  {
    key: 'robot',
    name: 'Sortierroboter',
    emoji: '🤖',
    rarity: 'uncommon',
    price: 6,
    text: 'Zu 1/4: +20 Mult. Zu 1/10: +5 T.',
    onHand: (ctx) => {
      const effect: Effect = {};
      if (ctx.random() < 0.25) effect.mult = 20;
      if (ctx.random() < 0.1) effect.tokens = 5;
      return effect.mult || effect.tokens ? effect : null;
    },
  },
  {
    key: 'recycler',
    name: 'Wertstoffhof',
    emoji: '♻️',
    rarity: 'uncommon',
    price: 5,
    text: '+1 T je verworfene Bildkarte',
    onDiscard: (cards) => ({
      tokens: cards.filter((c) => c.enh !== 'granite' && isFace(c.rank)).length,
    }),
  },

  // Dauerhafte Wirkungen
  {
    key: 'juggler',
    name: 'Jongleur',
    emoji: '🤹',
    rarity: 'common',
    price: 4,
    text: '+1 Handgröße',
    passive: { handSize: 1 },
  },
  {
    key: 'drunk',
    name: 'Bastelkleber',
    emoji: '🧴',
    rarity: 'common',
    price: 4,
    text: '+1 Verwerfen je Runde',
    passive: { discards: 1 },
  },
  {
    key: 'troubadour',
    name: 'Liedermacher',
    emoji: '🎸',
    rarity: 'uncommon',
    price: 6,
    text: '+2 Handgröße, −1 Hand je Runde',
    passive: { handSize: 2, hands: -1 },
  },

  // Legendär (nur aus der Traumkarte „Seele“)
  {
    key: 'unicorn',
    name: 'Regenbogen-Einhorn',
    emoji: '🦄',
    rarity: 'legendary',
    price: 20,
    text: '×1 Mult, dazu ×1 je Bildkarte, die verworfen wurde (dauerhaft)',
    initial: 1,
    onHand: (_, mod) => ((mod.value ?? 1) > 1 ? { xmult: mod.value ?? 1 } : null),
    onDiscard: (cards, mod) => ({
      mod: {
        ...mod,
        value: (mod.value ?? 1) + cards.filter((c) => c.enh !== 'granite' && isFace(c.rank)).length,
      },
    }),
  },
  {
    key: 'santaClaus',
    name: 'Weihnachtsmann',
    emoji: '🎅',
    rarity: 'legendary',
    price: 20,
    text: 'Jeder gewertete Santa zählt dreimal',
    retrigger: (card) => (card.enh !== 'granite' && card.rank === SANTA ? 2 : 0),
  },
  {
    key: 'painter',
    name: 'Meistermaler',
    emoji: '🧑‍🎨',
    rarity: 'legendary',
    price: 20,
    text: '×2 Mult je Farbe, die unter den gewerteten Karten vorkommt, ab der zweiten',
    onHand: (ctx) => {
      const colors = new Set(ctx.scoring.filter((c) => c.enh !== 'granite').map((c) => (c.enh === 'ombre' ? '*' : c.color)));
      const count = colors.size;
      return count >= 2 ? { xmult: 2 ** (count - 1) } : null;
    },
  },

  // Mehrspieler-Mods: nur zu mehreren im Laden, keiner schadet anderen.
  {
    key: 'shield',
    name: 'Abwehr',
    emoji: '🛡️',
    rarity: 'common',
    price: 5,
    multi: ['duel', 'showdown'],
    text: '+25 Chips je verlorenes Leben',
    onHand: (ctx) => (ctx.run.livesLost > 0 ? { chips: 25 * ctx.run.livesLost } : null),
  },
  {
    key: 'pacifist',
    name: 'Pazifist',
    emoji: '🕊️',
    rarity: 'uncommon',
    price: 6,
    multi: ['duel', 'showdown'],
    text: '×2 Mult in normalen Runden, im Duell aber ×0,5',
    onHand: (ctx) => ({ xmult: ctx.run.current?.duel ? 0.5 : 2 }),
  },
  {
    key: 'spy',
    name: 'Spion',
    emoji: '🕵️',
    rarity: 'common',
    price: 3,
    multi: ['duel', 'showdown'],
    text: 'Du siehst im Duell die Punkte der anderen schon während des Spiels',
  },
  {
    key: 'team',
    name: 'Teamgeist',
    emoji: '🤝',
    rarity: 'common',
    price: 5,
    multi: ['duel', 'showdown', 'survival', 'race'],
    text: '+3 Mult je Mitspieler, der noch dabei ist',
    onHand: (ctx) => (ctx.table.others > 0 ? { mult: 3 * ctx.table.others } : null),
  },
  {
    key: 'chase',
    name: 'Aufholjagd',
    emoji: '🐢',
    rarity: 'uncommon',
    price: 6,
    multi: ['duel', 'showdown', 'survival', 'race'],
    text: '+30 Chips und +3 Mult je Level Rückstand auf den Ersten',
    onHand: (ctx) => (ctx.table.behind > 0 ? { chips: 30 * ctx.table.behind, mult: 3 * ctx.table.behind } : null),
  },
  {
    key: 'secondChance',
    name: 'Zweite Chance',
    emoji: '❤️‍🩹',
    rarity: 'rare',
    price: 8,
    multi: ['duel', 'showdown', 'survival', 'race'],
    text: 'Würdest du ein Leben verlieren oder ausscheiden, löst sich der Mod stattdessen auf',
  },
  {
    key: 'champion',
    name: 'Duell-Champion',
    emoji: '🏆',
    rarity: 'uncommon',
    price: 6,
    multi: ['duel', 'showdown'],
    text: '+3 Mult je gewonnenes Duell',
    onHand: (ctx) => (ctx.run.duelsWon > 0 ? { mult: 3 * ctx.run.duelsWon } : null),
  },
];

export const MODS: Record<string, ModDef> = Object.fromEntries(list.map((def) => [def.key, def]));
export const MOD_KEYS = list.map((def) => def.key);

export function modDef(key: string): ModDef {
  const def = MODS[key];
  if (!def) throw new Error(`Unbekannter Mod: ${key}`);
  return def;
}

export const RARITY_INFO: Record<Rarity, { name: string; weight: number }> = {
  common: { name: 'gewöhnlich', weight: 70 },
  uncommon: { name: 'ungewöhnlich', weight: 25 },
  rare: { name: 'selten', weight: 5 },
  legendary: { name: 'legendär', weight: 0 },
};
