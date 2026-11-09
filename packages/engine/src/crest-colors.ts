/*
 * Farbkombinationen für Spielerwappen (#201). Nur Farben mit Namen – keine Wappenbilder, Logos oder Flaggen. Die
 * Kombinationen sind kein offizielles Zeichen der Städte, Länder oder Vereine. Quellen und Stand der Prüfung:
 * `docs/spiele/wappenfarben-recherche.md`. Neue Einträge nur mit Quelle; Kennungen nie ändern (stehen in gespeicherten
 * Wappen). Die Bundesliga-Liste ist die Saison 2026/27 und wird beim Auf- und Abstieg gepflegt (alte Kennungen bleiben gültig).
 */

export const CREST_GROUPS = ['klassisch', 'staedte', 'laender', 'fussball', 'sport'] as const;
export type CrestGroup = (typeof CREST_GROUPS)[number];

export const CREST_GROUP_LABELS: Readonly<Record<CrestGroup, string>> = {
  klassisch: 'Klassisch',
  staedte: 'Städte und Orte',
  laender: 'Länder',
  fussball: '1. Bundesliga',
  sport: 'Sport aus Reutlingen',
};

/** Farbnamen → Hex; alle auf hellem und dunklem Grund unterscheidbar gehalten. */
const HEX = {
  rot: '#B3261E',
  karmin: '#9E1B32',
  orange: '#D9622B',
  gelb: '#E0A800',
  gruen: '#2E7D32',
  blau: '#1F4E99',
  hellblau: '#5BA4D9',
  weiss: '#F4F1E8',
  schwarz: '#22252B',
  silber: '#C9D1D9',
  purpur: '#6A3FA0',
} as const;
type Tone = keyof typeof HEX;

const TONE_NAMES: Readonly<Record<Tone, string>> = {
  rot: 'Rot', karmin: 'Karminrot', orange: 'Orange', gelb: 'Gelb', gruen: 'Grün', blau: 'Blau', hellblau: 'Hellblau',
  weiss: 'Weiß', schwarz: 'Schwarz', silber: 'Silber', purpur: 'Purpur',
};

export interface CrestColorSet {
  id: string;
  /** Anzeigename, z. B. „Reutlingen“ oder „Deutschland“. */
  name: string;
  group: CrestGroup;
  /** 2 bis 4 Farben (Hex), in der Reihenfolge der Flagge bzw. des Vereins. */
  colors: readonly string[];
  /** Farbnamen zum Vorlesen, z. B. „Schwarz, Rot, Weiß“. */
  colorNames: string;
}

type Row = readonly [id: string, name: string, tones: readonly Tone[]];

function make(group: CrestGroup, rows: readonly Row[]): CrestColorSet[] {
  return rows.map(([id, name, tones]) => ({
    id,
    name,
    group,
    colors: tones.map((tone) => HEX[tone]),
    colorNames: tones.map((tone) => TONE_NAMES[tone]).join(', '),
  }));
}

/** Die sechs ersten Kombinationen (Kennungen unverändert, Freischaltung in `player-crest.ts`). */
const CLASSIC = [
  { id: 'rot-gold', name: 'Rot und Gold', group: 'klassisch', colors: ['#B3261E', '#E0A800'], colorNames: 'Rot, Gold' },
  { id: 'blau-silber', name: 'Blau und Silber', group: 'klassisch', colors: ['#1F4E99', '#C9D1D9'], colorNames: 'Blau, Silber' },
  { id: 'gruen-gold', name: 'Grün und Gold', group: 'klassisch', colors: ['#2E7D32', '#E0A800'], colorNames: 'Grün, Gold' },
  { id: 'schwarz-gold', name: 'Schwarz und Gold', group: 'klassisch', colors: ['#22252B', '#E0A800'], colorNames: 'Schwarz, Gold' },
  { id: 'purpur-silber', name: 'Purpur und Silber', group: 'klassisch', colors: ['#6A3FA0', '#C9D1D9'], colorNames: 'Purpur, Silber' },
  { id: 'orange-blau', name: 'Orange und Blau', group: 'klassisch', colors: ['#D9622B', '#1F4E99'], colorNames: 'Orange, Blau' },
] as const satisfies readonly CrestColorSet[];

/** Quelle: Stadtflaggen laut deutscher Wikipedia bzw. FOTW (Tübingen, Friedrichshafen), Stand 9.11.2026. */
const CITIES = make('staedte', [
  ['stadt-reutlingen', 'Reutlingen', ['schwarz', 'rot', 'weiss']],
  ['stadt-tuebingen', 'Tübingen', ['rot', 'gelb']],
  ['stadt-friedrichshafen', 'Friedrichshafen', ['gruen', 'weiss']],
  ['stadt-metzingen', 'Metzingen', ['blau', 'weiss']],
  ['stadt-pfullingen', 'Pfullingen', ['blau', 'weiss', 'rot']],
]);

/** Quelle: Flaggenartikel der deutschen Wikipedia, Stand 9.11.2026 (Zypern fehlt bis zur Bestätigung). */
const COUNTRIES = make('laender', [
  ['land-be', 'Belgien', ['schwarz', 'gelb', 'rot']],
  ['land-bg', 'Bulgarien', ['weiss', 'gruen', 'rot']],
  ['land-dk', 'Dänemark', ['rot', 'weiss']],
  ['land-de', 'Deutschland', ['schwarz', 'rot', 'gelb']],
  ['land-ee', 'Estland', ['blau', 'schwarz', 'weiss']],
  ['land-fi', 'Finnland', ['weiss', 'blau']],
  ['land-fr', 'Frankreich', ['blau', 'weiss', 'rot']],
  ['land-gr', 'Griechenland', ['blau', 'weiss']],
  ['land-ie', 'Irland', ['gruen', 'weiss', 'orange']],
  ['land-it', 'Italien', ['gruen', 'weiss', 'rot']],
  ['land-hr', 'Kroatien', ['rot', 'weiss', 'blau']],
  ['land-lv', 'Lettland', ['karmin', 'weiss']],
  ['land-lt', 'Litauen', ['gelb', 'gruen', 'rot']],
  ['land-lu', 'Luxemburg', ['rot', 'weiss', 'hellblau']],
  ['land-mt', 'Malta', ['weiss', 'rot']],
  ['land-nl', 'Niederlande', ['rot', 'weiss', 'blau']],
  ['land-at', 'Österreich', ['rot', 'weiss']],
  ['land-pl', 'Polen', ['weiss', 'rot']],
  ['land-pt', 'Portugal', ['gruen', 'rot']],
  ['land-ro', 'Rumänien', ['blau', 'gelb', 'rot']],
  ['land-se', 'Schweden', ['blau', 'gelb']],
  ['land-sk', 'Slowakei', ['weiss', 'blau', 'rot']],
  ['land-si', 'Slowenien', ['weiss', 'blau', 'rot']],
  ['land-es', 'Spanien', ['rot', 'gelb']],
  ['land-cz', 'Tschechien', ['weiss', 'rot', 'blau']],
  ['land-hu', 'Ungarn', ['rot', 'weiss', 'gruen']],
  ['land-ua', 'Ukraine', ['blau', 'gelb']],
]);

/** Quelle: Infobox „Vereinsfarben“ der deutschen Wikipedia, Stand 9.11.2026, Saison 2026/27. */
const BUNDESLIGA = make('fussball', [
  ['bl-bayern', 'FC Bayern München', ['rot', 'weiss']],
  ['bl-dortmund', 'Borussia Dortmund', ['schwarz', 'gelb']],
  ['bl-leipzig', 'RB Leipzig', ['rot', 'weiss']],
  ['bl-frankfurt', 'Eintracht Frankfurt', ['rot', 'schwarz', 'weiss']],
  ['bl-augsburg', 'FC Augsburg', ['rot', 'gruen', 'weiss']],
  ['bl-union', '1. FC Union Berlin', ['rot', 'weiss']],
  ['bl-freiburg', 'SC Freiburg', ['weiss', 'rot']],
  ['bl-gladbach', 'Borussia Mönchengladbach', ['schwarz', 'weiss', 'gruen']],
  ['bl-leverkusen', 'Bayer 04 Leverkusen', ['rot', 'schwarz']],
  ['bl-stuttgart', 'VfB Stuttgart', ['weiss', 'rot']],
  ['bl-hoffenheim', 'TSG Hoffenheim', ['blau', 'weiss']],
  ['bl-mainz', '1. FSV Mainz 05', ['rot', 'weiss']],
  ['bl-bremen', 'SV Werder Bremen', ['gruen', 'weiss']],
  ['bl-koeln', '1. FC Köln', ['rot', 'weiss']],
  ['bl-hamburg', 'Hamburger SV', ['blau', 'weiss', 'schwarz']],
  ['bl-schalke', 'FC Schalke 04', ['blau', 'weiss']],
  ['bl-elversberg', 'SV Elversberg', ['schwarz', 'weiss']],
  ['bl-paderborn', 'SC Paderborn 07', ['blau', 'schwarz']],
]);

/** Quelle: Infobox der deutschen Wikipedia, Stand 9.11.2026. Weitere Teams folgen, sobald ihre Farben belegt sind. */
const SPORT = make('sport', [
  ['sport-ssv-reutlingen', 'SSV Reutlingen 05', ['schwarz', 'rot', 'weiss']],
  ['sport-young-boys-reutlingen', 'Young Boys Reutlingen', ['blau', 'silber']],
  // Reutlingen Eagles (American Football): Farben laut Cornelius, 9.11.2026.
  ['sport-reutlingen-eagles', 'Reutlingen Eagles', ['purpur', 'weiss']],
]);

export const CREST_COLOR_SETS: readonly CrestColorSet[] = [...CLASSIC, ...CITIES, ...COUNTRIES, ...BUNDESLIGA, ...SPORT];
