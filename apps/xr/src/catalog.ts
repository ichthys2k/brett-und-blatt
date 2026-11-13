/**
 * Was die XR-App über Spiele weiß: nur Namen und welche in 3D erscheinen. Keine Regeln –
 * Spiele ohne eigenen Übersetzer laufen über das 2D-Fenster mit der Zugliste des Servers.
 */
import { CARD_GAMES } from './scene/card-views';

export const BOARD_GAMES = ['tic-tac-toe', 'four-in-a-row', 'chess', 'checkers', 'mill', 'reversi', 'gomoku', 'go'] as const;
export type BoardGameId = (typeof BOARD_GAMES)[number];

export function isBoardGame(id: string | null | undefined): id is BoardGameId {
  return (BOARD_GAMES as readonly string[]).includes(id ?? '');
}

/** Alle Online-Spiele (`apps/server/src/games.ts`, geprüft von `tests/xr-katalog.test.ts`), nach Namen sortiert. */
const ALL_GAMES: [id: string, name: string][] = [
  ['bible-quiz', 'Bibel-Quiz'],
  ['bingo', 'Bingo'],
  ['binokel', 'Binokel'],
  ['checkers', 'Dame'],
  ['dominoes', 'Domino'],
  ['doppelkopf', 'Doppelkopf'],
  ['drachenspiel', 'Drachenspiel'],
  ['uno', 'Eins!'],
  ['elevens', 'Elf zuerst!'],
  ['duck-rally', 'Enten-Rallye'],
  ['color-and-shape', 'Farbe & Form'],
  ['symbol-match', 'Fix gefunden!'],
  ['hangman', 'Galgenmännchen'],
  ['go', 'Go'],
  ['gomoku', 'Gomoku'],
  ['grafschaft', 'Grafschaft'],
  ['ligretto', 'Kartenblitz'],
  ['category-sprint', 'Kategorien-Sprint'],
  ['marketplace', 'Marktplatz'],
  ['market-stalls', 'Marktstände'],
  ['mau-mau', 'Mau-Mau'],
  ['maexle', 'Mäxle'],
  ['majority', 'Mehrheitsfrage'],
  ['mill', 'Mühle'],
  ['color-sorter', 'Narrenhof'],
  ['ludo', 'Nicht ärgern!'],
  ['pairs', 'Paare finden'],
  ['poker', 'Poker'],
  ['president', 'Präsident'],
  ['quartett', 'Quartett'],
  ['number-wall', 'Rechenmauer'],
  ['reversi', 'Reversi'],
  ['turnip-patch', 'Rübenacker'],
  ['chess', 'Schach'],
  ['schafkopf', 'Schafkopf'],
  ['estimate', 'Schätzmeister'],
  ['battleship', 'Schiffe versenken'],
  ['black-peter', 'Schwarzer Peter'],
  ['skat', 'Skat'],
  ['speed', 'Speed'],
  ['chinese-checkers', 'Sternhalma'],
  ['factor-grid', 'Teiler-Duell'],
  ['tic-tac-toe', 'Tic-Tac-Toe'],
  ['low-flight', 'Tiefflug'],
  ['ultimate-tic-tac-toe', 'Ultimate Tic-Tac-Toe'],
  ['describe-duel', 'Verboten!'],
  ['four-in-a-row', 'Vier in einer Reihe'],
  ['four-player-chess', 'Vierer-Schach'],
  ['who-am-i', 'Wer bin ich?'],
  ['wolves-sheep', 'Wölfe im Schafspelz'],
  ['word-salad', 'Wort-Salat'],
  ['scrabble', 'Wortgitter'],
  ['kniffel', 'Würfelblock'],
  ['timeline', 'Zeitstrahl'],
  ['target-number', 'Zielzahl'],
];

const IN_3D = new Set<string>([...BOARD_GAMES, ...CARD_GAMES]);

/** Auswahl in der Lobby (#358): zuerst die Spiele mit 3D-Tisch, dann die übrigen über das 2D-Fenster. */
export const GAME_CHOICES: { id: string; name: string; board: boolean }[] = [
  ...ALL_GAMES.filter(([id]) => IN_3D.has(id)),
  ...ALL_GAMES.filter(([id]) => !IN_3D.has(id)),
].map(([id, name]) => ({ id, name, board: IN_3D.has(id) }));

export function gameName(id: string | null | undefined): string {
  return GAME_CHOICES.find((g) => g.id === id)?.name ?? id ?? '–';
}

export const PHRASE_TEXT: Record<string, string> = {
  hello: 'Hallo!',
  goodGame: 'Gutes Spiel!',
  wellPlayed: 'Gut gespielt!',
  oops: 'Hoppla!',
  thanks: 'Danke!',
  oneMoment: 'Moment bitte …',
  again: 'Nochmal?',
  wow: 'Wow!',
  grr: 'Grr!',
};

export const LEVEL_TEXT: Record<string, string> = { easy: 'leicht', medium: 'mittel', hard: 'schwer' };
