/*
 * Rubriken der Startseite als reine Daten (ohne Oberfläche), damit Freischaltregeln (`unlocks.ts`) sie synchron lesen können.
 * Die Startseite (`screens/Home.tsx`) reicht sie unverändert weiter.
 */

export type CategoryId = 'board' | 'cards' | 'family' | 'math';

export interface CategorySpec {
  id: CategoryId;
  icon: string;
  title: string;
  /** Raumname im Aussehen „Taverne“; die sachliche Rubrik steht dann darunter. */
  room: string;
  subtitle: string;
  gameIds: readonly string[];
}

export const CATEGORIES: readonly CategorySpec[] = [
  {
    id: 'board',
    icon: '♟️',
    title: 'Strategie- & Brettspiele',
    room: 'Spielstube',
    subtitle: 'Klassische Denk- und Positionsspiele auf dem Spielbrett.',
    gameIds: [
      'chess',
      'four-player-chess',
      'checkers',
      'dragon-towers',
      'go',
      'gomoku',
      'mill',
      'reversi',
      'chinese-checkers',
      'four-in-a-row',
      'ultimate-tic-tac-toe',
      'tic-tac-toe',
    ],
  },
  {
    id: 'cards',
    icon: '🃏',
    title: 'Karten- & Stichspiele',
    room: 'Kartentisch',
    subtitle: 'Traditionelle Stichspiele, Ablegespiele, Deckbau und Patiencen.',
    gameIds: [
      'skat',
      'schafkopf',
      'doppelkopf',
      'binokel',
      'poker',
      'uno',
      'mau-mau',
      'elevens',
      'market-stalls',
      'drachenspiel',
      'color-sorter',
      'solitaire',
      'quartett',
      'black-peter',
      'ligretto',
      'speed',
      'president',
    ],
  },
  {
    id: 'family',
    icon: '🎲',
    title: 'Familien-, Lege- & Gesellschaftsspiele',
    room: 'Festsaal',
    subtitle: 'Gemeinsam würfeln, kombinieren, merken und raten – auch in großer Runde.',
    gameIds: ['scrabble', 'word-salad', 'hangman', 'category-sprint', 'describe-duel', 'who-am-i', 'bible-quiz', 'estimate', 'majority', 'timeline', 'ludo', 'marketplace', 'turnip-patch', 'dominoes', 'color-and-shape', 'battleship', 'maexle', 'kniffel', 'low-flight', 'symbol-match', 'pairs', 'bingo', 'wolves-sheep'],
  },
  {
    id: 'math',
    icon: '📐',
    title: 'Mathe- & Rechenspiele (Kl. 5/6)',
    room: 'Schreibstube',
    subtitle: 'Kopfrechnen, Klammerterme, Teiler, Vielfache und Zahlenmauern spielerisch trainieren.',
    gameIds: ['duck-rally', 'target-number', 'factor-grid', 'number-wall'],
  },
];

/** Spiele der Rubrik „Familie & Gesellschaft“. */
export function familyGameIds(): readonly string[] {
  return CATEGORIES.find((category) => category.id === 'family')?.gameIds ?? [];
}
