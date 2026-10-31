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
}

const spells: SpellDef[] = [
  // Verkleiden: Karten bekommen eine Verzierung aus der Schneiderei.
  { key: 'magician', name: 'Glücksklee anstecken', emoji: '🍀', text: 'Bis zu 2 Karten bekommen ein Kleeblatt', targets: [1, 2], enhance: 'star' },
  { key: 'empress', name: 'Schminkkasten', emoji: '💄', text: 'Bis zu 3 Karten bekommen Schminke', targets: [1, 3], enhance: 'gloss' },
  { key: 'hierophant', name: 'Pflastern', emoji: '🪨', text: '1 Karte wird zum Pflasterstein, dafür +2 🥨', targets: [1, 1], enhance: 'granite' },
  { key: 'tower', name: 'Schellen annähen', emoji: '🔔', text: 'Bis zu 2 Karten bekommen einen Schellenbesatz', targets: [1, 2], enhance: 'volume' },
  { key: 'lovers', name: 'Flickschneiderei', emoji: '🧩', text: '1 Karte bekommt ein Flickenmuster (zählt als jede Farbe)', targets: [1, 1], enhance: 'ombre' },
  { key: 'chariot', name: 'Rüstkammer', emoji: '🛡️', text: '1 Karte bekommt ein Kettenhemd', targets: [1, 1], enhance: 'keratin' },
  { key: 'justice', name: 'Perlenschnur', emoji: '🫧', text: '1 Karte bekommt Glasperlen', targets: [1, 1], enhance: 'blond' },
  { key: 'devil', name: 'Goldfaden', emoji: '🧵', text: '1 Karte bekommt eine Goldstickerei', targets: [1, 1], enhance: 'gold' },
  // Kartentricks
  { key: 'dye', name: 'Färberei', emoji: '🎨', text: 'Wähle 2 bis 4 Karten: Alle bekommen die Farbe der linken', targets: [2, 4] },
  { key: 'strength', name: 'Purzelbaum', emoji: '🤸', text: 'Die linke gewählte Karte steigt um einen Rang, eine zweite fällt um einen Rang', targets: [1, 2] },
  { key: 'swap', name: 'Vertauscht!', emoji: '🔀', text: '2 Karten tauschen ihre Ränge', targets: [2, 2] },
  { key: 'hanged', name: 'Ausmisten', emoji: '🧹', text: 'Bis zu 2 Karten verlassen das Deck, +1 🥨 je Karte', targets: [1, 2] },
  // Hofgeschäfte
  { key: 'harvest', name: 'Erntedank', emoji: '🌾', text: '+2 🥨 je Herrschaft, die du schon zum Lachen gebracht hast (höchstens 16)', targets: [0, 0] },
  { key: 'polish', name: 'Polierlappen', emoji: '🧽', text: 'Der erste Narr ohne Glanz (von links) bekommt Perlmutt', targets: [0, 0] },
  { key: 'priestess', name: 'Schulstunde', emoji: '📖', text: 'Erzeugt die Übung deiner meistgespielten Kombi', targets: [0, 0] },
  { key: 'judgement', name: 'Einladung', emoji: '✉️', text: 'Ein zufälliger gewöhnlicher Narr kommt dazu (wenn Platz ist)', targets: [0, 0] },
  {
    key: 'fool',
    name: 'Da capo!',
    emoji: '🔁',
    text: 'Erzeugt das zuletzt benutzte Kunststück oder die zuletzt benutzte Übung (außer „Da capo!“)',
    targets: [0, 0],
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
}

const dreams: DreamDef[] = [
  { key: 'familyPhoto', name: 'Ahnengalerie', emoji: '🖼️', text: 'Entfernt 1 zufällige Handkarte, dafür 3 verzierte Bildkarten ins Deck', targets: [0, 0] },
  { key: 'snowman', name: 'Asse im Ärmel', emoji: '🗡️', text: 'Entfernt 1 zufällige Handkarte, dafür 2 verzierte Asse ins Deck', targets: [0, 0] },
  { key: 'numbers', name: 'Zahlenrolle', emoji: '📜', text: 'Entfernt 1 zufällige Handkarte, dafür 4 verzierte Zahlenkarten ins Deck', targets: [0, 0] },
  { key: 'crestBook', name: 'Wappenbuch', emoji: '📕', text: 'Bis zu 2 Karten bekommen je ein zufälliges Wappen', targets: [1, 2] },
  { key: 'aura', name: 'Polierstein', emoji: '💎', text: '1 Karte bekommt zufälligen Glanz', targets: [1, 1] },
  { key: 'spook', name: 'Flaschengeist', emoji: '🧞', text: 'Erzeugt einen seltenen Narren, deine Brezeln gehen auf 0', targets: [0, 0] },
  { key: 'swirl', name: 'Färbekessel', emoji: '🫕', text: 'Alle Handkarten bekommen dieselbe zufällige Farbe', targets: [0, 0] },
  { key: 'bubble', name: 'Tarnkappe', emoji: '🎩', text: 'Ein zufälliger Narr wird unsichtbar (+1 Narrenplatz), Handgröße −1', targets: [0, 0] },
  { key: 'cleanup', name: 'Kehraus', emoji: '🔥', text: 'Entfernt 5 zufällige Handkarten, dafür +20 🥨', targets: [0, 0] },
  { key: 'magicMirror', name: 'Zauberspiegel', emoji: '🪞', text: 'Der linke Narr wird verdoppelt, ein zufälliger anderer (nicht treuer) geht', targets: [0, 0] },
  { key: 'hourglass', name: 'Sanduhr', emoji: '⏳', text: '+1 Vorführung in der nächsten Audienz, dafür Handgröße −1 dauerhaft', targets: [0, 0] },
  { key: 'compass', name: 'Kompass', emoji: '🧭', text: 'Die nächste Herrschaft im Thronsaal hat keine Marotte', targets: [0, 0] },
  { key: 'soul', name: 'Krone des Narrenkönigs', emoji: '👑', text: 'Erzeugt einen legendären Narren (wenn Platz ist)', targets: [0, 0] },
  { key: 'blackHole', name: 'Große Bibliothek', emoji: '🏛️', text: 'Alle Kombis steigen um 1 Stufe', targets: [0, 0] },
];
export const DREAMS: Record<string, DreamDef> = Object.fromEntries(dreams.map((d) => [d.key, d]));
/** Krone und Große Bibliothek sind selten und gibt es nur in Bündeln. */
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
}

/** Preis fürs Neuwählen des Bosses. */
export const BOSS_REROLL_PRICE = 5;

const tools: ToolDef[] = [
  { key: 'magnet', name: 'Marktrecht', emoji: '🎪', text: '+1 Angebot auf dem Jahrmarkt' },
  { key: 'sale', name: 'Hoflieferant', emoji: '🏷️', text: 'Alles 25 % günstiger' },
  { key: 'tidy', name: 'Kurze Wege', emoji: '🚶', text: 'Weiterschlendern 2 🥨 günstiger' },
  { key: 'extraHand', name: 'Zugabe', emoji: '👏', text: '+1 Vorführung je Audienz' },
  { key: 'bin', name: 'Kartentisch', emoji: '🃏', text: '+1 Tauschen je Audienz' },
  { key: 'bag', name: 'Weite Ärmel', emoji: '👘', text: '+1 Handgröße' },
  { key: 'basket', name: 'Größere Narrentasche', emoji: '👝', text: '+1 Platz in der Narrentasche' },
  { key: 'book', name: 'Vorratskammer', emoji: '🥫', text: 'Vorratsbonus bis 8 🥨' },
  { key: 'shelf', name: 'Zweite Narrenbank', emoji: '🪑', text: '+1 Narrenplatz, −1 Handgröße' },
  { key: 'scope', name: 'Bittschrift', emoji: '📜', text: `Einmal je Hoftag eine andere Herrschaft in den Thronsaal bitten (${BOSS_REROLL_PRICE} 🥨)` },
  { key: 'courtHerald', name: 'Hofherold', emoji: '📯', text: 'Auf jedem Jahrmarkt liegt die Übung deiner meistgespielten Kombi' },
  { key: 'diploma', name: 'Lehrbrief', emoji: '🎓', text: 'Übungen bringen +2 Stufen statt +1' },
  { key: 'breadRight', name: 'Brotrecht', emoji: '🍞', text: '+1 🥨 je gewonnene Audienz, in der du nicht getauscht hast' },
  { key: 'touringStage', name: 'Wanderbühne', emoji: '🎭', text: 'Beim Auslassen wählst du zwischen zwei Gefallen' },
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
  { key: 'giftBasket', name: 'Geschenkkorb', emoji: '🎁', text: 'Öffnet sofort ein zufälliges großes Bündel' },
  { key: 'coupon', name: 'Freier Eintritt', emoji: '🎟️', text: 'Die ersten zwei Angebote auf dem nächsten Jahrmarkt kosten nichts' },
  { key: 'rare', name: 'Empfehlungsschreiben', emoji: '✉️', text: 'Auf dem nächsten Jahrmarkt wartet ein seltener Narr gratis' },
  { key: 'stock', name: 'Festschmaus', emoji: '🍗', text: '+3 🥨 je gewonnene Audienz bis einschließlich zum nächsten Thronsaal' },
  { key: 'bakery', name: 'Bäckerbesuch', emoji: '🥨', text: '+1 🥨 je Narr (höchstens 10)' },
  { key: 'praise', name: 'Lob des Königs', emoji: '🗣️', text: 'Die nächste Audienz braucht 25 % weniger Applaus' },
  { key: 'tutoring', name: 'Nachhilfe', emoji: '📖', text: 'Deine schwächste Kombi steigt sofort um 2 Stufen' },
  { key: 'masquerade', name: 'Maskenball', emoji: '🎭', text: 'Die nächste Herrschaft im Thronsaal hat keine Marotte' },
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
  // Neue Herrschaften (W-017, 31.10.2026), eigene Marotten.
  {
    key: 'crow',
    name: 'Merkenau, die Krähe',
    emoji: '🐦‍⬛',
    text: 'Die erste gewertete Karte jeder Vorführung zählt nicht',
    minLevel: 2,
  },
  {
    key: 'donkey',
    name: 'Abt Esel',
    emoji: '🫏',
    text: 'Schweigegelübde: Vorführungen mit mehr als 3 Karten bringen keinen Applaus',
    minLevel: 3,
  },
  {
    key: 'sloth',
    name: 'Kämmerer Faultier',
    emoji: '🦥',
    text: 'Die erste Vorführung bringt nur halb so viel Applaus',
    minLevel: 2,
  },
  {
    key: 'tomcat',
    name: 'Hinze, der Kater',
    emoji: '🐈',
    text: 'Zollherr: Jedes Tauschen kostet 1 🥨, ohne Brezeln kein Tauschen',
    minLevel: 2,
  },
  {
    key: 'iceQueen',
    name: 'Die Eiskönigin',
    emoji: '👸',
    text: 'Ewiger Winter: Die Karten selbst bringen keinen Witz, nur Kombi und Narren',
    minLevel: 4,
  },
];
export const BOSSES: Record<string, BossDef> = Object.fromEntries(bosses.map((b) => [b.key, b]));
export const BOSS_LIST = bosses;

/** Höflinge und Edle für Morgenaudienz und Festmahl (nur Gesicht und Name). */
/** Ein Gegner der Morgenaudienz (Höfling) oder des Festmahls (Edle) – ohne Regelwirkung. */
export interface Courtier {
  key: string;
  name: string;
  emoji: string;
  /** Begrüßung, wenn die Audienz beginnt. */
  saying: string;
}

/** Höflinge der Morgenaudienz: kleine Tiere, von bescheiden bis wichtig. */
export const COURTIERS_MORNING: Courtier[] = [
  { key: 'mouse', name: 'Page Maus', emoji: '🐭', saying: 'Ich kichere schon, bevor du anfängst.' },
  { key: 'ladybug', name: 'Zofe Marienkäfer', emoji: '🐞', saying: 'Sieben Punkte für einen guten Witz!' },
  { key: 'ant', name: 'Diener Ameise', emoji: '🐜', saying: 'Bitte schnell, ich habe noch viel zu tragen.' },
  { key: 'snail', name: 'Bote Schnecke', emoji: '🐌', saying: 'Die Nachricht von deinem Auftritt ist unterwegs …' },
  { key: 'hedgehog', name: 'Gärtner Igel', emoji: '🦔', saying: 'Nur keine spitzen Bemerkungen!' },
  { key: 'hare', name: 'Lampe, der Hase', emoji: '🐰', saying: 'Erschreck mich bloß nicht mit der Pointe.' },
  { key: 'rooster', name: 'Henning, der Hahn', emoji: '🐓', saying: 'Ich wecke den ganzen Hof, wenn es lustig wird!' },
  { key: 'hamster', name: 'Küchenjunge Hamster', emoji: '🐹', saying: 'Hast du Brezeln dabei? Ich frage nur so.' },
  { key: 'owl', name: 'Schreiberin Eule', emoji: '🦉', saying: 'Ich schreibe jeden Witz mit. Jeden.' },
  { key: 'penguin', name: 'Mundschenk Pinguin', emoji: '🐧', saying: 'Ein Lacher, ein Becher. So ist es Brauch.' },
  { key: 'raccoon', name: 'Wäscher Waschbär', emoji: '🦝', saying: 'Bitte nur saubere Witze.' },
  { key: 'pony', name: 'Stallbursche Pony', emoji: '🐴', saying: 'Ich wiehere gern mit.' },
  { key: 'cat', name: 'Kammerdiener Kater', emoji: '😼', saying: 'Ich habe schon bessere Narren gesehen.' },
  { key: 'octopus', name: 'Hofmusikus Krake', emoji: '🐙', saying: 'Acht Arme zum Klatschen, wenn du es verdienst.' },
  { key: 'beaver', name: 'Baumeister Biber', emoji: '🦫', saying: 'Bau mir einen Witz, der hält.' },
  { key: 'jay', name: 'Markart, der Häher', emoji: '🐦', saying: 'Was du hier erzählst, weiß gleich der ganze Hof.' },
  // Gäste aus dem Zauberwald (Narnia-Stimmung, Figuren aus der Mythologie mit eigenen Namen).
  { key: 'fieneMouse', name: 'Bannerträgerin Fiene', emoji: '🐁', saying: 'Klein, aber mit Degen. Lach mich bloß nicht aus – lach mit mir!' },
  { key: 'faun', name: 'Hofflötist Faun Pankratz', emoji: '🐐', saying: 'Ich spiele dir einen Tusch, wenn die Pointe sitzt.' },
  { key: 'dryad', name: 'Waldfrau Birkenlaub', emoji: '🍃', saying: 'Bei guten Witzen raschelt mein Laub.' },
];

/** Edle beim Festmahl: große Tiere, von Landadel bis Kurfürst. */
export const COURTIERS_FEAST: Courtier[] = [
  { key: 'badger', name: 'Grimbart, der Dachs', emoji: '🦡', saying: 'Als Advokat höre ich mir erst alle Beweise an.' },
  { key: 'fox', name: 'Reineke Fuchs', emoji: '🦊', saying: 'Ich kenne jeden Trick. Überrasch mich.' },
  { key: 'ram', name: 'Bellyn, der Widder', emoji: '🐏', saying: 'Der Hofkaplan lacht nur über fromme Witze.' },
  { key: 'panda', name: 'Freiherr Panda', emoji: '🐼', saying: 'Schwarz oder weiß – Hauptsache, es ist lustig.' },
  { key: 'koala', name: 'Freifrau Koala', emoji: '🐨', saying: 'Weck mich, wenn der Witz kommt.' },
  { key: 'ape', name: 'Frau Rückenau, die Äffin', emoji: '🐒', saying: 'Ich mache dir jede Grimasse nach.' },
  { key: 'goose', name: 'Herzogin Gans', emoji: '🪿', saying: 'Hach, wie amüsant. Vielleicht.' },
  { key: 'flamingo', name: 'Gräfin Flamingo', emoji: '🦩', saying: 'Ich stehe auf einem Bein, bis ich lache.' },
  { key: 'giraffe', name: 'Markgräfin Giraffe', emoji: '🦒', saying: 'Von hier oben sehe ich jede Karte.' },
  { key: 'wolf', name: 'Gieremund, die Wölfin', emoji: '🐺', saying: 'Mein Isegrim hat mir viel von dir erzählt.' },
  { key: 'tiger', name: 'Graf Tiger', emoji: '🐯', saying: 'Gestreift lache ich doppelt.' },
  { key: 'buffalo', name: 'Landvogt Büffel', emoji: '🐃', saying: 'Bei mir zählt nur der Ertrag.' },
  { key: 'rhino', name: 'Ritter Nashorn', emoji: '🦏', saying: 'Ich lache mit dem Kopf voran.' },
  { key: 'elephant', name: 'Herzog Elefant', emoji: '🐘', saying: 'Ich vergesse keinen schlechten Witz.' },
  { key: 'mammoth', name: 'Altkanzler Mammut', emoji: '🦣', saying: 'Zu meiner Zeit waren die Narren noch lustig.' },
  { key: 'trex', name: 'Kurfürst T-Rex', emoji: '🦖', saying: 'Ich klatsche gern. Wenn ich nur rankäme.' },
  { key: 'centaur', name: 'Sternkundiger Orion', emoji: '🐎', saying: 'Die Sterne sagen: Heute wird gelacht.' },
  { key: 'dwarf', name: 'Schmied Grummbart', emoji: '⚒️', saying: 'Ein Zwerg lacht selten. Gib dir Mühe.' },
  { key: 'giant', name: 'Riese Rumpel', emoji: '🧌', saying: 'Wenn ich lache, wackelt der Saal. Halt dich fest!' },
];

/** Alle Höflinge und Edlen (für Übersichten und Bilder). */
export const COURTIERS: Courtier[] = [...COURTIERS_MORNING, ...COURTIERS_FEAST];

/** Bisherige Liste (Name und Emoji) – bleibt für ältere Aufrufe. */
export const CREATURES: { name: string; emoji: string }[] = COURTIERS.map(({ name, emoji }) => ({ name, emoji }));

function hashKey(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Gegner der Morgenaudienz bzw. des Festmahls: Jede Partie zieht aus ihrer Kennung acht Höflinge
 * und acht Edle (für alle Plätze gleich); spätere Hoftage bekommen die Größeren der Auswahl.
 */
export function courtierFor(partyKey: string, level: number, round: number): Courtier {
  const pool = round === 0 ? COURTIERS_MORNING : COURTIERS_FEAST;
  const order = pool.map((c, i) => ({ i, h: hashKey(`${partyKey}/${round}/${c.key}`) }));
  const chosen = order
    .sort((a, b) => a.h - b.h)
    .slice(0, 8)
    .map((o) => o.i)
    .sort((a, b) => a - b);
  return pool[chosen[(Math.max(1, level) - 1) % chosen.length]!]!;
}

/** Gesicht des Gegners einer Runde ohne Partie-Kennung – fest je Level und Runde. */
export function creatureFor(level: number, round: number): Courtier {
  return courtierFor('', level, round);
}
