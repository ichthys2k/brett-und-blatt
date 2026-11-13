/**
 * Was die XR-App über Spiele weiß: nur Namen und welche als 3D-Brett erscheinen. Keine Regeln –
 * alle anderen Spiele laufen über das 2D-Fenster mit der Zugliste des Servers.
 */

export const BOARD_GAMES = ['tic-tac-toe', 'four-in-a-row', 'chess', 'checkers', 'mill', 'reversi', 'gomoku', 'go'] as const;
export type BoardGameId = (typeof BOARD_GAMES)[number];

export function isBoardGame(id: string | null | undefined): id is BoardGameId {
  return (BOARD_GAMES as readonly string[]).includes(id ?? '');
}

/** Auswahl in der Lobby: zuerst die 3D-Spiele, dann Spiele mit Zugtexten (#335). */
export const GAME_CHOICES: { id: string; name: string; board: boolean }[] = [
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', board: true },
  { id: 'four-in-a-row', name: 'Vier in einer Reihe', board: true },
  { id: 'chess', name: 'Schach', board: true },
  { id: 'checkers', name: 'Dame', board: true },
  { id: 'mill', name: 'Mühle', board: true },
  { id: 'reversi', name: 'Reversi', board: true },
  { id: 'gomoku', name: 'Gomoku', board: true },
  { id: 'go', name: 'Go', board: true },
  { id: 'four-player-chess', name: 'Vierer-Schach', board: false },
  { id: 'mau-mau', name: 'Mau-Mau', board: false },
  { id: 'uno', name: 'Eins!', board: false },
];

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
