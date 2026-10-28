export type Letter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  | 'Ä'
  | 'Ö'
  | 'Ü';

export type Tile = Letter | '?';

export const LETTER_VALUES: Record<Letter, number> = {
  A: 1,
  B: 3,
  C: 4,
  D: 1,
  E: 1,
  F: 4,
  G: 2,
  H: 2,
  I: 1,
  J: 6,
  K: 4,
  L: 2,
  M: 3,
  N: 1,
  O: 2,
  P: 4,
  Q: 10,
  R: 1,
  S: 1,
  T: 1,
  U: 1,
  V: 6,
  W: 3,
  X: 8,
  Y: 10,
  Z: 3,
  Ä: 6,
  Ö: 8,
  Ü: 6,
};

export const LETTER_DISTRIBUTION: Record<Letter, number> = {
  A: 5,
  Ä: 1,
  B: 2,
  C: 2,
  D: 4,
  E: 15,
  F: 2,
  G: 3,
  H: 4,
  I: 6,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 9,
  O: 3,
  Ö: 1,
  P: 1,
  Q: 1,
  R: 6,
  S: 7,
  T: 6,
  U: 6,
  Ü: 1,
  V: 1,
  W: 2,
  X: 1,
  Y: 1,
  Z: 2,
};

export const BLANK_COUNT = 2;
export const RACK_SIZE = 7;

export function createBag(): Tile[] {
  const bag: Tile[] = [];
  for (const letter of Object.keys(LETTER_DISTRIBUTION) as Letter[]) {
    for (let i = 0; i < LETTER_DISTRIBUTION[letter]; i++) {
      bag.push(letter);
    }
  }
  for (let i = 0; i < BLANK_COUNT; i++) bag.push('?');
  return bag;
}
