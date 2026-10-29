import type { Color, Enhancement, Foil, HandType, PackKind, PackSize, Seal, Sticker } from './types';

// ---------------------------------------------------------------- Kunststücke (Zauberkarten)

export interface SpellDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
  /** Wie viele Handkarten ausgewählt sein müssen: [mindestens, höchstens]. */
  targets: [number, number];
  enhance?: Enhancement;
  color?: Color;
}

const spells: SpellDef[] = [
  {
    key: 'fool',
    name: 'Da capo!',
    emoji: '🔁',
    text: 'Erzeugt das zuletzt benutzte Kunststück oder die zuletzt benutzte Übung (außer „Da capo!“)',
    targets: [0, 0],
  },
  {
    key: 'magician',
    name: 'Der Magier',
    emoji: '🎩',
    text: 'Bis zu 2 Karten bekommen eine Sternen-Welle',
    targets: [1, 2],
    enhance: 'star',
  },
  {
    key: 'priestess',
    name: 'Die Hohepriesterin',
    emoji: '🔮',
    text: 'Erzeugt bis zu 2 zufällige Übungen',
    targets: [0, 0],
  },
  {
    key: 'empress',
    name: 'Die Herrscherin',
    emoji: '👸',
    text: 'Bis zu 2 Karten bekommen Glossing',
    targets: [1, 2],
    enhance: 'gloss',
  },
  {
    key: 'emperor',
    name: 'Der Herrscher',
    emoji: '🤴',
    text: 'Erzeugt bis zu 2 zufällige Kunststücke',
    targets: [0, 0],
  },
  {
    key: 'hierophant',
    name: 'Der Hierophant',
    emoji: '🕍',
    text: 'Bis zu 2 Karten bekommen den Granit-Look',
    targets: [1, 2],
    enhance: 'granite',
  },
  {
    key: 'lovers',
    name: 'Die Liebenden',
    emoji: '💑',
    text: '1 Karte bekommt Ombré (zählt als jede Farbe)',
    targets: [1, 1],
    enhance: 'ombre',
  },
  {
    key: 'chariot',
    name: 'Der Wagen',
    emoji: '🏇',
    text: '1 Karte bekommt eine Keratin-Kur',
    targets: [1, 1],
    enhance: 'keratin',
  },
  {
    key: 'justice',
    name: 'Die Gerechtigkeit',
    emoji: '⚖️',
    text: '1 Karte bekommt eine Blondierung',
    targets: [1, 1],
    enhance: 'blond',
  },
  {
    key: 'hermit',
    name: 'Der Eremit',
    emoji: '🧙',
    text: 'Verdoppelt deine Brezeln (höchstens +20 🥨)',
    targets: [0, 0],
  },
  {
    key: 'wheel',
    name: 'Das Rad',
    emoji: '🎡',
    text: 'Zu 1/4 bekommt ein zufälliger Narr eine Folie',
    targets: [0, 0],
  },
  {
    key: 'strength',
    name: 'Die Kraft',
    emoji: '💪',
    text: 'Bis zu 2 Karten steigen um einen Rang',
    targets: [1, 2],
  },
  {
    key: 'hanged',
    name: 'Der Gehängte',
    emoji: '🙃',
    text: 'Bis zu 2 Karten werden aus dem Deck entfernt',
    targets: [1, 2],
  },
  {
    key: 'death',
    name: 'Der Tod',
    emoji: '💀',
    text: '2 Karten wählen: Die linke wird zur Kopie der rechten',
    targets: [2, 2],
  },
  {
    key: 'temperance',
    name: 'Die Mäßigkeit',
    emoji: '🍵',
    text: 'Gibt den Verkaufswert aller Narren als Brezeln (höchstens 50 🥨)',
    targets: [0, 0],
  },
  {
    key: 'devil',
    name: 'Der Teufel',
    emoji: '😈',
    text: '1 Karte bekommt Gold-Strähnen',
    targets: [1, 1],
    enhance: 'gold',
  },
  {
    key: 'tower',
    name: 'Der Turm',
    emoji: '🗼',
    text: '1 Karte bekommt einen Volumen-Boost',
    targets: [1, 1],
    enhance: 'volume',
  },
  {
    key: 'star',
    name: 'Der Stern',
    emoji: '⭐',
    text: 'Bis zu 3 Karten werden Karo',
    targets: [1, 3],
    color: 'd',
  },
  {
    key: 'moon',
    name: 'Der Mond',
    emoji: '🌙',
    text: 'Bis zu 3 Karten werden Pik',
    targets: [1, 3],
    color: 's',
  },
  {
    key: 'sun',
    name: 'Die Sonne',
    emoji: '☀️',
    text: 'Bis zu 3 Karten werden Herz',
    targets: [1, 3],
    color: 'h',
  },
  {
    key: 'judgement',
    name: 'Das Gericht',
    emoji: '📯',
    text: 'Erzeugt einen zufälligen Narren (wenn Platz ist)',
    targets: [0, 0],
  },
  {
    key: 'world',
    name: 'Die Welt',
    emoji: '🌍',
    text: 'Bis zu 3 Karten werden Kreuz',
    targets: [1, 3],
    color: 'c',
  },
];
export const SPELLS: Record<string, SpellDef> = Object.fromEntries(spells.map((s) => [s.key, s]));
export const SPELL_KEYS = spells.map((s) => s.key);

// ---------------------------------------------------------------- Übungen (Nagelstudio)

export interface NailDef {
  key: string;
  name: string;
  emoji: string;
  hand: HandType;
}

const nails: NailDef[] = [
  { key: 'oil', name: 'Grimasse', emoji: '😝', hand: 'high' },
  { key: 'clearCoat', name: 'Wortspiel', emoji: '🗣️', hand: 'pair' },
  { key: 'french', name: 'Doppelsinn', emoji: '🔀', hand: 'twoPair' },
  { key: 'babyboomer', name: 'Jonglage', emoji: '🤹', hand: 'three' },
  { key: 'stiletto', name: 'Stelzenlauf', emoji: '🦯', hand: 'straight' },
  { key: 'fullcover', name: 'Farbenspiel', emoji: '🎨', hand: 'flush' },
  { key: 'acrylic', name: 'Menschenpyramide', emoji: '🤸', hand: 'fullHouse' },
  { key: 'nailArt', name: 'Feuerspucken', emoji: '🔥', hand: 'four' },
  {
    key: 'fiberglass',
    name: 'Seiltanz',
    emoji: '🎪',
    hand: 'straightFlush',
  },
  { key: 'glitter', name: 'Narrenturm', emoji: '🗼', hand: 'five' },
  { key: 'rhinestone', name: 'Feuerwerk', emoji: '🎆', hand: 'flushHouse' },
  { key: 'chrome', name: 'Königsnummer', emoji: '👑', hand: 'flushFive' },
];
export const NAILS: Record<string, NailDef> = Object.fromEntries(nails.map((n) => [n.key, n]));
export const NAIL_KEYS = nails.map((n) => n.key);
export const NAIL_FOR_HAND = Object.fromEntries(nails.map((n) => [n.hand, n.key])) as Record<HandType, string>;

// ---------------------------------------------------------------- Kuriositäten (Traumkarten)

export interface DreamDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
  targets: [number, number];
  seal?: Seal;
}

const dreams: DreamDef[] = [
  {
    key: 'familyPhoto',
    name: 'Familienfoto',
    emoji: '📸',
    text: 'Entfernt 1 zufällige Handkarte, dafür 3 veredelte Bildkarten ins Deck',
    targets: [0, 0],
  },
  {
    key: 'snowman',
    name: 'Schneemann',
    emoji: '⛄',
    text: 'Entfernt 1 zufällige Handkarte, dafür 2 veredelte Asse ins Deck',
    targets: [0, 0],
  },
  {
    key: 'numbers',
    name: 'Zahlenzauber',
    emoji: '🔢',
    text: 'Entfernt 1 zufällige Handkarte, dafür 4 veredelte Zahlenkarten ins Deck',
    targets: [0, 0],
  },
  {
    key: 'talisman',
    name: 'Talisman',
    emoji: '🏅',
    text: '1 Karte bekommt ein Gold-Wappen',
    targets: [1, 1],
    seal: 'gold',
  },
  {
    key: 'dejaVu',
    name: 'Déjà-vu',
    emoji: '🔁',
    text: '1 Karte bekommt ein rotes Wappen',
    targets: [1, 1],
    seal: 'red',
  },
  {
    key: 'trance',
    name: 'Trance',
    emoji: '🌀',
    text: '1 Karte bekommt ein blaues Wappen',
    targets: [1, 1],
    seal: 'blue',
  },
  {
    key: 'medium',
    name: 'Medium',
    emoji: '🟣',
    text: '1 Karte bekommt ein lila Wappen',
    targets: [1, 1],
    seal: 'purple',
  },
  {
    key: 'aura',
    name: 'Aura',
    emoji: '✨',
    text: '1 Karte bekommt eine zufällige Folie',
    targets: [1, 1],
  },
  {
    key: 'spook',
    name: 'Spukgestalt',
    emoji: '👻',
    text: 'Erzeugt einen seltenen Narren, deine Brezeln gehen auf 0',
    targets: [0, 0],
  },
  {
    key: 'swirl',
    name: 'Farbwirbel',
    emoji: '🌪️',
    text: 'Alle Handkarten bekommen dieselbe zufällige Farbe',
    targets: [0, 0],
  },
  {
    key: 'equalizer',
    name: 'Gleichmacher',
    emoji: '🟰',
    text: 'Alle Handkarten bekommen denselben zufälligen Rang, Handgröße −1',
    targets: [0, 0],
  },
  {
    key: 'bubble',
    name: 'Seifenblase',
    emoji: '🫧',
    text: 'Ein zufälliger Narr wird durchsichtig (+1 Narrenplatz), Handgröße −1',
    targets: [0, 0],
  },
  {
    key: 'cleanup',
    name: 'Großputz',
    emoji: '🧽',
    text: 'Entfernt 5 zufällige Handkarten, dafür +20 🥨',
    targets: [0, 0],
  },
  {
    key: 'mirror',
    name: 'Spiegel',
    emoji: '🪞',
    text: 'Kopiert einen zufälligen Narren, alle anderen (nicht angeklebten) verschwinden',
    targets: [0, 0],
  },
  {
    key: 'spell',
    name: 'Bannkreis',
    emoji: '🪬',
    text: 'Ein zufälliger Narr wird irisierend, alle anderen (nicht angeklebten) verschwinden',
    targets: [0, 0],
  },
  {
    key: 'clone',
    name: 'Klon',
    emoji: '🧬',
    text: '2 Kopien einer Karte ins Deck',
    targets: [1, 1],
  },
  {
    key: 'soul',
    name: 'Seele',
    emoji: '💫',
    text: 'Erzeugt einen legendären Narren (wenn Platz ist)',
    targets: [0, 0],
  },
  {
    key: 'blackHole',
    name: 'Schwarzes Loch',
    emoji: '🕳️',
    text: 'Alle Kombis steigen um 1 Stufe',
    targets: [0, 0],
  },
];
export const DREAMS: Record<string, DreamDef> = Object.fromEntries(dreams.map((d) => [d.key, d]));
/** „Seele“ und „Schwarzes Loch“ sind selten und gibt es nur in Lieferungen. */
export const DREAM_KEYS = dreams.map((d) => d.key).filter((k) => k !== 'soul' && k !== 'blackHole');
export const RARE_DREAMS = ['soul', 'blackHole'];

// ---------------------------------------------------------------- Schneiderei (Veredelungen), Glanz (Folien), Wappen (Abzeichen)

export const ENHANCEMENTS: Record<Enhancement, { name: string; emoji: string; text: string }> = {
  granite: {
    name: 'Pflasterstein',
    emoji: '🪨',
    text: '50 Witz, kein Rang und keine Farbe, wird immer gewertet',
  },
  volume: { name: 'Schellenbesatz', emoji: '🔔', text: '+30 Witz' },
  gloss: { name: 'Schminke', emoji: '💄', text: '+4 Lachen' },
  ombre: { name: 'Flickenmuster', emoji: '🧩', text: 'Zählt als jede Farbe' },
  gold: {
    name: 'Goldstickerei',
    emoji: '🧵',
    text: '+3 🥨, wenn sie am Ende der Audienz in der Hand ist',
  },
  blond: {
    name: 'Glasperlen',
    emoji: '🫧',
    text: '×2 Lachen, löst sich zu 1/4 auf',
  },
  keratin: {
    name: 'Kettenhemd',
    emoji: '🛡️',
    text: '×1,5 Lachen, solange sie in der Hand bleibt',
  },
  star: {
    name: 'Kleeblatt',
    emoji: '🍀',
    text: 'Zu 1/5: +20 Lachen. Zu 1/15: +20 🥨',
  },
};

export const FOILS: Record<Foil, { name: string; emoji: string; text: string; price: number }> = {
  hot: { name: 'Vergoldet', emoji: '✨', text: '+50 Witz', price: 2 },
  holo: { name: 'Perlmutt', emoji: '🦪', text: '+10 Lachen', price: 3 },
  iris: { name: 'Buntglas', emoji: '🪟', text: '×1,5 Lachen', price: 5 },
  clear: { name: 'Unsichtbar', emoji: '👻', text: '+1 Narrenplatz', price: 5 },
};

export const SEALS: Record<Seal, { name: string; emoji: string; text: string }> = {
  gold: {
    name: 'Brezel-Wappen',
    emoji: '🥨',
    text: '+3 🥨, wenn die Karte gewertet wird',
  },
  red: {
    name: 'Echo-Wappen',
    emoji: '🔁',
    text: 'Die Karte zählt doppelt',
  },
  blue: {
    name: 'Eulen-Wappen',
    emoji: '🦉',
    text: 'Bleibt sie am Ende der Audienz in der Hand: Übung der letzten Kombi',
  },
  purple: {
    name: 'Feder-Wappen',
    emoji: '🪶',
    text: 'Beim Tauschen: ein zufälliges Kunststück',
  },
};

export const STICKERS: Record<Sticker, { name: string; emoji: string; text: string }> = {
  eternal: {
    name: 'Treu',
    emoji: '📌',
    text: 'Lässt sich nicht verkaufen oder entfernen',
  },
  perishable: {
    name: 'Müde',
    emoji: '😴',
    text: 'Wirkt nach 5 Audienzen nicht mehr',
  },
  rental: {
    name: 'Gastnarr',
    emoji: '🧳',
    text: 'Kostet 1 🥨, dafür 3 🥨 je Audienz',
  },
};

// ---------------------------------------------------------------- Bündel (Lieferungen)

export const PACK_KINDS: Record<PackKind, { name: string; emoji: string; text: string }> = {
  mods: { name: 'Narrenkorb', emoji: '🧺', text: 'Narren' },
  spells: {
    name: 'Trickbeutel',
    emoji: '👝',
    text: 'Kunststücke – direkt auf deine Karten anwenden',
  },
  nails: { name: 'Bücherbündel', emoji: '📚', text: 'Übungen' },
  dreams: {
    name: 'Wunderkiste',
    emoji: '🏺',
    text: 'Kuriositäten – direkt anwenden',
  },
  cards: { name: 'Kartenbündel', emoji: '🎴', text: 'Spielkarten fürs Deck' },
};

export const PACK_SIZES: Record<
  PackSize,
  {
    name: string;
    items: Record<PackKind, number>;
    picks: number;
    price: number;
  }
> = {
  normal: {
    name: '',
    items: { mods: 2, spells: 3, nails: 3, dreams: 2, cards: 3 },
    picks: 1,
    price: 4,
  },
  big: {
    name: 'groß',
    items: { mods: 4, spells: 5, nails: 5, dreams: 4, cards: 5 },
    picks: 1,
    price: 6,
  },
  huge: {
    name: 'riesig',
    items: { mods: 4, spells: 5, nails: 5, dreams: 4, cards: 5 },
    picks: 2,
    price: 8,
  },
};

/** Häufigkeit der Lieferungs-Arten im Laden. */
export const PACK_WEIGHTS: [PackKind, number][] = [
  ['mods', 3],
  ['spells', 4],
  ['nails', 4],
  ['cards', 4],
  ['dreams', 1],
];
export const PACK_SIZE_WEIGHTS: [PackSize, number][] = [
  ['normal', 8],
  ['big', 3],
  ['huge', 1],
];

// ---------------------------------------------------------------- Privilegien (Werkzeuge)

export interface ToolDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
  /** Erst nach diesem Werkzeug erhältlich. */
  requires?: string;
}

/** Preis fürs Neuwählen des Bosses. */
export const BOSS_REROLL_PRICE = 5;

const tools: ToolDef[] = [
  {
    key: 'magnet',
    name: 'Marktrecht',
    emoji: '🎪',
    text: '+1 Angebot auf dem Jahrmarkt',
  },
  {
    key: 'superMagnet',
    name: 'Großes Marktrecht',
    emoji: '🎪',
    text: '+1 weiteres Angebot',
    requires: 'magnet',
  },
  {
    key: 'sale',
    name: 'Hoflieferant',
    emoji: '🏷️',
    text: 'Alles 25 % günstiger',
    requires: undefined,
  },
  {
    key: 'bigSale',
    name: 'Königlicher Hoflieferant',
    emoji: '🏷️',
    text: 'Alles 50 % günstiger',
    requires: 'sale',
  },
  {
    key: 'tidy',
    name: 'Kurze Wege',
    emoji: '🚶',
    text: 'Weiterschlendern 2 🥨 günstiger',
  },
  {
    key: 'tidy2',
    name: 'Abkürzung',
    emoji: '🏃',
    text: 'Weiterschlendern weitere 2 🥨 günstiger',
    requires: 'tidy',
  },
  {
    key: 'extraHand',
    name: 'Zugabe',
    emoji: '👏',
    text: '+1 Vorführung je Audienz',
  },
  {
    key: 'extraHand2',
    name: 'Doppelte Zugabe',
    emoji: '🙌',
    text: '+1 weitere Vorführung je Audienz',
    requires: 'extraHand',
  },
  {
    key: 'bin',
    name: 'Kartentisch',
    emoji: '🃏',
    text: '+1 Tauschen je Audienz',
  },
  {
    key: 'bin2',
    name: 'Großer Kartentisch',
    emoji: '🎴',
    text: '+1 weiteres Tauschen je Audienz',
    requires: 'bin',
  },
  { key: 'bag', name: 'Weite Ärmel', emoji: '👘', text: '+1 Handgröße' },
  {
    key: 'bag2',
    name: 'Zauberärmel',
    emoji: '🥻',
    text: '+1 weitere Handgröße',
    requires: 'bag',
  },
  {
    key: 'basket',
    name: 'Größere Narrentasche',
    emoji: '👝',
    text: '+1 Platz in der Narrentasche',
  },
  {
    key: 'book',
    name: 'Vorratskammer',
    emoji: '🥫',
    text: 'Vorratsbonus bis 8 🥨',
    requires: undefined,
  },
  {
    key: 'book2',
    name: 'Große Vorratskammer',
    emoji: '🏰',
    text: 'Vorratsbonus bis 16 🥨',
    requires: 'book',
  },
  {
    key: 'shelf',
    name: 'Zweite Narrenbank',
    emoji: '🪑',
    text: '+1 Narrenplatz',
    requires: 'magnet',
  },
  {
    key: 'scope',
    name: 'Bittschrift',
    emoji: '📜',
    text: `Einmal je Hoftag eine andere Herrschaft in den Thronsaal bitten (${BOSS_REROLL_PRICE} 🥨)`,
  },
  {
    key: 'scope2',
    name: 'Gnadengesuch',
    emoji: '📯',
    text: `Beliebig oft eine andere Herrschaft bitten (je ${BOSS_REROLL_PRICE} 🥨)`,
    requires: 'scope',
  },
];
export const TOOLS: Record<string, ToolDef> = Object.fromEntries(tools.map((t) => [t.key, t]));
export const TOOL_KEYS = tools.map((t) => t.key);
export const TOOL_PRICE = 10;

// ---------------------------------------------------------------- Gefallen (Sticker fürs Überspringen)

export interface TagDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
}

const tags: TagDef[] = [
  {
    key: 'modBox',
    name: 'Narrenkorb gratis',
    emoji: '🧺',
    text: 'Öffnet sofort einen großen Narrenkorb',
  },
  {
    key: 'spellBox',
    name: 'Trickbeutel gratis',
    emoji: '👝',
    text: 'Öffnet sofort einen riesigen Trickbeutel',
  },
  {
    key: 'nailBox',
    name: 'Bücherbündel gratis',
    emoji: '📚',
    text: 'Öffnet sofort ein riesiges Bücherbündel',
  },
  {
    key: 'coupon',
    name: 'Freier Eintritt',
    emoji: '🎟️',
    text: 'Angebote und Bündel auf dem nächsten Jahrmarkt kosten nichts',
  },
  {
    key: 'rare',
    name: 'Seltener Fund',
    emoji: '💎',
    text: 'Auf dem nächsten Jahrmarkt wartet ein seltener Narr gratis',
  },
  {
    key: 'foil',
    name: 'Perlmuttfund',
    emoji: '🦪',
    text: 'Der erste Narr auf dem nächsten Jahrmarkt glänzt in Perlmutt und ist gratis',
  },
  {
    key: 'stock',
    name: 'Festschmaus',
    emoji: '🍗',
    text: '+25 🥨 nach dem nächsten Thronsaal',
  },
  {
    key: 'double',
    name: 'Doppelte Ration',
    emoji: '🥨',
    text: 'Verdoppelt deine Brezeln (höchstens +40 🥨)',
  },
];
export const TAGS: Record<string, TagDef> = Object.fromEntries(tags.map((t) => [t.key, t]));
export const TAG_KEYS = tags.map((t) => t.key);

// ---------------------------------------------------------------- Narrenkappen (Kartensätze) und Hofränge (Sortierstufen)

export interface DeckDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
}

export const DECKS: DeckDef[] = [
  {
    key: 'standard',
    name: 'Schlichte Kappe',
    emoji: '🧢',
    text: 'Ohne Besonderheiten',
  },
  { key: 'red', name: 'Wandergaukler', emoji: '🎒', text: '+1 Tauschen je Audienz' },
  { key: 'blue', name: 'Klosterschüler', emoji: '📿', text: '+1 Vorführung je Audienz' },
  { key: 'yellow', name: 'Bäckerskind', emoji: '🥐', text: '+10 🥨 zu Beginn' },
  {
    key: 'green',
    name: 'Bauernkind',
    emoji: '🌾',
    text: 'Kein Vorratsbonus, dafür +2 🥨 je übrige Vorführung und +1 🥨 je übriges Tauschen',
  },
  {
    key: 'black',
    name: 'Puppenspieler',
    emoji: '🎎',
    text: '+1 Narrenplatz, −1 Vorführung je Audienz',
  },
  {
    key: 'magic',
    name: 'Zauberlehrling',
    emoji: '🪄',
    text: 'Startet mit der größeren Narrentasche und zweimal „Da capo!“',
  },
];

export const STAKES: { name: string; emoji: string; text: string }[] = [
  { name: 'Lehrling', emoji: '🌱', text: 'Normale Regeln' },
  { name: 'Geselle', emoji: '🌿', text: 'Die Morgenaudienz bringt keine Grundbelohnung' },
  { name: 'Spaßmacher', emoji: '🎈', text: 'Die Ziele wachsen schneller' },
  {
    name: 'Hofnarr',
    emoji: '🃏',
    text: 'Narren können treu sein (nicht verkaufbar)',
  },
  { name: 'Oberhofnarr', emoji: '🎖️', text: '−1 Tauschen je Audienz' },
  { name: 'Königsnarr', emoji: '👑', text: 'Die Ziele wachsen noch schneller' },
  {
    name: 'Narrenmeister',
    emoji: '🏅',
    text: 'Narren können müde werden (nach 5 Audienzen wirkungslos)',
  },
  {
    name: 'Narrenkönig',
    emoji: '🤴',
    text: 'Narren können Gastnarren sein (1 🥨, aber 3 🥨 je Audienz)',
  },
];

const TARGETS = [
  [300, 750, 1900, 4600, 10000, 19000, 33000, 52000],
  [300, 850, 2400, 6500, 15000, 30000, 55000, 90000],
  [300, 950, 2900, 8200, 20000, 42000, 80000, 140000],
];

/** Grundziel eines Levels (Vorhut); Wächter ×1,5, Boss ×2,2. */
export function levelTarget(level: number, stake: number): number {
  const table = TARGETS[stake >= 6 ? 2 : stake >= 3 ? 1 : 0]!;
  if (level <= table.length) return table[Math.max(0, level - 1)]!;
  // Endlos: jedes weitere Level etwa dreimal so viel.
  return Math.round(table[table.length - 1]! * 3 ** (level - table.length));
}

// ---------------------------------------------------------------- Herrschaften (Bosse) und Höflinge

export interface BossDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
  minLevel: number;
  /** Nur als Boss im letzten Level (8, 16, …). */
  final?: boolean;
  /** Zusätzlicher Faktor auf das Boss-Ziel. */
  targetFactor?: number;
  /** Farbe, deren Karten nicht zählen. */
  debuffColor?: Color;
}

const bosses: BossDef[] = [
  {
    key: 'ratKing',
    name: 'Der Rattenkönig',
    emoji: '🐀',
    text: '−1 🥨 je gewertete Karte',
    minLevel: 2,
  },
  {
    key: 'spider',
    name: 'Gräfin Spinnweb',
    emoji: '🕷️',
    text: 'Es müssen genau 5 Karten gespielt werden',
    minLevel: 1,
  },
  {
    key: 'wolf',
    name: 'Ritter Isegrim',
    emoji: '🐺',
    text: 'Kreuz-Karten zählen nicht',
    minLevel: 1,
    debuffColor: 'c',
  },
  {
    key: 'boar',
    name: 'Oberjäger Keiler',
    emoji: '🐗',
    text: 'Wirft nach jeder Vorführung 2 zufällige Handkarten ab',
    minLevel: 1,
  },
  {
    key: 'bear',
    name: 'Braun, der Bär',
    emoji: '🐻',
    text: 'Doppelt so hohes Ziel',
    minLevel: 2,
    targetFactor: 2,
  },
  {
    key: 'croco',
    name: 'Zöllner Kroko',
    emoji: '🐊',
    text: 'Kein Tauschen',
    minLevel: 2,
  },
  {
    key: 'snake',
    name: 'Kanzlerin Natter',
    emoji: '🐍',
    text: 'Jede Kombi-Art nur einmal',
    minLevel: 3,
  },
  {
    key: 'ape',
    name: 'Gesandter Affe',
    emoji: '🦍',
    text: 'Grund-Witz und -Lachen der Kombi halbiert',
    minLevel: 2,
  },
  {
    key: 'cactus',
    name: 'König Kaktus aus dem Süden',
    emoji: '🌵',
    text: 'Nur eine Vorführung',
    minLevel: 2,
  },
  {
    key: 'ghost',
    name: 'Das Schlossgespenst',
    emoji: '🏰',
    text: 'Die ersten Karten werden verdeckt gezogen',
    minLevel: 2,
  },
  {
    key: 'frog',
    name: 'Der Froschkönig',
    emoji: '🐸',
    text: 'Bildkarten werden verdeckt gezogen',
    minLevel: 2,
  },
  {
    key: 'shark',
    name: 'Admiral Hai',
    emoji: '🦈',
    text: 'Nach jeder Vorführung wird verdeckt nachgezogen',
    minLevel: 2,
  },
  {
    key: 'eagle',
    name: 'Fürst Adler',
    emoji: '🦅',
    text: 'Karo-Karten zählen nicht',
    minLevel: 1,
    debuffColor: 'd',
  },
  {
    key: 'guardian',
    name: 'Förster Eiche',
    emoji: '🌳',
    text: 'Bildkarten zählen nicht',
    minLevel: 4,
  },
  {
    key: 'golem',
    name: 'Steinmetz Golem',
    emoji: '🗿',
    text: 'Karten, die an diesem Hoftag schon gespielt wurden, zählen nicht',
    minLevel: 1,
  },
  {
    key: 'lizard',
    name: 'Feuerwerker Echse',
    emoji: '🦎',
    text: 'Die gespielte Kombi verliert 1 Stufe',
    minLevel: 2,
  },
  {
    key: 'yeti',
    name: 'Der Yeti aus dem Norden',
    emoji: '❄️',
    text: 'Pik-Karten zählen nicht',
    minLevel: 1,
    debuffColor: 's',
  },
  {
    key: 'storm',
    name: 'Bote Sturmvogel',
    emoji: '🌩️',
    text: 'Jede 7. Karte wird verdeckt gezogen',
    minLevel: 2,
  },
  {
    key: 'minotaur',
    name: 'Kerkermeister Minotaurus',
    emoji: '🐂',
    text: 'Herz-Karten zählen nicht',
    minLevel: 1,
    debuffColor: 'h',
  },
  {
    key: 'lion',
    name: 'König Nobel',
    emoji: '🦁',
    text: 'Nur eine Kombi-Art',
    minLevel: 2,
  },
  {
    key: 'owl',
    name: 'Hofgelehrte Uhu',
    emoji: '🦉',
    text: 'Handgröße −1',
    minLevel: 1,
  },
  {
    key: 'dragon',
    name: 'Drachenfürstin',
    emoji: '🐲',
    text: 'Die Lieblings-Kombi (am häufigsten gespielt) bringt keinen Applaus',
    minLevel: 3,
  },
  {
    key: 'seaSerpent',
    name: 'Seekönigin',
    emoji: '🐉',
    text: 'Alle Karten zählen nicht, bis ein Narr verkauft wird',
    minLevel: 8,
    final: true,
  },
  {
    key: 'phoenix',
    name: 'Feuerfürst Phönix',
    emoji: '☄️',
    text: 'Mischt die Reihenfolge der Narren vor jeder Vorführung',
    minLevel: 8,
    final: true,
  },
  {
    key: 'unicorn',
    name: 'Prinzessin Einhorn',
    emoji: '🦄',
    text: 'Dreimal so hohes Ziel',
    minLevel: 8,
    final: true,
    targetFactor: 3,
  },
];
export const BOSSES: Record<string, BossDef> = Object.fromEntries(bosses.map((b) => [b.key, b]));
export const BOSS_LIST = bosses;

/** Höflinge und Edle für Morgenaudienz und Festmahl (nur Gesicht und Name). */
export const CREATURES: { name: string; emoji: string }[] = [
  { name: 'Page Mikrobe', emoji: '🦠' },
  { name: 'Diener Ameise', emoji: '🐜' },
  { name: 'Zofe Marienkäfer', emoji: '🐞' },
  { name: 'Bote Schnecke', emoji: '🐌' },
  { name: 'Küchenmaus', emoji: '🐭' },
  { name: 'Gärtner Igel', emoji: '🦔' },
  { name: 'Lampe, der Hase', emoji: '🐰' },
  { name: 'Reineke Fuchs', emoji: '🦊' },
  { name: 'Wäscher Waschbär', emoji: '🦝' },
  { name: 'Schreiberin Eule', emoji: '🦉' },
  { name: 'Mundschenk Pinguin', emoji: '🐧' },
  { name: 'Musikus Krake', emoji: '🐙' },
  { name: 'Baumeister Biber', emoji: '🦫' },
  { name: 'Freiherr Panda', emoji: '🐼' },
  { name: 'Freifrau Koala', emoji: '🐨' },
  { name: 'Graf Tiger', emoji: '🐯' },
  { name: 'Ritter Nashorn', emoji: '🦏' },
  { name: 'Herzog Elefant', emoji: '🐘' },
  { name: 'Altkanzler Mammut', emoji: '🦣' },
  { name: 'Kurfürst T-Rex', emoji: '🦖' },
];

/** Gesicht des Gegners einer Runde – fest je Level und Runde. */
export function creatureFor(level: number, round: number): { name: string; emoji: string } {
  const index = Math.min(CREATURES.length - 1, Math.max(0, (level - 1) * 2 + round + Math.floor(level / 3)));
  return CREATURES[index]!;
}
