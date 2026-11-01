/** Das Brett von Marktplatz: 36 Felder, sechs Zünfte, vier Gemeinschaftsbetriebe. Zahlen aus der Bot-Probe (docs/spiele/marktplatz-probe.md). */

export interface Guild {
  name: string;
  color: string;
  ink: string;
  fields: [number, number, number];
  prices: [number, number, number];
  /** Ware ohne Bau, mit Werkstatt, mit Zunfthaus. */
  ware: [number, number, number];
  build: number;
}

export const GUILDS: Guild[] = [
  { name: 'Bäcker', color: '#d9a441', ink: '#2b1d05', fields: [1, 3, 5], prices: [4, 4, 5], ware: [1, 2, 3], build: 2 },
  { name: 'Weber', color: '#4f7fc4', ink: '#ffffff', fields: [7, 8, 10], prices: [6, 6, 7], ware: [1, 3, 5], build: 3 },
  { name: 'Imker', color: '#f2cc3d', ink: '#2b1d05', fields: [12, 13, 15], prices: [8, 8, 9], ware: [2, 4, 6], build: 4 },
  { name: 'Schuster', color: '#8a5a33', ink: '#ffffff', fields: [17, 19, 21], prices: [10, 10, 11], ware: [2, 5, 8], build: 5 },
  { name: 'Schmiede', color: '#7d8691', ink: '#ffffff', fields: [23, 25, 26], prices: [12, 12, 13], ware: [3, 6, 9], build: 6 },
  { name: 'Steinmetze', color: '#c0483c', ink: '#ffffff', fields: [28, 30, 34], prices: [14, 14, 16], ware: [3, 7, 11], build: 7 },
];

export const COMMUNITY_FIELDS = [6, 14, 22, 31];
export const COMMUNITY_PRICE = 10;
export const COMMUNITY_RENT = 2;
export const CRIER_FIELDS = [2, 16, 24, 32];
export const JAIL = 9;
export const BAIL = 5;
export const GO_MONEY = 5;
export const WHOLE_BONUS = 10;
export const PARTNER_BONUS = 5;
export const FIELD_COUNT = 36;

export const FIELD_NAMES: string[] = [
  'Stadttor', 'Brezelstube', 'Ausrufer', 'Backhaus', 'Zehnt', 'Lebkuchenbäckerei', 'Mühle am Bach', 'Spinnstube', 'Färberei',
  'Kerker', 'Tuchhalle', 'Kloster', 'Bienenhaus', 'Kerzenzieherei', 'Brücke', 'Honigladen', 'Ausrufer', 'Gerberei',
  'Jahrmarkt', 'Schusterei', 'Thronsaal', 'Sattlerei', 'Marktwaage', 'Hufschmiede', 'Ausrufer', 'Glockengießerei', 'Goldschmiede',
  'Burgwache', 'Steinbruch', 'Waldweg', 'Steinmetzhütte', 'Taverne', 'Ausrufer', 'Königszoll', 'Dombauhütte', 'Dorfbrunnen',
];

export const FIELD_ICONS: string[] = [
  '🏰', '🥨', '📣', '🍞', '⛪', '🍪', '⚙️', '🧵', '🎨',
  '🔒', '🧶', '🌿', '🐝', '🕯️', '🌉', '🍯', '📣', '🟤',
  '🎪', '👞', '👑', '🐎', '⚖️', '🧲', '📣', '🔔', '💍',
  '💂', '🪨', '🌲', '🔨', '🍺', '📣', '💰', '⛰️', '⛲',
];
FIELD_ICONS[31] = '🥛'; // Taverne: Kakao und Apfelschorle
FIELD_ICONS[34] = '🛕';

/** Wozu gehört das Feld? Zunftnummer, oder -1 bei einem Gemeinschaftsbetrieb, oder null, wenn es kein Betrieb ist. */
export function guildOf(field: number): number | null {
  if (COMMUNITY_FIELDS.includes(field)) return -1;
  const g = GUILDS.findIndex((guild) => guild.fields.includes(field as never));
  return g >= 0 ? g : null;
}

export function priceOf(field: number): number {
  const g = guildOf(field);
  if (g === null) return 0;
  if (g === -1) return COMMUNITY_PRICE;
  const guild = GUILDS[g]!;
  return guild.prices[guild.fields.indexOf(field as never)]!;
}

export const NEWS = ['goodHarvest', 'badHarvest', 'wool', 'bees', 'shoes', 'tourney', 'cathedral', 'pilgrims', 'flood', 'kingVisit', 'frost', 'peace', 'calm'] as const;
export type NewsId = (typeof NEWS)[number];

export const NEWS_TEXT: Record<NewsId, { title: string; text: string }> = {
  goodHarvest: { title: 'Gute Ernte', text: 'Bäcker: doppelte Ware' },
  badHarvest: { title: 'Missernte', text: 'Bäcker: halbe Ware' },
  wool: { title: 'Wollmarkt', text: 'Weber: doppelte Ware' },
  bees: { title: 'Bienenschwarm', text: 'Imker: doppelte Ware' },
  shoes: { title: 'Schuhmode am Hof', text: 'Schuster: doppelte Ware' },
  tourney: { title: 'Ritterturnier', text: 'Schmiede: doppelte Ware' },
  cathedral: { title: 'Dombaufest', text: 'Steinmetze: doppelte Ware' },
  pilgrims: { title: 'Pilgerzug', text: 'Der Kräutergarten gibt 4 statt 2 Brezeln' },
  flood: { title: 'Hochwasser', text: 'Mühle und Brücke ruhen, keine Ware' },
  kingVisit: { title: 'Königsbesuch', text: 'Doppeltes Marktgeld am Stadttor' },
  frost: { title: 'Winterfrost', text: 'Bauen kostet 1 Brezel mehr je Stufe' },
  peace: { title: 'Handelsfrieden', text: 'Jeder darf einmal handeln' },
  calm: { title: 'Ruhe im Land', text: 'Keine Besonderheit' },
};

export const NEWS_DOUBLE: Partial<Record<NewsId, number>> = { goodHarvest: 0, wool: 1, bees: 2, shoes: 3, tourney: 4, cathedral: 5 };

export const CARDS = ['errand', 'pardon', 'toJail', 'blessing', 'birthday', 'festival', 'repairs', 'praise', 'toGate', 'pilgrimage', 'purse', 'crooked'] as const;
export type CardId = (typeof CARDS)[number];

export const CARD_TEXT: Record<CardId, { title: string; text: string }> = {
  errand: { title: 'Botengang', text: '+2 Brezeln oder 1 bis 3 Felder weiterziehen' },
  pardon: { title: 'Freibrief', text: 'Behalten; damit verlässt du den Kerker sofort' },
  toJail: { title: 'Ab in den Kerker', text: 'Direkt in den Kerker, ohne Marktgeld' },
  blessing: { title: 'Segen des Klosters', text: 'Die nächste Ware, die du zahlst, ist halbiert' },
  birthday: { title: 'Geburtstag im Dorf', text: 'Jeder schenkt dir 1 Brezel' },
  festival: { title: 'Brunnenfest', text: 'Du gibst jedem 1 Brezel' },
  repairs: { title: 'Ausbesserung', text: 'Je Werkstatt 1, je Zunfthaus 2 Brezeln' },
  praise: { title: 'Lob vom König', text: '+4 Brezeln' },
  toGate: { title: 'Zurück zum Stadttor', text: 'Zum Stadttor ziehen, Marktgeld bekommen' },
  pilgrimage: { title: 'Pilgerweg', text: 'Zum Kloster ziehen' },
  purse: { title: 'Gefundener Beutel', text: '+3 Brezeln' },
  crooked: { title: 'Krumme Waage', text: '3 Brezeln Strafe an die Stadt' },
};

export const SEASONS = ['Frühling', 'Sommer', 'Herbst', 'Winter'];
export const FAMILIES = ['Dachs', 'Fuchs', 'Igel', 'Gans', 'Biber', 'Eule'];
export const FAMILY_ICONS = ['🦡', '🦊', '🦔', '🪿', '🦫', '🦉'];
export const FAMILY_COLORS = ['#374151', '#ea580c', '#7c5a3c', '#e5e7eb', '#92400e', '#7c3aed'];
