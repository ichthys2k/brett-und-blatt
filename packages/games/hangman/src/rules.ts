import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import {
  ALPHABET,
  WORD_LISTS,
  isGuessableChar,
  isWordSolved,
  maskWord,
  normalizeWord,
  type HangmanCategory,
} from './words';

export type HangmanMode = 'coop' | 'race';
export type HangmanTheme = 'snowman' | 'flower' | 'gallows';

export interface WordSummary {
  round: number;
  displayWord: string;
  won: boolean;
  mistakes: number;
}

export interface WordBoardState {
  roundIndex: number;
  maskedWord: string;
  guessedLetters: string[];
  wrongLetters: string[];
  mistakes: number;
  wordsWon: number;
  done: boolean;
  lastWord: WordSummary | null;
}

export interface HangmanState {
  seats: number;
  category: HangmanCategory;
  mode: HangmanMode;
  theme: HangmanTheme;
  maxMistakes: number;
  totalRounds: number;
  /** Nur im Modus `coop`: wer gerade am Zug ist. */
  currentTurn: SeatId;
  /** Punkte je Sitzplatz. */
  scores: number[];
  /** Geheime normalisierte Wörter (in `playerView` leer). */
  secretWords: string[];
  /** Geheime Original-Schreibweise der Wörter (in `playerView` leer). */
  displayWords: string[];
  /** Im Modus `coop` genau 1 gemeinsames Brett (`boards[0]`), im Modus `race` 1 Brett je Sitzplatz. */
  boards: WordBoardState[];
}

export type HangmanMove = {
  type: 'guess';
  letter: string;
};

function createInitialBoard(firstSecretWord: string): WordBoardState {
  return {
    roundIndex: 0,
    maskedWord: maskWord(firstSecretWord, []),
    guessedLetters: [],
    wrongLetters: [],
    mistakes: 0,
    wordsWon: 0,
    done: false,
    lastWord: null,
  };
}

export function setup(seats: number, options: Options, seed: string): HangmanState {
  const category: HangmanCategory = (['alltag', 'tiere', 'knifflig', 'mathe'] as const).find(
    (c) => c === options.category,
  ) ?? 'alltag';
  const mode: HangmanMode = options.mode === 'race' ? 'race' : 'coop';
  const theme: HangmanTheme = (['snowman', 'flower', 'gallows'] as const).find(
    (t) => t === options.theme,
  ) ?? 'snowman';
  const maxMistakes = [6, 8, 10].includes(Number(options.maxMistakes))
    ? Number(options.maxMistakes)
    : 8;
  const totalRounds = [3, 4, 5].includes(Number(options.rounds)) ? Number(options.rounds) : 3;

  const rng = Rng.fromSeed(seed, 'hangman-words');
  const pool = WORD_LISTS[category];
  const chosenDisplay = rng.shuffle([...pool]).slice(0, totalRounds);
  const secretWords = chosenDisplay.map((w) => normalizeWord(w));
  const firstWord = secretWords[0] ?? 'SCHMETTERLING';

  const boardCount = mode === 'coop' ? 1 : seats;
  const boards = Array.from({ length: boardCount }, () => createInitialBoard(firstWord));

  return {
    seats,
    category,
    mode,
    theme,
    maxMistakes,
    totalRounds,
    currentTurn: 0,
    scores: new Array<number>(seats).fill(0),
    secretWords,
    displayWords: chosenDisplay,
    boards,
  };
}

export function currentPlayers(state: HangmanState): Actor[] {
  if (result(state)) return [];
  if (state.mode === 'coop') {
    const shared = state.boards[0];
    if (!shared || shared.done) return [];
    return [state.currentTurn];
  }
  return state.boards
    .map((b, seat) => (!b.done ? seat : -1))
    .filter((seat): seat is SeatId => seat >= 0);
}

export function legalMoves(state: HangmanState, actor: Actor): HangmanMove[] {
  if (actor === 'system' || actor < 0 || actor >= state.seats || result(state)) return [];
  if (state.mode === 'coop' && actor !== state.currentTurn) return [];

  const board = state.mode === 'coop' ? state.boards[0] : state.boards[actor];
  if (!board || board.done) return [];

  const guessedSet = new Set(board.guessedLetters);
  return ALPHABET.filter((letter) => !guessedSet.has(letter)).map((letter) => ({
    type: 'guess' as const,
    letter,
  }));
}

export function applyMove(
  state: HangmanState,
  actor: Actor,
  move: HangmanMove,
): MoveResult<HangmanState> {
  if (actor === 'system' || actor < 0 || actor >= state.seats || result(state)) {
    throw new Error('Unerlaubter Zug in Galgenmännchen.');
  }
  if (state.mode === 'coop' && actor !== state.currentTurn) {
    throw new Error('Dieser Sitzplatz ist nicht am Zug.');
  }

  const letter = move.letter?.toUpperCase();
  if (!letter || !ALPHABET.includes(letter)) {
    throw new Error('Ungültiger Buchstabe.');
  }

  const boardIdx = state.mode === 'coop' ? 0 : actor;
  const board = state.boards[boardIdx];
  if (!board || board.done || board.guessedLetters.includes(letter)) {
    throw new Error('Buchstabe wurde bereits geraten.');
  }

  const secretWord = state.secretWords[board.roundIndex] ?? '';
  const displayWord = state.displayWords[board.roundIndex] ?? secretWord;

  const nextGuessed = [...board.guessedLetters, letter];
  const occurrences = [...secretWord].filter((ch) => ch === letter).length;
  const isHit = occurrences > 0;
  const nextMistakes = isHit ? board.mistakes : board.mistakes + 1;
  const nextWrong = isHit ? board.wrongLetters : [...board.wrongLetters, letter];

  const wordSolved = isWordSolved(secretWord, nextGuessed);
  const wordLost = !wordSolved && nextMistakes >= state.maxMistakes;

  const nextScores = state.scores.slice();
  const events: GameEvent[] = [];

  if (isHit) {
    const pts = state.mode === 'coop' ? occurrences * 2 : occurrences;
    nextScores[actor] = (nextScores[actor] ?? 0) + pts;
    events.push({ type: 'hit', seat: actor, letter, occurrences });
  } else {
    events.push({ type: 'miss', seat: actor, letter, mistakes: nextMistakes });
  }

  let nextBoard: WordBoardState;

  if (wordSolved || wordLost) {
    const nextWordsWon = wordSolved ? board.wordsWon + 1 : board.wordsWon;
    if (wordSolved) {
      if (state.mode === 'coop') {
        // Abschluss-Bonus für den Löser + Team-Bonus für alle
        nextScores[actor] = (nextScores[actor] ?? 0) + 5;
        for (let s = 0; s < state.seats; s++) {
          nextScores[s] = (nextScores[s] ?? 0) + 4;
        }
      } else {
        const bonus = 10 + (state.maxMistakes - nextMistakes) * 2;
        nextScores[actor] = (nextScores[actor] ?? 0) + bonus;
      }
    }

    const summary: WordSummary = {
      round: board.roundIndex + 1,
      displayWord,
      won: wordSolved,
      mistakes: nextMistakes,
    };

    events.push({
      type: wordSolved ? 'wordWon' : 'wordLost',
      seat: actor,
      word: displayWord,
      round: board.roundIndex + 1,
    });

    const nextRoundIdx = board.roundIndex + 1;
    if (nextRoundIdx >= state.totalRounds) {
      nextBoard = {
        roundIndex: nextRoundIdx,
        maskedWord: displayWord.toUpperCase(),
        guessedLetters: nextGuessed,
        wrongLetters: nextWrong,
        mistakes: nextMistakes,
        wordsWon: nextWordsWon,
        done: true,
        lastWord: summary,
      };
    } else {
      const nextSecret = state.secretWords[nextRoundIdx] ?? '';
      nextBoard = {
        roundIndex: nextRoundIdx,
        maskedWord: maskWord(nextSecret, []),
        guessedLetters: [],
        wrongLetters: [],
        mistakes: 0,
        wordsWon: nextWordsWon,
        done: false,
        lastWord: summary,
      };
    }
  } else {
    nextBoard = {
      ...board,
      maskedWord: maskWord(secretWord, nextGuessed),
      guessedLetters: nextGuessed,
      wrongLetters: nextWrong,
      mistakes: nextMistakes,
    };
  }

  const nextBoards = state.boards.slice();
  nextBoards[boardIdx] = nextBoard;

  const nextTurn = state.mode === 'coop' ? (state.currentTurn + 1) % state.seats : state.currentTurn;

  return {
    state: {
      ...state,
      currentTurn: nextTurn,
      scores: nextScores,
      boards: nextBoards,
    },
    events,
  };
}

/**
 * Verbirgt `secretWords` und `displayWords`.
 * Im Wettrennen (`race`) sieht jeder sein eigenes Brett vollständig, während auf fremden Brettern
 * die bereits aufgedeckten Buchstaben als `•` erscheinen (Fortschritt sichtbar, Buchstaben geheim).
 */
export function playerView(state: HangmanState, viewer: SeatId | 'spectator'): HangmanState {
  if (state.mode === 'coop') {
    return {
      ...state,
      secretWords: [],
      displayWords: [],
    };
  }

  return {
    ...state,
    secretWords: [],
    displayWords: [],
    boards: state.boards.map((b, idx) => {
      if (idx === viewer || b.done) return b;
      const anonymizedMask = [...b.maskedWord]
        .map((ch) => (ch === '_' || ch === ' ' || ch === '-' ? ch : '•'))
        .join('');
      return {
        ...b,
        maskedWord: anonymizedMask,
        guessedLetters: [],
        wrongLetters: [],
      };
    }),
  };
}

/** Zählt, wie viele Buchstaben im aktuellen `maskedWord` bereits aufgedeckt sind. */
export function revealedStats(maskedWord: string): { revealed: number; total: number } {
  let revealed = 0;
  let total = 0;
  for (const ch of maskedWord) {
    if (ch === ' ' || ch === '-') continue;
    total++;
    if (ch !== '_') revealed++;
  }
  return { revealed, total };
}

export function result(state: HangmanState): Result | null {
  if (state.mode === 'coop') {
    const shared = state.boards[0];
    if (!shared || !shared.done) return null;
    if (state.seats === 1) {
      return shared.wordsWon > 0
        ? { kind: 'win', winners: [0] }
        : { kind: 'loss', reason: 'Kein Wort gelöst' };
    }
    const maxScore = Math.max(...state.scores);
    if (maxScore <= 0 && shared.wordsWon === 0) {
      return { kind: 'loss', reason: 'Kein Wort gelöst' };
    }
    const winners = state.scores
      .map((s, idx) => (s === maxScore ? idx : -1))
      .filter((idx): idx is SeatId => idx >= 0);
    return { kind: 'win', winners };
  }

  // Modus 'race': Sobald der erste Spieler alle Runden abgeschlossen und mindestens 1 Wort gelöst hat
  // (oder alle Spieler ihre Runden beendet haben), steht das Rennergebnis fest.
  const someoneFinishedWell = state.boards.some((b) => b.done && b.wordsWon > 0);
  const allDone = state.boards.every((b) => b.done);
  if (!someoneFinishedWell && !allDone) return null;

  const maxScore = Math.max(...state.scores);
  if (maxScore <= 0) {
    return state.seats === 1 ? { kind: 'loss' } : { kind: 'draw' };
  }
  const winners = state.scores
    .map((s, idx) => (s === maxScore ? idx : -1))
    .filter((idx): idx is SeatId => idx >= 0);
  return { kind: 'win', winners };
}
