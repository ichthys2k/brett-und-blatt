/** Zuordnung Spiel → Kulisse und Rubrik → Kulisse (#316); die Kennungen heißen wie die Dateien in assets/kulissen. */
export const SCENE_BY_GAME: Readonly<Record<string, string>> = {
  battleship: 'hafen',
  'turnip-patch': 'acker',
  'duck-rally': 'bach',
  'wolves-sheep': 'nachtweide',
  'bible-quiz': 'schreibstube',
  hangman: 'schreibstube',
  'word-salad': 'schreibstube',
  'describe-duel': 'schreibstube',
  'category-sprint': 'schreibstube',
  scrabble: 'schreibstube',
  timeline: 'sternwarte',
  estimate: 'sternwarte',
  marketplace: 'marktplatz',
  'market-stalls': 'marktplatz',
  grafschaft: 'marktplatz',
  maexle: 'wuerfelstube',
  kniffel: 'wuerfelstube',
  poker: 'wuerfelstube',
};

export const SCENE_BY_CATEGORY: Readonly<Record<string, string>> = {
  board: 'rubrik-strategie',
  cards: 'rubrik-karten',
  family: 'rubrik-familie',
  math: 'rubrik-mathe',
};


export const SCENE_IDS: readonly string[] = [...new Set([...Object.values(SCENE_BY_GAME), ...Object.values(SCENE_BY_CATEGORY)])];
