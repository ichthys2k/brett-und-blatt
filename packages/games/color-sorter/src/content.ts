import type { Color, Enhancement, Foil, HandType, PackKind, PackSize, Seal, Sticker } from './types';

// ---------------------------------------------------------------- Zauberkarten

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
    name: 'Der Narr',
    emoji: '🃏',
    text: 'Erzeugt die zuletzt benutzte Zauber- oder Nagelstudio-Karte (außer dem Narren)',
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
    text: 'Erzeugt bis zu 2 zufällige Nagelstudio-Karten',
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
    text: 'Erzeugt bis zu 2 zufällige Zauberkarten',
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
    text: 'Verdoppelt deine Token (höchstens +20 T)',
    targets: [0, 0],
  },
  {
    key: 'wheel',
    name: 'Das Rad',
    emoji: '🎡',
    text: 'Zu 1/4 bekommt ein zufälliger Mod eine Folie',
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
    text: 'Gibt den Verkaufswert aller Mods als Token (höchstens 50 T)',
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
    text: 'Bis zu 3 Karten werden gelb',
    targets: [1, 3],
    color: 'y',
  },
  {
    key: 'moon',
    name: 'Der Mond',
    emoji: '🌙',
    text: 'Bis zu 3 Karten werden blau',
    targets: [1, 3],
    color: 'b',
  },
  {
    key: 'sun',
    name: 'Die Sonne',
    emoji: '☀️',
    text: 'Bis zu 3 Karten werden rot',
    targets: [1, 3],
    color: 'r',
  },
  {
    key: 'judgement',
    name: 'Das Gericht',
    emoji: '📯',
    text: 'Erzeugt einen zufälligen Mod (wenn Platz ist)',
    targets: [0, 0],
  },
  {
    key: 'world',
    name: 'Die Welt',
    emoji: '🌍',
    text: 'Bis zu 3 Karten werden grün',
    targets: [1, 3],
    color: 'g',
  },
];
export const SPELLS: Record<string, SpellDef> = Object.fromEntries(spells.map((s) => [s.key, s]));
export const SPELL_KEYS = spells.map((s) => s.key);

// ---------------------------------------------------------------- Nagelstudio

export interface NailDef {
  key: string;
  name: string;
  emoji: string;
  hand: HandType;
}

const nails: NailDef[] = [
  { key: 'oil', name: 'Nagelöl', emoji: '🧴', hand: 'high' },
  { key: 'clearCoat', name: 'Klarlack', emoji: '💅', hand: 'pair' },
  { key: 'french', name: 'French Nails', emoji: '🤍', hand: 'twoPair' },
  { key: 'babyboomer', name: 'Babyboomer', emoji: '👶', hand: 'three' },
  { key: 'stiletto', name: 'Stiletto-Form', emoji: '👠', hand: 'straight' },
  { key: 'fullcover', name: 'Fullcover', emoji: '🎨', hand: 'flush' },
  { key: 'acrylic', name: 'Acryl-Modellage', emoji: '🏗️', hand: 'fullHouse' },
  { key: 'nailArt', name: 'Nail Art', emoji: '🖼️', hand: 'four' },
  {
    key: 'fiberglass',
    name: 'Fiberglas-Technik',
    emoji: '🧵',
    hand: 'straightFlush',
  },
  { key: 'glitter', name: 'Glitzer', emoji: '🌟', hand: 'five' },
  { key: 'rhinestone', name: 'Strass', emoji: '💎', hand: 'flushHouse' },
  { key: 'chrome', name: 'Chrom-Effekt', emoji: '🪩', hand: 'flushFive' },
];
export const NAILS: Record<string, NailDef> = Object.fromEntries(nails.map((n) => [n.key, n]));
export const NAIL_KEYS = nails.map((n) => n.key);
export const NAIL_FOR_HAND = Object.fromEntries(nails.map((n) => [n.hand, n.key])) as Record<HandType, string>;

// ---------------------------------------------------------------- Traumkarten

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
    text: 'Entfernt 1 zufällige Handkarte, dafür 2 veredelte Santas ins Deck',
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
    text: '1 Karte bekommt ein Gold-Abzeichen',
    targets: [1, 1],
    seal: 'gold',
  },
  {
    key: 'dejaVu',
    name: 'Déjà-vu',
    emoji: '🔁',
    text: '1 Karte bekommt ein rotes Abzeichen',
    targets: [1, 1],
    seal: 'red',
  },
  {
    key: 'trance',
    name: 'Trance',
    emoji: '🌀',
    text: '1 Karte bekommt ein blaues Abzeichen',
    targets: [1, 1],
    seal: 'blue',
  },
  {
    key: 'medium',
    name: 'Medium',
    emoji: '🟣',
    text: '1 Karte bekommt ein lila Abzeichen',
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
    text: 'Erzeugt einen seltenen Mod, deine Token gehen auf 0',
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
    text: 'Ein zufälliger Mod wird durchsichtig (+1 Mod-Platz), Handgröße −1',
    targets: [0, 0],
  },
  {
    key: 'cleanup',
    name: 'Großputz',
    emoji: '🧽',
    text: 'Entfernt 5 zufällige Handkarten, dafür +20 T',
    targets: [0, 0],
  },
  {
    key: 'mirror',
    name: 'Spiegel',
    emoji: '🪞',
    text: 'Kopiert einen zufälligen Mod, alle anderen (nicht angeklebten) verschwinden',
    targets: [0, 0],
  },
  {
    key: 'spell',
    name: 'Bannkreis',
    emoji: '🪬',
    text: 'Ein zufälliger Mod wird irisierend, alle anderen (nicht angeklebten) verschwinden',
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
    text: 'Erzeugt einen legendären Mod (wenn Platz ist)',
    targets: [0, 0],
  },
  {
    key: 'blackHole',
    name: 'Schwarzes Loch',
    emoji: '🕳️',
    text: 'Alle Kombis steigen um 1 Level',
    targets: [0, 0],
  },
];
export const DREAMS: Record<string, DreamDef> = Object.fromEntries(dreams.map((d) => [d.key, d]));
/** „Seele“ und „Schwarzes Loch“ sind selten und gibt es nur in Lieferungen. */
export const DREAM_KEYS = dreams.map((d) => d.key).filter((k) => k !== 'soul' && k !== 'blackHole');
export const RARE_DREAMS = ['soul', 'blackHole'];

// ---------------------------------------------------------------- Veredelungen, Folien, Abzeichen

export const ENHANCEMENTS: Record<Enhancement, { name: string; emoji: string; text: string }> = {
  granite: {
    name: 'Granit-Look',
    emoji: '🧱',
    text: '50 Chips, kein Rang und keine Farbe, wird immer gewertet',
  },
  volume: { name: 'Volumen-Boost', emoji: '💇‍♀️', text: '+30 Chips' },
  gloss: { name: 'Glossing', emoji: '✨', text: '+4 Mult' },
  ombre: { name: 'Ombré', emoji: '🌈', text: 'Zählt als jede Farbe' },
  gold: {
    name: 'Gold-Strähnen',
    emoji: '💛',
    text: '+3 T, wenn sie am Rundenende in der Hand ist',
  },
  blond: {
    name: 'Blondierung',
    emoji: '👱',
    text: '×2 Mult, löst sich zu 1/4 auf',
  },
  keratin: {
    name: 'Keratin-Kur',
    emoji: '🛡️',
    text: '×1,5 Mult, solange sie in der Hand bleibt',
  },
  star: {
    name: 'Sternen-Welle',
    emoji: '🌠',
    text: 'Zu 1/5: +20 Mult. Zu 1/15: +20 T',
  },
};

export const FOILS: Record<Foil, { name: string; emoji: string; text: string; price: number }> = {
  hot: { name: 'Heißfolie', emoji: '🔥', text: '+50 Chips', price: 2 },
  holo: { name: 'Holo-Laminat', emoji: '💿', text: '+10 Mult', price: 3 },
  iris: { name: 'Irisierender Lack', emoji: '🫧', text: '×1,5 Mult', price: 5 },
  clear: { name: 'Durchsichtig', emoji: '👓', text: '+1 Mod-Platz', price: 5 },
};

export const SEALS: Record<Seal, { name: string; emoji: string; text: string }> = {
  gold: {
    name: 'Gold-Abzeichen',
    emoji: '🏅',
    text: '+3 T, wenn die Karte gewertet wird',
  },
  red: {
    name: 'Rotes Abzeichen',
    emoji: '🔁',
    text: 'Die Karte zählt doppelt',
  },
  blue: {
    name: 'Blaues Abzeichen',
    emoji: '🔷',
    text: 'Bleibt sie am Rundenende in der Hand: Nagelstudio-Karte der letzten Kombi',
  },
  purple: {
    name: 'Lila Abzeichen',
    emoji: '🟪',
    text: 'Beim Verwerfen: eine zufällige Zauberkarte',
  },
};

export const STICKERS: Record<Sticker, { name: string; emoji: string; text: string }> = {
  eternal: {
    name: 'Angeklebt',
    emoji: '📌',
    text: 'Lässt sich nicht verkaufen oder entfernen',
  },
  perishable: {
    name: 'Vergänglich',
    emoji: '⏳',
    text: 'Wirkt nach 5 Runden nicht mehr',
  },
  rental: {
    name: 'Geliehen',
    emoji: '🔑',
    text: 'Kostet 1 T, dafür 3 T je Runde',
  },
};

// ---------------------------------------------------------------- Lieferungen

export const PACK_KINDS: Record<PackKind, { name: string; emoji: string; text: string }> = {
  mods: { name: 'Mod-Kiste', emoji: '📦', text: 'Mods' },
  spells: {
    name: 'Zauber-Mappe',
    emoji: '📜',
    text: 'Zauberkarten – direkt auf deine Karten anwenden',
  },
  nails: { name: 'Nagellack-Set', emoji: '💅', text: 'Nagelstudio-Karten' },
  dreams: {
    name: 'Traum-Schachtel',
    emoji: '🌙',
    text: 'Traumkarten – direkt anwenden',
  },
  cards: { name: 'Karten-Paket', emoji: '🎴', text: 'Spielkarten fürs Deck' },
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

// ---------------------------------------------------------------- Werkzeuge

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
    name: 'Magnet',
    emoji: '🧲',
    text: '+1 Angebot in der Sortier-Zentrale',
  },
  {
    key: 'superMagnet',
    name: 'Supermagnet',
    emoji: '🧲',
    text: '+1 weiteres Angebot',
    requires: 'magnet',
  },
  {
    key: 'sale',
    name: 'Rabatt',
    emoji: '🏷️',
    text: 'Alles 25 % günstiger',
    requires: undefined,
  },
  {
    key: 'bigSale',
    name: 'Großer Rabatt',
    emoji: '🏷️',
    text: 'Alles 50 % günstiger',
    requires: 'sale',
  },
  {
    key: 'tidy',
    name: 'Ordnung',
    emoji: '🧹',
    text: 'Neu sortieren 2 T günstiger',
  },
  {
    key: 'tidy2',
    name: 'Große Ordnung',
    emoji: '🧹',
    text: 'Neu sortieren weitere 2 T günstiger',
    requires: 'tidy',
  },
  {
    key: 'extraHand',
    name: 'Zusatzhand',
    emoji: '✋',
    text: '+1 Hand je Runde',
  },
  {
    key: 'extraHand2',
    name: 'Doppelhand',
    emoji: '🙌',
    text: '+1 weitere Hand je Runde',
    requires: 'extraHand',
  },
  {
    key: 'bin',
    name: 'Papierkorb',
    emoji: '🗑️',
    text: '+1 Verwerfen je Runde',
  },
  {
    key: 'bin2',
    name: 'Recyclinghof',
    emoji: '🚛',
    text: '+1 weiteres Verwerfen je Runde',
    requires: 'bin',
  },
  { key: 'bag', name: 'Große Tasche', emoji: '👜', text: '+1 Handgröße' },
  {
    key: 'bag2',
    name: 'Reisekoffer',
    emoji: '🧳',
    text: '+1 weitere Handgröße',
    requires: 'bag',
  },
  {
    key: 'basket',
    name: 'Korb',
    emoji: '🧺',
    text: '+1 Platz für Verbrauchsgegenstände',
  },
  {
    key: 'book',
    name: 'Sparbuch',
    emoji: '📒',
    text: 'Ordnungsbonus bis 10 T',
    requires: undefined,
  },
  {
    key: 'book2',
    name: 'Goldenes Sparbuch',
    emoji: '📔',
    text: 'Ordnungsbonus bis 20 T',
    requires: 'book',
  },
  {
    key: 'shelf',
    name: 'Regal',
    emoji: '🗄️',
    text: '+1 Mod-Platz',
    requires: 'magnet',
  },
  {
    key: 'scope',
    name: 'Fernrohr',
    emoji: '🔭',
    text: `Boss einmal je Level neu wählen (${BOSS_REROLL_PRICE} T)`,
  },
  {
    key: 'scope2',
    name: 'Satellit',
    emoji: '🛰️',
    text: `Boss beliebig oft neu wählen (je ${BOSS_REROLL_PRICE} T)`,
    requires: 'scope',
  },
];
export const TOOLS: Record<string, ToolDef> = Object.fromEntries(tools.map((t) => [t.key, t]));
export const TOOL_KEYS = tools.map((t) => t.key);
export const TOOL_PRICE = 10;

// ---------------------------------------------------------------- Sticker (fürs Überspringen)

export interface TagDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
}

const tags: TagDef[] = [
  {
    key: 'modBox',
    name: 'Mod-Kiste gratis',
    emoji: '📦',
    text: 'Öffnet sofort eine große Mod-Kiste',
  },
  {
    key: 'spellBox',
    name: 'Zauber-Mappe gratis',
    emoji: '📜',
    text: 'Öffnet sofort eine riesige Zauber-Mappe',
  },
  {
    key: 'nailBox',
    name: 'Nagellack-Set gratis',
    emoji: '💅',
    text: 'Öffnet sofort ein riesiges Nagellack-Set',
  },
  {
    key: 'coupon',
    name: 'Gutschein',
    emoji: '✂️',
    text: 'Angebote und Lieferungen im nächsten Laden kosten nichts',
  },
  {
    key: 'rare',
    name: 'Seltener Fund',
    emoji: '💎',
    text: 'Im nächsten Laden liegt ein seltener Mod gratis',
  },
  {
    key: 'foil',
    name: 'Folienfund',
    emoji: '💿',
    text: 'Der erste Mod im nächsten Laden hat Holo-Laminat und ist gratis',
  },
  {
    key: 'stock',
    name: 'Vorrat',
    emoji: '📦',
    text: '+25 T nach dem nächsten Boss',
  },
  {
    key: 'double',
    name: 'Werkstattbonus',
    emoji: '🔩',
    text: 'Verdoppelt deine Token (höchstens +40 T)',
  },
];
export const TAGS: Record<string, TagDef> = Object.fromEntries(tags.map((t) => [t.key, t]));
export const TAG_KEYS = tags.map((t) => t.key);

// ---------------------------------------------------------------- Kartensätze und Sortierstufen

export interface DeckDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
}

export const DECKS: DeckDef[] = [
  {
    key: 'standard',
    name: 'Standard-Satz',
    emoji: '🗃️',
    text: 'Ohne Besonderheiten',
  },
  { key: 'red', name: 'Rot-Satz', emoji: '🟥', text: '+1 Verwerfen je Runde' },
  { key: 'blue', name: 'Blau-Satz', emoji: '🟦', text: '+1 Hand je Runde' },
  { key: 'yellow', name: 'Gelb-Satz', emoji: '🟨', text: '+10 T zu Beginn' },
  {
    key: 'green',
    name: 'Grün-Satz',
    emoji: '🟩',
    text: 'Kein Ordnungsbonus, dafür +2 T je übrige Hand und +1 T je übriges Verwerfen',
  },
  {
    key: 'black',
    name: 'Schwarz-Satz',
    emoji: '⬛',
    text: '+1 Mod-Platz, −1 Hand je Runde',
  },
  {
    key: 'magic',
    name: 'Zauber-Satz',
    emoji: '🪄',
    text: 'Startet mit dem Korb und zweimal „Der Narr“',
  },
];

export const STAKES: { name: string; emoji: string; text: string }[] = [
  { name: 'Weiß', emoji: '⚪', text: 'Normale Regeln' },
  { name: 'Rot', emoji: '🔴', text: 'Die Vorhut bringt keine Grundbelohnung' },
  { name: 'Grün', emoji: '🟢', text: 'Die Ziele wachsen schneller' },
  {
    name: 'Schwarz',
    emoji: '⚫',
    text: 'Mods können angeklebt sein (nicht verkaufbar)',
  },
  { name: 'Blau', emoji: '🔵', text: '−1 Verwerfen je Runde' },
  { name: 'Lila', emoji: '🟣', text: 'Die Ziele wachsen noch schneller' },
  {
    name: 'Orange',
    emoji: '🟠',
    text: 'Mods können vergänglich sein (nach 5 Runden wirkungslos)',
  },
  {
    name: 'Gold',
    emoji: '🟡',
    text: 'Mods können geliehen sein (1 T, aber 3 T je Runde)',
  },
];

const TARGETS = [
  [300, 800, 2000, 5000, 11000, 20000, 35000, 50000],
  [300, 900, 2600, 8000, 20000, 36000, 60000, 100000],
  [300, 1000, 3200, 9000, 25000, 60000, 110000, 200000],
];

/** Grundziel eines Levels (Vorhut); Wächter ×1,5, Boss ×2. */
export function levelTarget(level: number, stake: number): number {
  const table = TARGETS[stake >= 6 ? 2 : stake >= 3 ? 1 : 0]!;
  if (level <= table.length) return table[Math.max(0, level - 1)]!;
  // Endlos: jedes weitere Level etwa dreimal so viel.
  return Math.round(table[table.length - 1]! * 3 ** (level - table.length));
}

// ---------------------------------------------------------------- Bosse

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
    name: 'Rattenkönig',
    emoji: '🐀',
    text: '−1 T je gewertete Karte',
    minLevel: 2,
  },
  {
    key: 'spider',
    name: 'Mutterspinne',
    emoji: '🕷️',
    text: 'Es müssen genau 5 Karten gespielt werden',
    minLevel: 1,
  },
  {
    key: 'wolf',
    name: 'Alpha-Wolf',
    emoji: '🐺',
    text: 'Grüne Karten zählen nicht',
    minLevel: 1,
    debuffColor: 'g',
  },
  {
    key: 'boar',
    name: 'Wilder Keiler',
    emoji: '🐗',
    text: 'Wirft nach jeder Hand 2 zufällige Handkarten ab',
    minLevel: 1,
  },
  {
    key: 'bear',
    name: 'Papa Bär',
    emoji: '🐻',
    text: 'Doppelt so hohes Ziel',
    minLevel: 2,
    targetFactor: 2,
  },
  {
    key: 'croco',
    name: 'Kroko-Boss',
    emoji: '🐊',
    text: 'Kein Verwerfen',
    minLevel: 2,
  },
  {
    key: 'snake',
    name: 'Riesen-Schlange',
    emoji: '🐍',
    text: 'Jede Kombi-Art nur einmal',
    minLevel: 3,
  },
  {
    key: 'ape',
    name: 'Riesen-Affe',
    emoji: '🦍',
    text: 'Grund-Chips und -Mult der Kombi halbiert',
    minLevel: 2,
  },
  {
    key: 'cactus',
    name: 'Kaktus-König',
    emoji: '🌵',
    text: 'Nur eine Hand',
    minLevel: 2,
  },
  {
    key: 'ghost',
    name: 'Schloss-Gespenst',
    emoji: '🏰',
    text: 'Die erste Hand wird verdeckt gezogen',
    minLevel: 2,
  },
  {
    key: 'frog',
    name: 'Frosch-König',
    emoji: '🐸',
    text: 'Bildkarten werden verdeckt gezogen',
    minLevel: 2,
  },
  {
    key: 'shark',
    name: 'Hai-General',
    emoji: '🦈',
    text: 'Nach jeder Hand wird verdeckt nachgezogen',
    minLevel: 2,
  },
  {
    key: 'eagle',
    name: 'Riesen-Adler',
    emoji: '🦅',
    text: 'Gelbe Karten zählen nicht',
    minLevel: 1,
    debuffColor: 'y',
  },
  {
    key: 'guardian',
    name: 'Wald-Wächter',
    emoji: '🌳',
    text: 'Bildkarten zählen nicht',
    minLevel: 4,
  },
  {
    key: 'golem',
    name: 'Fels-Golem',
    emoji: '🗿',
    text: 'Karten, die in diesem Level schon gespielt wurden, zählen nicht',
    minLevel: 1,
  },
  {
    key: 'lizard',
    name: 'Feuer-Echse',
    emoji: '🦎',
    text: 'Die gespielte Kombi verliert 1 Level',
    minLevel: 2,
  },
  {
    key: 'yeti',
    name: 'Yeti',
    emoji: '❄️',
    text: 'Blaue Karten zählen nicht',
    minLevel: 1,
    debuffColor: 'b',
  },
  {
    key: 'storm',
    name: 'Sturmvogel',
    emoji: '🌩️',
    text: 'Jede 7. Karte wird verdeckt gezogen',
    minLevel: 2,
  },
  {
    key: 'minotaur',
    name: 'Minotaurus',
    emoji: '🐂',
    text: 'Rote Karten zählen nicht',
    minLevel: 1,
    debuffColor: 'r',
  },
  {
    key: 'lion',
    name: 'Goldener Löwe',
    emoji: '🦁',
    text: 'Nur eine Kombi-Art',
    minLevel: 2,
  },
  {
    key: 'owl',
    name: 'Uhu-Oma',
    emoji: '🦉',
    text: 'Handgröße −1',
    minLevel: 1,
  },
  {
    key: 'dragon',
    name: 'Der Drache',
    emoji: '🐲',
    text: 'Die Lieblings-Kombi (am häufigsten gespielt) bringt 0 Punkte',
    minLevel: 3,
  },
  {
    key: 'seaSerpent',
    name: 'See-Schlange',
    emoji: '🐉',
    text: 'Alle Karten zählen nicht, bis ein Mod verkauft wird',
    minLevel: 8,
    final: true,
  },
  {
    key: 'phoenix',
    name: 'Phönix',
    emoji: '☄️',
    text: 'Mischt die Reihenfolge der Mods vor jeder Hand',
    minLevel: 8,
    final: true,
  },
  {
    key: 'unicorn',
    name: 'Einhorn-Prinzessin',
    emoji: '🦄',
    text: 'Dreimal so hohes Ziel',
    minLevel: 8,
    final: true,
    targetFactor: 3,
  },
];
export const BOSSES: Record<string, BossDef> = Object.fromEntries(bosses.map((b) => [b.key, b]));
export const BOSS_LIST = bosses;

/** Tier-Gegner für Vorhut und Wächter (nur Gesicht und Name). */
export const CREATURES: { name: string; emoji: string }[] = [
  { name: 'Mikrobe', emoji: '🦠' },
  { name: 'Ameise', emoji: '🐜' },
  { name: 'Marienkäfer', emoji: '🐞' },
  { name: 'Schnecke', emoji: '🐌' },
  { name: 'Maus', emoji: '🐭' },
  { name: 'Igel', emoji: '🦔' },
  { name: 'Hase', emoji: '🐰' },
  { name: 'Fuchs', emoji: '🦊' },
  { name: 'Waschbär', emoji: '🦝' },
  { name: 'Eule', emoji: '🦉' },
  { name: 'Pinguin', emoji: '🐧' },
  { name: 'Krake', emoji: '🐙' },
  { name: 'Biber', emoji: '🦫' },
  { name: 'Panda', emoji: '🐼' },
  { name: 'Koala', emoji: '🐨' },
  { name: 'Tiger', emoji: '🐯' },
  { name: 'Nashorn', emoji: '🦏' },
  { name: 'Elefant', emoji: '🐘' },
  { name: 'Mammut', emoji: '🦣' },
  { name: 'T-Rex', emoji: '🦖' },
];

/** Gesicht des Gegners einer Runde – fest je Level und Runde. */
export function creatureFor(level: number, round: number): { name: string; emoji: string } {
  const index = Math.min(CREATURES.length - 1, Math.max(0, (level - 1) * 2 + round + Math.floor(level / 3)));
  return CREATURES[index]!;
}
