import { ACE, CONTAINS, HAND_TYPES, HANDS, isFace, JACK, KING, QUEEN } from './cards';
import { hasColor } from './cards';
import { COLORS, type Card, type Color, type GameMode, type HandType, type ModInstance, type Rarity, type RunState } from './types';

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
  /** Anzeige des Zählers, wenn „Stand: Zahl“ nichts sagt (Herold). */
  status?: (mod: Pick<ModInstance, 'value'>) => string;
}

const contains = (ctx: HandContext, type: HandType) => CONTAINS[ctx.type].includes(type);

/** Der Herold ruft eine der neun offenen Kombis aus (ohne die versteckten). */
const HERALD_HANDS = 9;
const heraldHand = (mod: Pick<ModInstance, 'value'>): HandType => HAND_TYPES[(mod.value ?? 1) % HERALD_HANDS]!;
/** Zählhilfen für wachsende Narren. */
const scored = (ctx: HandContext) => ctx.scoring.filter((c) => c.enh !== 'granite');
const clubs = (ctx: HandContext) => scored(ctx).filter((c) => hasColor(c, 'c')).length;
const fibs = (ctx: HandContext) => scored(ctx).filter((c) => [2, 3, 5, 8].includes(c.rank)).length;
/** Sind alle gewerteten Karten Zahlenkarten mit dieser Eigenschaft? */
const allNumbers = (ctx: HandContext, test: (rank: number) => boolean) => scored(ctx).length > 0 && scored(ctx).every((c) => c.rank <= 10 && test(c.rank));

const perColor =
  (color: Color, mult: number): ModDef['onCard'] =>
  (card) =>
    hasColor(card, color) ? { mult } : null;

const list: ModDef[] = [
  // Narren vom Narrenhof (eigene Ideen, 29.10.2026)
  {
    key: 'juggler',
    name: 'Der Jongleur',
    emoji: '🤹',
    rarity: 'common',
    price: 5,
    text: '+2 Lachen je gewertete Karte',
    onCard: () => ({ mult: 2 }),
  },
  {
    key: 'fiddler',
    name: 'Die Spielfrau',
    emoji: '🎻',
    rarity: 'common',
    price: 5,
    text: '+30 Witz, wenn genau 3 Karten gewertet werden (Dreivierteltakt)',
    onHand: (ctx) => (ctx.scoring.length === 3 ? { chips: 30 } : null),
  },
  {
    key: 'earlyBird',
    name: 'Der Frühaufsteher',
    emoji: '🐓',
    rarity: 'common',
    price: 6,
    text: 'In der Morgenaudienz ×2 Lachen, sonst +3 Lachen',
    onHand: (ctx) => (ctx.run.round === 0 ? { xmult: 2 } : { mult: 3 }),
  },
  {
    key: 'baker',
    name: 'Der Bäckerjunge',
    emoji: '🥨',
    rarity: 'common',
    price: 5,
    text: '+1 🥨 je gewerteter Bube',
    onCard: (card) => (card.enh !== 'granite' && card.rank === JACK ? { tokens: 1 } : null),
  },
  {
    key: 'balladeer',
    name: 'Der Bänkelsänger',
    emoji: '🪕',
    rarity: 'common',
    price: 6,
    text: '+5 Witz je Vorführung, die du an diesem Hoftag schon gemacht hast',
    initial: 0,
    onHand: (_, mod) => ((mod.value ?? 0) > 0 ? { chips: 5 * (mod.value ?? 0) } : null),
    afterHand: (mod) => ({ ...mod, value: (mod.value ?? 0) + 1 }),
    // Nach der dritten Runde (Boss oder Duell) beginnt ein neues Level.
    onRoundEnd: (mod, run) => (run.round === 2 ? { mod: { ...mod, value: 0 } } : {}),
  },
  {
    key: 'monkey',
    name: 'Das Hofäffchen',
    emoji: '🐒',
    rarity: 'uncommon',
    price: 6,
    text: '+1 Lachen dauerhaft je getauschte Karte (höchstens +20). Eifersüchtig: verliert alles, wenn ein weiterer Narr dazukommt',
    initial: 0,
    onHand: (_, mod) => ((mod.value ?? 0) > 0 ? { mult: mod.value ?? 0 } : null),
    onDiscard: (cards, mod) => ({ mod: { ...mod, value: Math.min(20, (mod.value ?? 0) + cards.length) } }),
  },
  {
    key: 'bookworm',
    name: 'Der Bücherwurm',
    emoji: '📚',
    rarity: 'uncommon',
    price: 7,
    text: '+1 Lachen je Stufe der vorgeführten Kombi',
    onHand: (ctx) => ({ mult: ctx.run.handLevels[ctx.type] }),
  },
  {
    key: 'herald',
    name: 'Der Herold',
    emoji: '📯',
    rarity: 'uncommon',
    price: 7,
    text: 'Ruft eine Kombi aus (wechselt nach jeder Audienz). Ist sie in der Vorführung dabei: ×3 Lachen',
    initial: 1,
    status: (mod) => `Ausgerufen: ${HANDS[heraldHand(mod)].name}`,
    onHand: (ctx, mod) => (contains(ctx, heraldHand(mod)) ? { xmult: 3 } : null),
    onRoundEnd: (mod, run) => ({ mod: { ...mod, value: (((mod.value ?? 1) + 2 + run.level + run.round) % HERALD_HANDS) } }),
  },
  {
    key: 'royalCouple',
    name: 'Das Königspaar',
    emoji: '💑',
    rarity: 'rare',
    price: 8,
    text: '×2 Lachen, wenn König und Dame derselben Farbe gewertet werden',
    onHand: (ctx) => {
      const open = ctx.scoring.filter((c) => c.enh !== 'granite');
      const couple = COLORS.some((color) => open.some((c) => c.rank === KING && hasColor(c, color)) && open.some((c) => c.rank === QUEEN && hasColor(c, color)));
      return couple ? { xmult: 2 } : null;
    },
  },
  {
    key: 'twoFaced',
    name: 'Der Doppelgesichtige',
    emoji: '🎭',
    rarity: 'rare',
    price: 10,
    text: 'Die erste Vorführung jeder Audienz wertet alle Karten zweimal',
    retrigger: (_, ctx) => (ctx.run.current && !ctx.run.current.firstDone ? 1 : 0),
  },

  // Aus dem Emoji-Sortierer übernommen (Werte an Balatro angeglichen)
  {
    key: 'clown',
    name: 'Der Spaßmacher',
    emoji: '🤡',
    rarity: 'common',
    price: 2,
    text: '+4 Lachen',
    onHand: () => ({ mult: 4 }),
  },
  {
    key: 'coolGuy',
    name: 'Der Lässige',
    emoji: '😎',
    rarity: 'common',
    price: 5,
    text: '+20 Witz je Pik-Karte, die in der Hand bleibt',
    onHeld: (card) => (hasColor(card, 's') ? { chips: 20 } : null),
  },
  {
    key: 'inLove',
    name: 'Der Verliebte',
    emoji: '😍',
    rarity: 'common',
    price: 5,
    text: '+4 Lachen je gewertete Herz-Karte',
    onCard: perColor('h', 4),
  },
  {
    key: 'sunny',
    name: 'Die Sonnige',
    emoji: '🌞',
    rarity: 'common',
    price: 5,
    text: '+2 🥨, wenn mindestens 3 Karo-Karten gewertet werden',
    onHand: (ctx) => (ctx.scoring.filter((c) => hasColor(c, 'd')).length >= 3 ? { tokens: 2 } : null),
  },
  {
    key: 'broccoli',
    name: 'Die Kräuterfrau',
    emoji: '🌿',
    rarity: 'common',
    price: 5,
    text: '+1 Lachen dauerhaft je gewertete Kreuz-Karte',
    initial: 0,
    onHand: (ctx, mod) => {
      const value = (mod.value ?? 0) + clubs(ctx);
      return value > 0 ? { mult: value } : null;
    },
    afterHand: (mod, ctx) => ({ ...mod, value: (mod.value ?? 0) + clubs(ctx) }),
  },
  {
    key: 'nerd',
    name: 'Der Zahlenschreiber',
    emoji: '🤓',
    rarity: 'common',
    price: 5,
    text: '+2 Lachen je Ziffer der bisherigen Rundenpunkte',
    onHand: (ctx) => ({
      mult: 2 * String(Math.max(0, Math.floor(ctx.run.current?.score ?? 0))).length,
    }),
  },
  {
    key: 'bug',
    name: 'Der Tollpatsch',
    emoji: '🤪',
    rarity: 'common',
    price: 4,
    text: 'Zu 1/8: ×2 Lachen. Zu 1/8: ×0 Lachen. Sonst nichts.',
    onHand: (ctx) => {
      const r = ctx.random();
      if (r < 0.125) return { xmult: 2 };
      if (r < 0.25) return { xmult: 0 };
      return null;
    },
  },
  {
    key: 'e404',
    name: 'Der Wortkarge',
    emoji: '🤐',
    rarity: 'common',
    price: 5,
    text: '+15 Lachen bei 3 oder weniger gespielten Karten',
    onHand: (ctx) => (ctx.played.length <= 3 ? { mult: 15 } : null),
  },
  {
    key: 'darkMode',
    name: 'Der Nachtwächter',
    emoji: '🌑',
    rarity: 'uncommon',
    price: 7,
    text: '+30 Witz je gewertete schwarze Karte (Pik oder Kreuz)',
    onCard: (card) => (hasColor(card, 'c') || hasColor(card, 's') ? { chips: 30 } : null),
  },
  {
    key: 'pi',
    name: 'Der Rechenmeister',
    emoji: '🥧',
    rarity: 'common',
    price: 4,
    text: '+3,14 Lachen',
    onHand: () => ({ mult: 3.14 }),
  },
  {
    key: 'binary',
    name: 'Der Einsundnuller',
    emoji: '🔢',
    rarity: 'common',
    price: 5,
    text: '+8 Lachen je gewertetes Ass (1) und je gewertete 10',
    onCard: (card) => (card.enh !== 'granite' && (card.rank === ACE || card.rank === 10) ? { mult: 8 } : null),
  },
  {
    key: 'sixSeven',
    name: 'Der Sechs-Sieben',
    emoji: '🤷',
    rarity: 'uncommon',
    price: 6,
    text: '+6,7 Lachen; gewertete 6 und 7: je +6 Witz und +7 Witz',
    onHand: () => ({ mult: 6.7 }),
    onCard: (card) => (card.enh === 'granite' ? null : card.rank === 6 ? { chips: 6 } : card.rank === 7 ? { chips: 7 } : null),
  },

  // Kombi-Mods
  {
    key: 'jolly',
    name: 'Der Kuppler',
    emoji: '💌',
    rarity: 'common',
    price: 4,
    text: '+6 Lachen, wenn ein Paar dabei ist, und ×2 bei Zwei Paaren',
    onHand: (ctx) => (contains(ctx, 'twoPair') ? { mult: 6, xmult: 2 } : contains(ctx, 'pair') ? { mult: 6 } : null),
  },
  {
    key: 'zany',
    name: 'Der Dreikäsehoch',
    emoji: '🧀',
    rarity: 'common',
    price: 5,
    text: '+40 Witz und +6 Lachen, wenn ein Drilling dabei ist',
    onHand: (ctx) => (contains(ctx, 'three') ? { chips: 40, mult: 6 } : null),
  },
  {
    key: 'ruler',
    name: 'Der Läufer',
    emoji: '🏃',
    rarity: 'common',
    price: 5,
    text: '+10 Lachen bei einer Straße, dazu ×2 bei einer Farbstraße',
    onHand: (ctx) => (contains(ctx, 'straightFlush') ? { mult: 10, xmult: 2 } : contains(ctx, 'straight') ? { mult: 10 } : null),
  },
  {
    key: 'palette',
    name: 'Die Malerin',
    emoji: '🎨',
    rarity: 'common',
    price: 5,
    text: '+8 Lachen bei einer Farbe, dazu +2 je gewertete Bildkarte darin',
    onHand: (ctx) => (contains(ctx, 'flush') ? { mult: 8 + 2 * ctx.scoring.filter((c) => c.enh !== 'granite' && isFace(c.rank)).length } : null),
  },
  {
    key: 'twins',
    name: 'Das Tanzpaar',
    emoji: '👫',
    rarity: 'rare',
    price: 8,
    text: '×1,5 Lachen je Paar in der Vorführung (Zwei Paare und Full House ×2,25)',
    onHand: (ctx) => (contains(ctx, 'twoPair') || contains(ctx, 'fullHouse') ? { xmult: 2.25 } : contains(ctx, 'pair') ? { xmult: 1.5 } : null),
  },
  {
    key: 'family',
    name: 'Die Gauklerfamilie',
    emoji: '👨‍👩‍👧‍👦',
    rarity: 'rare',
    price: 8,
    text: '×3 Lachen, wenn ein Vierling oder ein Full House dabei ist',
    onHand: (ctx) => (contains(ctx, 'four') || contains(ctx, 'fullHouse') ? { xmult: 3 } : null),
  },

  // Karten-Mods
  {
    key: 'kidFan',
    name: 'Der Hofmaler',
    emoji: '🖼️',
    rarity: 'common',
    price: 5,
    text: '+3 Witz je Bildkarte im ganzen Deck',
    onHand: (ctx) => ({ chips: 3 * ctx.run.deck.filter((c) => c.enh !== 'granite' && isFace(c.rank)).length }),
  },
  {
    key: 'even',
    name: 'Der Aufrechte',
    emoji: '🧍',
    rarity: 'common',
    price: 4,
    text: '+12 Lachen, wenn alle gewerteten Karten gerade Zahlen sind (2, 4, 6, 8, 10)',
    onHand: (ctx) => (allNumbers(ctx, (r) => r % 2 === 0) ? { mult: 12 } : null),
  },
  {
    key: 'odd',
    name: 'Der Querkopf',
    emoji: '🙃',
    rarity: 'common',
    price: 4,
    text: '+60 Witz, wenn alle gewerteten Karten ungerade Zahlen sind (3, 5, 7, 9)',
    onHand: (ctx) => (allNumbers(ctx, (r) => r % 2 === 1) ? { chips: 60 } : null),
  },
  {
    key: 'snail',
    name: 'Die Hofschnecke',
    emoji: '🐌',
    rarity: 'uncommon',
    price: 7,
    text: '+1 Lachen dauerhaft je gewertete 2, 3, 5 oder 8 – das Schneckenhaus wächst',
    initial: 0,
    onHand: (ctx, mod) => {
      const value = (mod.value ?? 0) + fibs(ctx);
      return value > 0 ? { mult: value } : null;
    },
    afterHand: (mod, ctx) => ({ ...mod, value: (mod.value ?? 0) + fibs(ctx) }),
  },
  {
    key: 'santaFan',
    name: 'Der Assjäger',
    emoji: '🎯',
    rarity: 'uncommon',
    price: 6,
    text: '×2 Lachen, wenn ein Ass gewertet wird',
    onHand: (ctx) => (ctx.scoring.some((c) => c.enh !== 'granite' && c.rank === ACE) ? { xmult: 2 } : null),
  },
  {
    key: 'tree',
    name: 'Der Schatzhüter',
    emoji: '🗝️',
    rarity: 'uncommon',
    price: 6,
    text: '+1 🥨 je Ass, das am Ende der Audienz in der Hand ist',
    onRoundEnd: (_, run) => ({ tokens: run.hand.filter((c) => c.enh !== 'granite' && c.rank === ACE).length }),
  },
  {
    key: 'echo',
    name: 'Der Papagei',
    emoji: '🦜',
    rarity: 'uncommon',
    price: 6,
    text: 'Die letzte gewertete Karte zählt doppelt',
    retrigger: (card, ctx) => (ctx.scoring[ctx.scoring.length - 1] === card ? 1 : 0),
  },

  // Mods mit Zählern
  {
    key: 'collector',
    name: 'Der Truppenführer',
    emoji: '🎪',
    rarity: 'common',
    price: 5,
    text: '+2 Lachen je Narr, dazu ×1,5 bei voller Narrenbank',
    onHand: (ctx) => {
      const full = ctx.run.mods.length >= ctx.run.modSlots + ctx.run.mods.filter((m) => m.foil === 'clear').length;
      return { mult: 2 * ctx.run.mods.length, ...(full ? { xmult: 1.5 } : {}) };
    },
  },
  {
    key: 'apple',
    name: 'Der Apfel der Königin',
    emoji: '🍎',
    rarity: 'uncommon',
    price: 6,
    text: '×3 Lachen. Nach 10 Vorführungen ist er aufgegessen',
    initial: 10,
    onHand: () => ({ xmult: 3 }),
    afterHand: (mod) => ((mod.value ?? 10) - 1 <= 0 ? null : { ...mod, value: (mod.value ?? 10) - 1 }),
  },
  {
    key: 'king',
    name: 'Der Lieblingsnarr',
    emoji: '👑',
    rarity: 'rare',
    price: 9,
    text: '×1 Lachen, dazu ×0,25 je gewonnener Audienz',
    initial: 1,
    onHand: (_, mod) => ((mod.value ?? 1) > 1 ? { xmult: mod.value ?? 1 } : null),
    onRoundEnd: (mod) => ({ mod: { ...mod, value: (mod.value ?? 1) + 0.25 } }),
  },

  // Werkstatt-Mods (Token)
  {
    key: 'piggy',
    name: 'Die Köchin',
    emoji: '👩‍🍳',
    rarity: 'common',
    price: 6,
    text: '+1 🥨 am Ende jeder Audienz, je Hoftag 1 mehr',
    onRoundEnd: (_, run) => ({ tokens: run.level }),
  },
  {
    key: 'patience',
    name: 'Der Geduldige',
    emoji: '🧘',
    rarity: 'common',
    price: 4,
    text: '+2 🥨 am Ende der Audienz, wenn nicht getauscht wurde',
    onRoundEnd: (_, run) => ({
      tokens: run.current && run.current.discardsLeft === run.discards ? 2 : 0,
    }),
  },
  {
    key: 'robot',
    name: 'Der Blechnarr',
    emoji: '🤖',
    rarity: 'uncommon',
    price: 6,
    text: 'Ein Uhrwerk: Jede 4. Vorführung +20 Lachen',
    initial: 0,
    onHand: (_, mod) => (((mod.value ?? 0) + 1) % 4 === 0 ? { mult: 20 } : null),
    afterHand: (mod) => ({ ...mod, value: (mod.value ?? 0) + 1 }),
  },
  {
    key: 'recycler',
    name: 'Der Lumpensammler',
    emoji: '🧺',
    rarity: 'uncommon',
    price: 5,
    text: '+1 🥨 je getauschte Bildkarte',
    onDiscard: (cards) => ({
      tokens: cards.filter((c) => c.enh !== 'granite' && isFace(c.rank)).length,
    }),
  },

  // Dauerhafte Wirkungen

  // Legendär (nur aus der Traumkarte „Seele“)
  {
    key: 'unicorn',
    name: 'Das Einhorn',
    emoji: '🦄',
    rarity: 'legendary',
    price: 20,
    text: 'Alle Karten zählen als jede Farbe',
    // Die Wirkung steckt in der Kombi-Erkennung (scoring.ts, `allColors`).
  },
  {
    key: 'santaClaus',
    name: 'Der Hofzauberer',
    emoji: '🧙',
    rarity: 'legendary',
    price: 20,
    text: 'Jede gewertete Bildkarte zählt zweimal',
    retrigger: (card) => (card.enh !== 'granite' && isFace(card.rank) ? 1 : 0),
  },
  {
    key: 'painter',
    name: 'Der Meistermaler',
    emoji: '🖌️',
    rarity: 'legendary',
    price: 20,
    text: '×2 Lachen je Farbe, die unter den gewerteten Karten vorkommt, ab der zweiten',
    onHand: (ctx) => {
      const colors = new Set(ctx.scoring.filter((c) => c.enh !== 'granite').map((c) => (c.enh === 'ombre' ? '*' : c.color)));
      const count = colors.size;
      return count >= 2 ? { xmult: 2 ** (count - 1) } : null;
    },
  },

  // Mehrspieler-Mods: nur zu mehreren im Laden, keiner schadet anderen.
  {
    key: 'shield',
    name: 'Der Schildträger',
    emoji: '🛡️',
    rarity: 'common',
    price: 5,
    multi: ['duel', 'showdown'],
    text: '+25 Witz je verlorenes Herz',
    onHand: (ctx) => (ctx.run.livesLost > 0 ? { chips: 25 * ctx.run.livesLost } : null),
  },
  {
    key: 'pacifist',
    name: 'Der Friedfertige',
    emoji: '🕊️',
    rarity: 'uncommon',
    price: 6,
    multi: ['duel', 'showdown'],
    text: '×2 Lachen in normalen Audienzen, im Wettstreit aber ×0,5',
    onHand: (ctx) => ({ xmult: ctx.run.current?.duel ? 0.5 : 2 }),
  },
  {
    key: 'spy',
    name: 'Der Lauscher',
    emoji: '🕵️',
    rarity: 'common',
    price: 3,
    multi: ['duel', 'showdown'],
    text: 'Du hörst im Wettstreit den Applaus der anderen schon während des Spiels',
  },
  {
    key: 'team',
    name: 'Der Gesellige',
    emoji: '🤝',
    rarity: 'common',
    price: 5,
    multi: ['duel', 'showdown', 'survival', 'race'],
    text: '+3 Lachen je Mitspieler, der noch dabei ist',
    onHand: (ctx) => (ctx.table.others > 0 ? { mult: 3 * ctx.table.others } : null),
  },
  {
    key: 'chase',
    name: 'Der Nachzügler',
    emoji: '🐢',
    rarity: 'uncommon',
    price: 6,
    multi: ['duel', 'showdown', 'survival', 'race'],
    text: '+30 Witz und +3 Lachen je Hoftag Rückstand auf den Ersten',
    onHand: (ctx) => (ctx.table.behind > 0 ? { chips: 30 * ctx.table.behind, mult: 3 * ctx.table.behind } : null),
  },
  {
    key: 'secondChance',
    name: 'Der Schutzengel',
    emoji: '😇',
    rarity: 'rare',
    price: 8,
    multi: ['duel', 'showdown', 'survival', 'race'],
    text: 'Würdest du ein Herz verlieren oder ausscheiden, geht der Schutzengel stattdessen',
  },
  {
    key: 'champion',
    name: 'Der Turniersieger',
    emoji: '🏆',
    rarity: 'uncommon',
    price: 6,
    multi: ['duel', 'showdown'],
    text: '+3 Lachen je gewonnenen Wettstreit',
    onHand: (ctx) => (ctx.run.duelsWon > 0 ? { mult: 3 * ctx.run.duelsWon } : null),
  },
];

export const MODS: Record<string, ModDef> = Object.fromEntries(list.map((def) => [def.key, def]));
export const MOD_KEYS = list.map((def) => def.key);

export function modDef(key: string): ModDef {
  const def = MODS[key];
  if (!def) throw new Error(`Unbekannter Narr: ${key}`);
  return def;
}

export const RARITY_INFO: Record<Rarity, { name: string; weight: number }> = {
  common: { name: 'gewöhnlich', weight: 70 },
  uncommon: { name: 'ungewöhnlich', weight: 25 },
  rare: { name: 'selten', weight: 5 },
  legendary: { name: 'legendär', weight: 0 },
};
