import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';

export type Landscape = 'wald' | 'wiese' | 'feld' | 'teich' | 'dorf' | 'berg';
export const ALL_LANDSCAPES: readonly Landscape[] = ['wald', 'wiese', 'feld', 'teich', 'dorf', 'berg'];

export interface Tile {
  id: number;
  type: Landscape;
  river?: boolean;
  road?: boolean;
  mill?: boolean;
}

export interface PlacedTile extends Tile {
  q: number;
  r: number;
  owner: SeatId;
}

export interface QuestDef {
  id: string;
  name: string;
  text: string;
  points: number;
}

export const HEX_DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function parseHexKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

export function getNeighbors(board: Record<string, PlacedTile>, q: number, r: number): PlacedTile[] {
  const neighbors: PlacedTile[] = [];
  for (const [dq, dr] of HEX_DIRECTIONS) {
    const key = hexKey(q + dq, r + dr);
    const tile = board[key];
    if (tile !== undefined) {
      neighbors.push(tile);
    }
  }
  return neighbors;
}

export function getLegalPlacements(board: Record<string, PlacedTile>): { q: number; r: number }[] {
  const placements = new Map<string, { q: number; r: number }>();
  for (const key of Object.keys(board)) {
    const { q, r } = parseHexKey(key);
    for (const [dq, dr] of HEX_DIRECTIONS) {
      const nq = q + dq;
      const nr = r + dr;
      const nKey = hexKey(nq, nr);
      if (board[nKey] === undefined && !placements.has(nKey)) {
        placements.set(nKey, { q: nq, r: nr });
      }
    }
  }
  return Array.from(placements.values());
}

/** Zusammenhängende Komponente auf dem Hex-Raster ermitteln */
function getConnectedComponentSize(
  board: Record<string, PlacedTile>,
  startKey: string,
  predicate: (tile: PlacedTile) => boolean,
): number {
  const visited = new Set<string>();
  const queue = [startKey];
  visited.add(startKey);

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    const { q, r } = parseHexKey(currentKey);
    for (const [dq, dr] of HEX_DIRECTIONS) {
      const nKey = hexKey(q + dq, r + dr);
      if (!visited.has(nKey)) {
        const neighbor = board[nKey];
        if (neighbor !== undefined && predicate(neighbor)) {
          visited.add(nKey);
          queue.push(nKey);
        }
      }
    }
  }
  return visited.size;
}

/** 20 Hofaufträge */
export const QUEST_CATALOG: Record<string, QuestDef> = {
  q1: { id: 'q1', name: 'Die Gans', text: 'Mindestens 3 Teiche zusammenhängend', points: 3 },
  q2: { id: 'q2', name: 'Der Müller', text: 'Eine Mühle am Fluss oder Teich', points: 3 },
  q3: { id: 'q3', name: 'Der Bär', text: 'Mindestens 4 Wälder zusammenhängend', points: 4 },
  q4: { id: 'q4', name: 'Der Ritter', text: 'Ein Berg direkt an einem Weg', points: 2 },
  q5: { id: 'q5', name: 'Der Schäfer', text: 'Eine Wiese direkt neben einem Dorf', points: 2 },
  q6: { id: 'q6', name: 'Die Wirtin', text: 'Ein Dorf mit mind. 4 verschiedenen Landschaften', points: 4 },
  q7: { id: 'q7', name: 'Der Fischer', text: 'Ein Teich direkt neben einem Wald', points: 2 },
  q8: { id: 'q8', name: 'Der Einsiedler', text: 'Ein Berg ohne Dorf im Umkreis von 2 Feldern', points: 3 },
  q9: { id: 'q9', name: 'Der Bauer', text: 'Mindestens 4 Felder zusammenhängend', points: 4 },
  q10: { id: 'q10', name: 'Der Bote', text: 'Wegstrecke von mindestens 4 Plättchen', points: 4 },
  q11: { id: 'q11', name: 'Der Flusslauf', text: 'Flusslauf von mindestens 4 Plättchen', points: 4 },
  q12: { id: 'q12', name: 'Das Bergnest', text: 'Ein Dorf direkt an einem Berg', points: 3 },
  q13: { id: 'q13', name: 'Die Schafweide', text: 'Mindestens 4 Wiesen zusammenhängend', points: 4 },
  q14: { id: 'q14', name: 'Der Hofnarr', text: 'Ein Plättchen mit mindestens 4 Nachbarn', points: 3 },
  q15: { id: 'q15', name: 'Der Baumeister', text: 'Ein voll umringtes Dorf (6 Nachbarn)', points: 5 },
  q16: { id: 'q16', name: 'Die Kornkammer', text: 'Eine Mühle an mindestens 2 Feldern', points: 3 },
  q17: { id: 'q17', name: 'Der Wanderer', text: 'Ein Weg, der an Berg und Teich grenzt', points: 4 },
  q18: { id: 'q18', name: 'Das Doppeldorf', text: 'Zwei Dörfer direkt benachbart', points: 3 },
  q19: { id: 'q19', name: 'Der Schilfgürtel', text: 'Ein Teich grenzt an Wiese und Feld', points: 3 },
  q20: { id: 'q20', name: 'Die Waldlichtung', text: 'Eine Wiese grenzt an mind. 3 Wälder', points: 3 },
};

export const ALL_QUEST_IDS = Object.keys(QUEST_CATALOG);

export function checkQuestCondition(questId: string, board: Record<string, PlacedTile>): boolean {
  switch (questId) {
    case 'q1': {
      for (const [key, tile] of Object.entries(board)) {
        if (tile.type === 'teich' && getConnectedComponentSize(board, key, (t) => t.type === 'teich') >= 3) return true;
      }
      return false;
    }
    case 'q2': {
      for (const tile of Object.values(board)) {
        if (tile.mill) {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (neighbors.some((n) => n.type === 'teich' || n.river)) return true;
        }
      }
      return false;
    }
    case 'q3': {
      for (const [key, tile] of Object.entries(board)) {
        if (tile.type === 'wald' && getConnectedComponentSize(board, key, (t) => t.type === 'wald') >= 4) return true;
      }
      return false;
    }
    case 'q4': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'berg') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (tile.road || neighbors.some((n) => n.road)) return true;
        }
      }
      return false;
    }
    case 'q5': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'dorf') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (neighbors.some((n) => n.type === 'wiese')) return true;
        }
      }
      return false;
    }
    case 'q6': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'dorf') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          const types = new Set(neighbors.map((n) => n.type));
          if (types.size >= 4) return true;
        }
      }
      return false;
    }
    case 'q7': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'teich') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (neighbors.some((n) => n.type === 'wald')) return true;
        }
      }
      return false;
    }
    case 'q8': {
      const villages = Object.values(board).filter((t) => t.type === 'dorf');
      for (const tile of Object.values(board)) {
        if (tile.type === 'berg') {
          const isolated = villages.every((v) => hexDistance(tile.q, tile.r, v.q, v.r) >= 2);
          if (isolated) return true;
        }
      }
      return false;
    }
    case 'q9': {
      for (const [key, tile] of Object.entries(board)) {
        if (tile.type === 'feld' && getConnectedComponentSize(board, key, (t) => t.type === 'feld') >= 4) return true;
      }
      return false;
    }
    case 'q10': {
      for (const [key, tile] of Object.entries(board)) {
        if (tile.road && getConnectedComponentSize(board, key, (t) => Boolean(t.road)) >= 4) return true;
      }
      return false;
    }
    case 'q11': {
      for (const [key, tile] of Object.entries(board)) {
        if (tile.river && getConnectedComponentSize(board, key, (t) => Boolean(t.river)) >= 4) return true;
      }
      return false;
    }
    case 'q12': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'dorf') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (neighbors.some((n) => n.type === 'berg')) return true;
        }
      }
      return false;
    }
    case 'q13': {
      for (const [key, tile] of Object.entries(board)) {
        if (tile.type === 'wiese' && getConnectedComponentSize(board, key, (t) => t.type === 'wiese') >= 4) return true;
      }
      return false;
    }
    case 'q14': {
      for (const tile of Object.values(board)) {
        if (getNeighbors(board, tile.q, tile.r).length >= 4) return true;
      }
      return false;
    }
    case 'q15': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'dorf' && getNeighbors(board, tile.q, tile.r).length === 6) return true;
      }
      return false;
    }
    case 'q16': {
      for (const tile of Object.values(board)) {
        if (tile.mill) {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (neighbors.filter((n) => n.type === 'feld').length >= 2) return true;
        }
      }
      return false;
    }
    case 'q17': {
      for (const tile of Object.values(board)) {
        if (tile.road) {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          const hasMountain = tile.type === 'berg' || neighbors.some((n) => n.type === 'berg');
          const hasPond = tile.type === 'teich' || neighbors.some((n) => n.type === 'teich');
          if (hasMountain && hasPond) return true;
        }
      }
      return false;
    }
    case 'q18': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'dorf') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (neighbors.some((n) => n.type === 'dorf')) return true;
        }
      }
      return false;
    }
    case 'q19': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'teich') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          const hasPasture = neighbors.some((n) => n.type === 'wiese');
          const hasField = neighbors.some((n) => n.type === 'feld');
          if (hasPasture && hasField) return true;
        }
      }
      return false;
    }
    case 'q20': {
      for (const tile of Object.values(board)) {
        if (tile.type === 'wiese') {
          const neighbors = getNeighbors(board, tile.q, tile.r);
          if (neighbors.filter((n) => n.type === 'wald').length >= 3) return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

/** Standard-Plättchen-Verteilung (60 Plättchen) */
export function buildStandardDeck(): Tile[] {
  const deck: Tile[] = [];
  let id = 1;

  // Wald: 14 Plättchen (4 mit Fluss, 4 mit Weg)
  for (let i = 0; i < 14; i++) {
    deck.push({ id: id++, type: 'wald', river: i < 4, road: i >= 4 && i < 8 });
  }
  // Wiese: 12 Plättchen (3 mit Fluss, 4 mit Weg)
  for (let i = 0; i < 12; i++) {
    deck.push({ id: id++, type: 'wiese', river: i < 3, road: i >= 3 && i < 7 });
  }
  // Feld: 12 Plättchen (3 mit Mühle, 4 mit Weg)
  for (let i = 0; i < 12; i++) {
    deck.push({ id: id++, type: 'feld', road: i < 4, mill: i >= 4 && i < 7 });
  }
  // Teich: 8 Plättchen (4 mit Fluss)
  for (let i = 0; i < 8; i++) {
    deck.push({ id: id++, type: 'teich', river: i < 4 });
  }
  // Berg: 6 Plättchen (2 mit Weg)
  for (let i = 0; i < 6; i++) {
    deck.push({ id: id++, type: 'berg', road: i < 2 });
  }
  // Dorf: 8 Plättchen (4 mit Weg)
  for (let i = 0; i < 8; i++) {
    deck.push({ id: id++, type: 'dorf', road: i < 4 });
  }

  return deck;
}

export const HIDDEN_TILE: Tile = { id: -1, type: 'wald' };
export const HIDDEN_QUEST: QuestDef = { id: 'hidden', name: 'Geheimer Auftrag', text: 'Wird bei Erfüllung aufgedeckt.', points: 0 };

export interface GrafschaftState {
  seats: number;
  turn: SeatId;
  board: Record<string, PlacedTile>;
  market: Tile[];
  deck: Tile[];
  questDeck: QuestDef[];
  playerQuests: QuestDef[][];
  completedQuests: { seat: SeatId; quest: QuestDef }[][];
  scores: number[];
  villageScores: number[];
  questScores: number[];
  lastPlaced: { q: number; r: number; tile: Tile; points: number } | null;
  winner: SeatId | null;
  moveCount: number;
}

export interface GrafschaftMove {
  type: 'place';
  marketIndex: number;
  q: number;
  r: number;
}

export function setup(seats: number, options: Options, seed: string): GrafschaftState {
  const count = Math.max(2, Math.min(5, Number(seats) || 2));
  const rng = Rng.fromSeed(seed);

  let rawDeck = rng.shuffle(buildStandardDeck());
  const deckSizeOpt = options.deckSize === '40' ? 40 : 60;
  if (rawDeck.length > deckSizeOpt) {
    rawDeck = rawDeck.slice(0, deckSizeOpt);
  }

  let questDeck = rng.shuffle(Object.values(QUEST_CATALOG));

  // Startplättchen in der Mitte (0, 0)
  const startTile: PlacedTile = {
    id: 0,
    type: 'wald',
    river: true,
    road: true,
    q: 0,
    r: 0,
    owner: -1 as SeatId,
  };
  const board: Record<string, PlacedTile> = {
    [hexKey(0, 0)]: startTile,
  };

  // 5 Plättchen auf dem Jahrmarkt
  const market = rawDeck.splice(0, 5);

  // 3 Aufträge je Spieler
  const playerQuests: QuestDef[][] = [];
  for (let s = 0; s < count; s++) {
    playerQuests.push(questDeck.splice(0, 3));
  }

  return {
    seats: count,
    turn: 0,
    board,
    market,
    deck: rawDeck,
    questDeck,
    playerQuests,
    completedQuests: Array.from({ length: count }, () => []),
    scores: Array(count).fill(0),
    villageScores: Array(count).fill(0),
    questScores: Array(count).fill(0),
    lastPlaced: null,
    winner: null,
    moveCount: 0,
  };
}

export function currentPlayers(state: GrafschaftState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: GrafschaftState, actor: Actor): GrafschaftMove[] {
  if (actor !== state.turn || result(state)) return [];
  if (state.market.length === 0) return [];

  const legalPlacements = getLegalPlacements(state.board);
  const moves: GrafschaftMove[] = [];

  for (let mIdx = 0; mIdx < state.market.length; mIdx++) {
    for (const { q, r } of legalPlacements) {
      moves.push({ type: 'place', marketIndex: mIdx, q, r });
    }
  }

  return moves;
}

export function isLegal(state: GrafschaftState, actor: Actor, move: GrafschaftMove): boolean {
  if (actor !== state.turn || result(state)) return false;
  if (move.type !== 'place') return false;
  if (move.marketIndex < 0 || move.marketIndex >= state.market.length) return false;

  const key = hexKey(move.q, move.r);
  if (state.board[key] !== undefined) return false;

  // Muss an mindestens ein liegendes Sechseck angrenzen
  const neighbors = getNeighbors(state.board, move.q, move.r);
  return neighbors.length > 0;
}

export function applyMove(state: GrafschaftState, actor: Actor, move: GrafschaftMove): MoveResult<GrafschaftState> {
  if (!isLegal(state, actor, move)) {
    throw new Error(`Unerlaubter Zug von Platz ${actor}`);
  }

  const seat = actor as SeatId;
  const events: GameEvent[] = [];

  // Kopie des Zustands
  const board = { ...state.board };
  const market = [...state.market];
  const deck = [...state.deck];
  const questDeck = [...state.questDeck];
  const playerQuests = state.playerQuests.map((qList) => [...qList]);
  const completedQuests = state.completedQuests.map((cList) => [...cList]);
  const scores = [...state.scores];
  const villageScores = [...state.villageScores];
  const questScores = [...state.questScores];

  // Plättchen vom Jahrmarkt nehmen
  const chosenTile = market.splice(move.marketIndex, 1)[0]!;
  const placedTile: PlacedTile = {
    ...chosenTile,
    q: move.q,
    r: move.r,
    owner: seat,
  };
  board[hexKey(move.q, move.r)] = placedTile;

  events.push({
    type: 'tilePlaced',
    seat,
    q: move.q,
    r: move.r,
    tileId: placedTile.id,
    landscape: placedTile.type,
  });

  let turnPoints = 0;

  // 1. Dorf-Vielfalt berechnen
  if (placedTile.type === 'dorf') {
    const neighbors = getNeighbors(board, move.q, move.r);
    const uniqueTypes = new Set(neighbors.map((n) => n.type));
    const diversityPoints = uniqueTypes.size;
    if (diversityPoints > 0) {
      scores[seat] = (scores[seat] ?? 0) + diversityPoints;
      villageScores[seat] = (villageScores[seat] ?? 0) + diversityPoints;
      turnPoints += diversityPoints;
      events.push({
        type: 'villageScored',
        seat,
        q: move.q,
        r: move.r,
        points: diversityPoints,
        types: Array.from(uniqueTypes),
      });
    }
  }

  // 2. Hofaufträge für den aktiven Spieler prüfen
  const ownQuests = playerQuests[seat]!;
  const survivingQuests: QuestDef[] = [];

  for (const quest of ownQuests) {
    if (checkQuestCondition(quest.id, board)) {
      scores[seat] = (scores[seat] ?? 0) + quest.points;
      questScores[seat] = (questScores[seat] ?? 0) + quest.points;
      turnPoints += quest.points;
      completedQuests[seat]!.push({ seat, quest });

      events.push({
        type: 'questCompleted',
        seat,
        questId: quest.id,
        points: quest.points,
        questName: quest.name,
      });

      // Neuen Auftrag nachziehen, falls noch welche im Stapel sind
      if (questDeck.length > 0) {
        survivingQuests.push(questDeck.pop()!);
      }
    } else {
      survivingQuests.push(quest);
    }
  }
  playerQuests[seat] = survivingQuests;

  // 3. Jahrmarkt nachfüllen
  if (deck.length > 0) {
    market.push(deck.pop()!);
  }

  // 4. Spielende prüfen
  let winner: SeatId | null = null;
  const isOver = market.length === 0;

  if (isOver) {
    let bestScore = -Infinity;
    let bestCompleted = -Infinity;
    let winningSeat: SeatId = 0;

    for (let s = 0; s < state.seats; s++) {
      const totalScore = scores[s] ?? 0;
      const countCompleted = completedQuests[s]!.length;
      if (totalScore > bestScore || (totalScore === bestScore && countCompleted > bestCompleted)) {
        bestScore = totalScore;
        bestCompleted = countCompleted;
        winningSeat = s as SeatId;
      }
    }
    winner = winningSeat;
    events.push({ type: 'gameOver', winner, scores });
  }

  const nextTurn = ((state.turn + 1) % state.seats) as SeatId;

  const nextState: GrafschaftState = {
    ...state,
    turn: isOver ? state.turn : nextTurn,
    board,
    market,
    deck,
    questDeck,
    playerQuests,
    completedQuests,
    scores,
    villageScores,
    questScores,
    lastPlaced: { q: move.q, r: move.r, tile: placedTile, points: turnPoints },
    winner,
    moveCount: state.moveCount + 1,
  };

  return { state: nextState, events };
}

export function playerView(state: GrafschaftState, seat: SeatId | 'spectator'): GrafschaftState {
  const viewerSeat = seat === 'spectator' ? null : seat;

  // Maskierte Quests für gegnerische Plätze
  const playerQuests = state.playerQuests.map((qList, s) => {
    if (viewerSeat === null || s === viewerSeat) {
      return qList;
    }
    return qList.map(() => HIDDEN_QUEST);
  });

  // Maskiertes Deck
  const deck = state.deck.map(() => HIDDEN_TILE);
  const questDeck = state.questDeck.map(() => HIDDEN_QUEST);

  return {
    ...state,
    deck,
    questDeck,
    playerQuests,
  };
}

export function sampleHidden(view: GrafschaftState, seat: SeatId, rng: Rng): GrafschaftState {
  // 1. Bekannte Plättchen ermitteln
  const knownTileIds = new Set<number>();
  for (const tile of Object.values(view.board)) {
    if (tile.id > 0) knownTileIds.add(tile.id);
  }
  for (const tile of view.market) {
    if (tile.id > 0) knownTileIds.add(tile.id);
  }

  // Alle restlichen Plättchen des Standard-Decks in den geheimen Pool
  const allTiles = buildStandardDeck();
  const hiddenTiles = rng.shuffle(allTiles.filter((t) => !knownTileIds.has(t.id)));

  // Passend zur Deck-Größe auffüllen
  const deck = hiddenTiles.slice(0, view.deck.length);

  // 2. Bekannte Aufträge ermitteln
  const knownQuestIds = new Set<string>();
  for (const list of view.completedQuests) {
    for (const item of list) knownQuestIds.add(item.quest.id);
  }
  for (const quest of view.playerQuests[seat] ?? []) {
    if (quest.id !== 'hidden') knownQuestIds.add(quest.id);
  }

  const allQuests = Object.values(QUEST_CATALOG);
  const hiddenQuests = rng.shuffle(allQuests.filter((q) => !knownQuestIds.has(q.id)));

  // Verteilen auf gegnerische Hände und questDeck
  const playerQuests = view.playerQuests.map((qList, s) => {
    if (s === seat) return qList;
    return qList.map(() => hiddenQuests.pop() ?? HIDDEN_QUEST);
  });

  const questDeck = hiddenQuests.slice(0, view.questDeck.length);

  return {
    ...view,
    deck,
    questDeck,
    playerQuests,
  };
}

export function result(state: GrafschaftState): Result | null {
  if (state.market.length > 0) return null;

  let maxScore = -Infinity;
  let winners: SeatId[] = [];

  for (let s = 0; s < state.seats; s++) {
    const sc = state.scores[s] ?? 0;
    if (sc > maxScore) {
      maxScore = sc;
      winners = [s as SeatId];
    } else if (sc === maxScore) {
      winners.push(s as SeatId);
    }
  }

  if (winners.length > 1) {
    // Tie-Breaker: meiste erfüllte Aufträge
    let maxQuests = -Infinity;
    let tieBreakWinners: SeatId[] = [];
    for (const w of winners) {
      const qCount = state.completedQuests[w]?.length ?? 0;
      if (qCount > maxQuests) {
        maxQuests = qCount;
        tieBreakWinners = [w];
      } else if (qCount === maxQuests) {
        tieBreakWinners.push(w);
      }
    }
    winners = tieBreakWinners;
  }

  if (winners.length === 1) {
    return { kind: 'win', winners: [winners[0]!] };
  }
  return { kind: 'draw' };
}

export function evaluate(state: GrafschaftState, seat: SeatId): number {
  const myScore = state.scores[seat] ?? 0;
  let highestOpponent = -Infinity;
  for (let s = 0; s < state.seats; s++) {
    if (s !== seat) {
      highestOpponent = Math.max(highestOpponent, state.scores[s] ?? 0);
    }
  }
  return myScore - (highestOpponent === -Infinity ? 0 : highestOpponent);
}
