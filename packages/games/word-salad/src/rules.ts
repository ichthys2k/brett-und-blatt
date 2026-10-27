import { Rng, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import {
  STEM_CATALOG,
  canFormFromStem,
  getValidSubwords,
  normalizeSaladWord,
  scoreWordLength,
  type SaladCategory,
} from './words';

export type SaladMode = 'classic' | 'unique';

export interface FoundWordEntry {
  word: string;
  basePoints: number;
  bonusPoints: number;
  unique: boolean;
}

export interface RoundSummary {
  round: number;
  stemDisplay: string;
  stemWord: string;
  playerFinds: FoundWordEntry[][];
  missedGems: string[];
}

export interface SaladPlayerState {
  seat: SeatId;
  score: number;
  totalWordsFound: number;
  /** Gefundene Wörter in der aktuellen Runde (für andere Plätze in `playerView` ausgeblendet). */
  foundWords: string[];
  /** Anzahl der in der aktuellen Runde gefundenen Wörter (immer sichtbar). */
  foundCount: number;
  /** Hat der Platz die aktuelle Runde beendet? */
  done: boolean;
}

export interface WordSaladState {
  seats: number;
  mode: SaladMode;
  category: SaladCategory;
  totalRounds: number;
  minLength: number;
  roundIndex: number;
  stemWords: string[];
  stemDisplays: string[];
  stemHints: string[];
  /** Aktuelles normalisiertes Stammwort, z. B. "SONNENBLUME". */
  currentStem: string;
  /** Aktuelle Anzeige-Schreibweise, z. B. "Sonnenblume". */
  currentDisplay: string;
  /** Hinweis zum aktuellen Stammwort. */
  currentHint: string;
  /** Gesamtanzahl gültiger Teilwörter für das aktuelle Stammwort. */
  totalPossible: number;
  players: SaladPlayerState[];
  lastRoundSummary: RoundSummary | null;
  done: boolean;
}

export type WordSaladMove =
  | { type: 'submit'; word: string }
  | { type: 'finishRound' };

function parseRounds(raw: unknown): number {
  const n = Number(raw);
  return n === 1 || n === 3 || n === 5 ? n : 3;
}

function parseMinLength(raw: unknown): number {
  return Number(raw) === 4 ? 4 : 3;
}

export function setup(seats: number, options: Options, seed: string): WordSaladState {
  const rng = Rng.fromSeed(seed, 'word-salad-setup');
  const mode: SaladMode = options.mode === 'unique' ? 'unique' : 'classic';
  const category: SaladCategory =
    options.category === 'natur' || options.category === 'mathe' ? options.category : 'mix';
  const totalRounds = parseRounds(options.rounds);
  const minLength = parseMinLength(options.minLength);

  // Pool aus der gewählten Kategorie zusammenstellen (bei Bedarf mit 'mix' auffüllen)
  const primaryPool = [...STEM_CATALOG[category]];
  const fallbackPool = category === 'mix' ? [] : [...STEM_CATALOG.mix];
  const shuffled = [...rng.shuffle(primaryPool), ...rng.shuffle(fallbackPool)];
  const selected = shuffled.slice(0, totalRounds);

  const stemWords = selected.map((e) => normalizeSaladWord(e.display));
  const stemDisplays = selected.map((e) => e.display);
  const stemHints = selected.map((e) => e.hint);

  const currentStem = stemWords[0] ?? 'SONNENBLUME';
  const currentDisplay = stemDisplays[0] ?? 'Sonnenblume';
  const currentHint = stemHints[0] ?? '';
  const validNow = getValidSubwords(currentStem, minLength);

  const players: SaladPlayerState[] = Array.from({ length: seats }, (_, seat) => ({
    seat,
    score: 0,
    totalWordsFound: 0,
    foundWords: [],
    foundCount: 0,
    done: false,
  }));

  return {
    seats,
    mode,
    category,
    totalRounds,
    minLength,
    roundIndex: 0,
    stemWords,
    stemDisplays,
    stemHints,
    currentStem,
    currentDisplay,
    currentHint,
    totalPossible: validNow.length,
    players,
    lastRoundSummary: null,
    done: false,
  };
}

export function currentPlayers(state: WordSaladState): SeatId[] {
  if (state.done) return [];
  return state.players.filter((p) => !p.done).map((p) => p.seat);
}

export function isLegal(state: WordSaladState, seat: SeatId, move: WordSaladMove): boolean {
  if (state.done) return false;
  const player = state.players[seat];
  if (!player || player.done) return false;

  if (move.type === 'finishRound') return true;
  if (move.type === 'submit') {
    const norm = normalizeSaladWord(move.word);
    if (!canFormFromStem(norm, state.currentStem, state.minLength)) return false;
    if (player.foundWords.includes(norm)) return false;
    const valid = getValidSubwords(state.currentStem, state.minLength);
    return valid.includes(norm);
  }
  return false;
}

export function legalMoves(state: WordSaladState, seat: SeatId): WordSaladMove[] {
  if (state.done) return [];
  const player = state.players[seat];
  if (!player || player.done) return [];

  const valid = getValidSubwords(state.currentStem, state.minLength);
  const foundSet = new Set(player.foundWords);
  const unfound = valid.filter((w) => !foundSet.has(w));

  // Auswahl von bis zu 8 Beispiel-Zügen (4 längere, 4 kürzere) + Rundenende
  const longOnes = unfound.slice(0, 4);
  const shortOnes = unfound.slice(-4).filter((w) => !longOnes.includes(w));
  const examples: WordSaladMove[] = [...longOnes, ...shortOnes].map((word) => ({
    type: 'submit',
    word,
  }));

  return [...examples, { type: 'finishRound' }];
}

function finalizeRound(state: WordSaladState, events: GameEvent[]): WordSaladState {
  // Häufigkeit jedes gefundenen Wortes über alle Plätze zählen
  const wordCounts = new Map<string, number>();
  for (const p of state.players) {
    for (const w of p.foundWords) {
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
    }
  }

  const allFoundSet = new Set<string>(wordCounts.keys());
  const allValid = getValidSubwords(state.currentStem, state.minLength);
  const missedGems = allValid.filter((w) => !allFoundSet.has(w)).slice(0, 12);

  const playerFinds: FoundWordEntry[][] = [];
  const updatedPlayers: SaladPlayerState[] = state.players.map((p) => {
    let bonusSum = 0;
    const entries: FoundWordEntry[] = p.foundWords.map((w) => {
      const basePoints = scoreWordLength(w.length);
      const isUnique =
        state.mode === 'unique' &&
        (state.seats > 1 ? wordCounts.get(w) === 1 : w.length >= 6);
      const bonusPoints = isUnique ? basePoints : 0;
      bonusSum += bonusPoints;
      return { word: w, basePoints, bonusPoints, unique: isUnique };
    });
    playerFinds.push(entries);
    return {
      ...p,
      score: p.score + bonusSum,
    };
  });

  const summary: RoundSummary = {
    round: state.roundIndex + 1,
    stemDisplay: state.currentDisplay,
    stemWord: state.currentStem,
    playerFinds,
    missedGems,
  };

  events.push({
    type: 'roundFinished',
    payload: {
      round: summary.round,
      stemDisplay: summary.stemDisplay,
    },
  });

  const nextRound = state.roundIndex + 1;
  if (nextRound >= state.totalRounds) {
    return {
      ...state,
      players: updatedPlayers,
      lastRoundSummary: summary,
      done: true,
    };
  }

  const nextStem = state.stemWords[nextRound] ?? 'SONNENBLUME';
  const nextDisplay = state.stemDisplays[nextRound] ?? 'Sonnenblume';
  const nextHint = state.stemHints[nextRound] ?? '';
  const nextValid = getValidSubwords(nextStem, state.minLength);

  const resetPlayers: SaladPlayerState[] = updatedPlayers.map((p) => ({
    ...p,
    foundWords: [],
    foundCount: 0,
    done: false,
  }));

  return {
    ...state,
    roundIndex: nextRound,
    currentStem: nextStem,
    currentDisplay: nextDisplay,
    currentHint: nextHint,
    totalPossible: nextValid.length,
    players: resetPlayers,
    lastRoundSummary: summary,
  };
}

export function applyMove(state: WordSaladState, seat: SeatId, move: WordSaladMove): MoveResult<WordSaladState> {
  if (!isLegal(state, seat, move)) {
    throw new Error('Ungültiger Zug beim Wort-Salat.');
  }

  const events: GameEvent[] = [];
  const player = state.players[seat]!;
  let updatedPlayer: SaladPlayerState;

  if (move.type === 'finishRound') {
    updatedPlayer = {
      ...player,
      done: true,
    };
    events.push({ type: 'playerFinishedRound', seat });
  } else {
    const norm = normalizeSaladWord(move.word);
    const pts = scoreWordLength(norm.length);
    const newFound = [...player.foundWords, norm];
    const allFoundNow = newFound.length >= state.totalPossible;

    updatedPlayer = {
      ...player,
      score: player.score + pts,
      totalWordsFound: player.totalWordsFound + 1,
      foundWords: newFound,
      foundCount: newFound.length,
      done: allFoundNow,
    };
    events.push({
      type: 'wordFound',
      seat,
      payload: { wordLength: norm.length, points: pts },
    });
  }

  const nextPlayers = state.players.map((p, idx) => (idx === seat ? updatedPlayer : p));
  let nextState: WordSaladState = {
    ...state,
    players: nextPlayers,
  };

  if (nextState.players.every((p) => p.done)) {
    nextState = finalizeRound(nextState, events);
  }

  return { state: nextState, events };
}

export function result(state: WordSaladState): Result | null {
  if (!state.done) return null;

  let bestScore = -1;
  let bestWords = -1;
  for (const p of state.players) {
    if (p.score > bestScore || (p.score === bestScore && p.totalWordsFound > bestWords)) {
      bestScore = p.score;
      bestWords = p.totalWordsFound;
    }
  }

  const winners: SeatId[] = [];
  for (const p of state.players) {
    if (p.score === bestScore && p.totalWordsFound === bestWords) {
      winners.push(p.seat);
    }
  }

  return { kind: 'win', winners };
}

export function playerView(state: WordSaladState, viewer: SeatId): WordSaladState {
  return {
    ...state,
    stemWords: [],
    stemDisplays: [],
    stemHints: [],
    players: state.players.map((p) =>
      p.seat === viewer || state.done
        ? p
        : {
            ...p,
            foundWords: [],
          },
    ),
  };
}
