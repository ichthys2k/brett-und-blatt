import {
  Rng,
  type Actor,
  type GameEvent,
  type MoveResult,
  type Options,
  type Result,
  type RngState,
  type SeatId,
} from '@brett-und-blatt/engine';

/** Länge des Rundkurses auf dem klassischen Kreuzbrett (bis 4 Spieler). */
export const TRACK_LENGTH = 40;
/** Felder je Arm auf dem Sechser-Brett: 4 hinaus, die Spitze, 4 zurück. */
export const SIX_ARM_LENGTH = 9;
/** Länge des Rundkurses auf dem Sechser-Brett (6 Arme). */
export const SIX_TRACK_LENGTH = 6 * SIX_ARM_LENGTH;
export const PIECES_PER_PLAYER = 4;
export const GOAL_LENGTH = 4;
export const MAX_SEATS = 6;

/** Spielbrett: klassisches Kreuz für bis zu 4 Spieler oder sechsarmiger Stern für bis zu 6. */
export type Board = 'classic' | 'six';

/** Länge des Rundkurses auf einem Brett. */
export function trackLengthOf(board: Board = 'classic'): number {
  return board === 'six' ? SIX_TRACK_LENGTH : TRACK_LENGTH;
}

/**
 * Welcher Arm des Sechser-Bretts zu welchem Platz gehört. Bei weniger als sechs Spielern
 * bleiben Arme frei, und zwar so, dass die Spieler möglichst gleich weit auseinander sitzen.
 */
const SIX_ARMS: Record<number, readonly number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
};

/** Arm des Sechser-Bretts für einen Platz (0..5). */
export function armOf(seat: SeatId, seats: number): number {
  return (SIX_ARMS[seats] ?? SIX_ARMS[6])[seat] ?? seat;
}

export type Area = 'home' | 'track' | 'goal';

export interface PiecePosition {
  area: Area;
  /**
   * Bei 'home': 0..3 (Stallplatz)
   * Bei 'track': relativer Schritt vom eigenen Startfeld (0..39, auf dem Sechser-Brett 0..53)
   * Bei 'goal': 0..3 (Zielfeld a..d)
   */
  index: number;
}

export type Phase = 'roll' | 'move';

export interface LudoState {
  seats: number;
  turn: SeatId;
  phase: Phase;
  dice: number | null;
  rollsLeft: number;
  canRollAgain: boolean;
  pieces: PiecePosition[][]; // [seat][pieceIndex 0..3]
  mandatoryCapture: boolean;
  threeRollsRule: 'empty_track' | 'never';
  enterRule: 'six' | 'six_or_one';
  exactGoal: boolean;
  /** Spielbrett; fehlt in Partien vor `ruleVersion` 3 und gilt dann als klassisch. */
  board?: Board;
  /**
   * Der letzte Wurf, nach dem der Zug ohne Ziehen weiterging (alle Versuche ohne passenden Zug).
   * Die Oberfläche zeigt ihn klein in der Farbe dessen, der gewürfelt hat – `dice` ist dann schon leer,
   * damit der Wurf nicht beim nächsten Spieler zu liegen scheint.
   */
  lastRoll?: { seat: SeatId; dice: number } | null;
  history: string[];
  rng: RngState;
}

export type LudoMove =
  | { type: 'roll' }
  | { type: 'move'; pieceIndex: number }
  | { type: 'pass' };

/**
 * Gibt den absoluten Track-Index des Startfelds für einen Sitzplatz zurück.
 * Bei 2 Spielern sitzen sich Gelb (0) und Rot (2) gegenüber. Auf dem Sechser-Brett liegt das
 * Startfeld gleich hinter der Spitze des eigenen Arms.
 */
export function startTrackIndex(seat: SeatId, seats: number, board: Board = 'classic'): number {
  if (board === 'six') {
    return armOf(seat, seats) * SIX_ARM_LENGTH + 5;
  }
  if (seats === 2) {
    return seat === 0 ? 0 : 20;
  }
  return (seat * 10) % TRACK_LENGTH;
}

/**
 * Gibt den Farb-Index (0: Gelb, 1: Grün, 2: Rot, 3: Blau, 4: Lila, 5: Türkis) zurück.
 * Die Farbe hängt nur vom Platz ab, nicht vom Brett.
 */
export function colorIndex(seat: SeatId, seats: number): number {
  if (seats === 2) {
    return seat === 0 ? 0 : 2;
  }
  return seat % MAX_SEATS;
}

/**
 * Wandelt einen relativen Schritt in den absoluten Streckenindex um.
 */
export function toAbsoluteTrackIndex(seat: SeatId, step: number, seats: number, board: Board = 'classic'): number {
  return (startTrackIndex(seat, seats, board) + step) % trackLengthOf(board);
}

/**
 * Ermittelt, ob ein Spieler Steine auf der eigentlichen Laufstrecke hat.
 */
export function hasPiecesOnTrack(pieces: PiecePosition[]): boolean {
  return pieces.some((p) => p.area === 'track');
}

/**
 * Berechnet, wie viele Würfe einem Spieler zu Beginn seines Zugs zustehen.
 */
export function maxRollsForSeat(state: Pick<LudoState, 'pieces' | 'threeRollsRule'>, seat: SeatId): number {
  if (state.threeRollsRule === 'never') return 1;
  const playerPieces = state.pieces[seat];
  if (!playerPieces) return 1;
  // Wenn kein Stein auf der Laufstrecke steht (alle im Stall oder im Ziel), hat man 3 Versuche
  return hasPiecesOnTrack(playerPieces) ? 1 : 3;
}

export function setup(seats: number, options: Options, seed: string): LudoState {
  const safeSeats = Math.max(2, Math.min(MAX_SEATS, Number(seats) || 4));
  // Ab fünf Spielern immer das Sechser-Brett, sonst nur auf Wunsch.
  const board: Board = safeSeats > 4 || options.board === 'six' ? 'six' : 'classic';
  const mandatoryCapture = options.capture === 'on';
  const threeRollsRule = options.threeRolls === 'never' ? 'never' : 'empty_track';
  const enterRule = options.enterRule === 'six_or_one' ? 'six_or_one' : 'six';
  const exactGoal = options.exactGoal !== 'off';

  const pieces: PiecePosition[][] = Array.from({ length: safeSeats }, () =>
    Array.from({ length: PIECES_PER_PLAYER }, (_, slot) => ({ area: 'home' as Area, index: slot })),
  );

  const initialRng = Rng.fromSeed(seed, 'ludo-dice').state;

  const initialState: LudoState = {
    seats: safeSeats,
    turn: 0,
    phase: 'roll',
    dice: null,
    rollsLeft: 3, // Initial alle im Stall -> 3 Versuche
    canRollAgain: false,
    pieces,
    mandatoryCapture,
    threeRollsRule,
    enterRule,
    exactGoal,
    board,
    lastRoll: null,
    history: [],
    rng: initialRng,
  };

  initialState.rollsLeft = maxRollsForSeat(initialState, 0);
  return initialState;
}

export function currentPlayers(state: LudoState): Actor[] {
  return result(state) ? [] : [state.turn];
}

/**
 * Prüft, ob ein Würfelwert zum Herauskommen aus dem Stall berechtigt.
 */
export function isEnterRoll(dice: number, rule: 'six' | 'six_or_one'): boolean {
  return dice === 6 || (rule === 'six_or_one' && dice === 1);
}

/**
 * Prüft, ob ein Zielschritt für eine Figur auf der Strecke oder im Ziel legal ist.
 */
function canMovePiece(
  piece: PiecePosition,
  dice: number,
  playerPieces: PiecePosition[],
  exactGoal: boolean,
  trackLength: number,
): boolean {
  if (piece.area === 'home') {
    return false; // Aus dem Haus zieht man nur über die Einzugslogik
  }

  if (piece.area === 'track') {
    const nextStep = piece.index + dice;
    if (nextStep < trackLength) {
      // Noch auf der Strecke: darf nicht auf eigenem Stein landen
      const ownOccupied = playerPieces.some((p) => p.area === 'track' && p.index === nextStep);
      return !ownOccupied;
    }

    // Einbiegen ins Ziel
    const goalSlot = nextStep - trackLength;
    if (goalSlot >= GOAL_LENGTH) {
      // Überschießen
      return !exactGoal;
    }

    // Zielfeld darf nicht von eigener Figur besetzt sein
    const slotOccupied = playerPieces.some((p) => p.area === 'goal' && p.index === goalSlot);
    if (slotOccupied) return false;

    if (exactGoal) {
      // Figuren im Ziel dürfen nicht übersprungen werden
      const jumping = playerPieces.some(
        (p) => p.area === 'goal' && p.index < goalSlot,
      );
      // Beim Einbiegen von der Strecke darf kein besetztes Feld überquert werden
      for (let s = 0; s < goalSlot; s++) {
        if (playerPieces.some((p) => p.area === 'goal' && p.index === s)) {
          return false;
        }
      }
    }
    return true;
  }

  if (piece.area === 'goal') {
    const nextSlot = piece.index + dice;
    if (nextSlot >= GOAL_LENGTH) {
      return !exactGoal;
    }
    const slotOccupied = playerPieces.some((p) => p.area === 'goal' && p.index === nextSlot);
    if (slotOccupied) return false;

    if (exactGoal) {
      for (let s = piece.index + 1; s <= nextSlot; s++) {
        if (playerPieces.some((p) => p.area === 'goal' && p.index === s)) {
          return false;
        }
      }
    }
    return true;
  }

  return false;
}

/**
 * Ermittelt, ob ein Zug einen gegnerischen Stein schlägt.
 */
function doesCapture(
  pieceIndex: number,
  state: LudoState,
  seat: SeatId,
  dice: number,
): boolean {
  const piece = state.pieces[seat][pieceIndex];
  if (!piece) return false;

  let targetAbs: number | null = null;
  if (piece.area === 'home') {
    if (isEnterRoll(dice, state.enterRule)) {
      targetAbs = startTrackIndex(seat, state.seats, state.board);
    }
  } else if (piece.area === 'track') {
    const nextStep = piece.index + dice;
    if (nextStep < trackLengthOf(state.board)) {
      targetAbs = toAbsoluteTrackIndex(seat, nextStep, state.seats, state.board);
    }
  }

  if (targetAbs === null) return false;

  // Prüfen, ob ein gegnerischer Stein auf targetAbs steht
  for (let otherSeat = 0; otherSeat < state.seats; otherSeat++) {
    if (otherSeat === seat) continue;
    for (const otherPiece of state.pieces[otherSeat]) {
      if (otherPiece.area === 'track') {
        const otherAbs = toAbsoluteTrackIndex(otherSeat, otherPiece.index, state.seats, state.board);
        if (otherAbs === targetAbs) return true;
      }
    }
  }

  return false;
}

export function legalMoves(state: LudoState, actor: Actor): LudoMove[] {
  if (actor !== state.turn || result(state) !== null) return [];

  if (state.phase === 'roll') {
    return [{ type: 'roll' }];
  }

  const dice = state.dice;
  if (dice === null) return [];

  const seat = state.turn;
  const playerPieces = state.pieces[seat];
  const homePiecesIndices: number[] = [];
  const trackPiecesIndices: number[] = [];
  const goalPiecesIndices: number[] = [];

  playerPieces.forEach((p, idx) => {
    if (p.area === 'home') homePiecesIndices.push(idx);
    else if (p.area === 'track') trackPiecesIndices.push(idx);
    else if (p.area === 'goal') goalPiecesIndices.push(idx);
  });

  const pieceOnStartField = playerPieces.findIndex(
    (p) => p.area === 'track' && p.index === 0,
  );

  const canEnter = isEnterRoll(dice, state.enterRule) && homePiecesIndices.length > 0;

  // Vorrangregel 1 & 2: Startfeld freimachen oder herausziehen bei 6
  if (canEnter) {
    if (pieceOnStartField !== -1) {
      // Eigenes Startfeld ist durch eigene Figur belegt -> diese Figur MUSS ziehen, um Platz zu machen!
      if (canMovePiece(playerPieces[pieceOnStartField], dice, playerPieces, state.exactGoal, trackLengthOf(state.board))) {
        return [{ type: 'move', pieceIndex: pieceOnStartField }];
      }
    } else {
      // Startfeld ist frei oder gegnerisch belegt -> eine Figur aus dem Stall MUSS herausgezogen werden!
      // Alle Figuren im Haus sind gleichwertig; wir bieten die erste an
      return [{ type: 'move', pieceIndex: homePiecesIndices[0] }];
    }
  }

  // Alle regulär möglichen Züge sammeln
  const possibleMoves: number[] = [];

  playerPieces.forEach((p, idx) => {
    if (canMovePiece(p, dice, playerPieces, state.exactGoal, trackLengthOf(state.board))) {
      possibleMoves.push(idx);
    }
  });

  if (possibleMoves.length === 0) {
    return [{ type: 'pass' }];
  }

  // Vorrangregel 3: Schlagpflicht
  if (state.mandatoryCapture) {
    const capturingMoves = possibleMoves.filter((idx) => doesCapture(idx, state, seat, dice));
    if (capturingMoves.length > 0) {
      return capturingMoves.map((pieceIndex) => ({ type: 'move', pieceIndex }));
    }
  }

  return possibleMoves.map((pieceIndex) => ({ type: 'move', pieceIndex }));
}

export function applyMove(state: LudoState, actor: Actor, move: LudoMove): MoveResult<LudoState> {
  if (actor !== state.turn || result(state) !== null) {
    throw new Error('Ungültiger Spieler am Zug');
  }

  const events: GameEvent[] = [];

  if (move.type === 'roll') {
    if (state.phase !== 'roll') {
      throw new Error('Würfeln in dieser Phase nicht erlaubt');
    }

    const rng = new Rng(state.rng);
    const dice = rng.int(6) + 1;
    const newRngState = rng.state;

    events.push({ type: 'rolled', seat: state.turn, dice });

    const rollsLeft = state.rollsLeft - 1;
    const isEnter = isEnterRoll(dice, state.enterRule);
    const earnedBonusRoll = dice === 6;

    // Temporärer State, um zu sehen, ob Züge möglich sind
    const probeState: LudoState = {
      ...state,
      dice,
      phase: 'move',
      rng: newRngState,
    };

    const moves = legalMoves(probeState, state.turn);
    const canMove = moves.length > 0 && moves[0].type === 'move';

    if (canMove) {
      // Spieler darf ziehen
      const nextState: LudoState = {
        ...state,
        phase: 'move',
        dice,
        rollsLeft: 0,
        canRollAgain: earnedBonusRoll,
        lastRoll: null,
        rng: newRngState,
      };
      return { state: nextState, events };
    }

    // Kein Zug möglich
    if (rollsLeft > 0) {
      // Noch Versuche übrig
      const nextState: LudoState = {
        ...state,
        phase: 'roll',
        dice,
        rollsLeft,
        canRollAgain: false,
        lastRoll: null,
        rng: newRngState,
      };
      return { state: nextState, events };
    }

    // Keine Züge und keine Würfe übrig -> Zugwechsel
    const nextSeat = ((state.turn + 1) % state.seats) as SeatId;
    const nextState: LudoState = {
      ...state,
      turn: nextSeat,
      phase: 'roll',
      dice: null,
      rollsLeft: maxRollsForSeat(state, nextSeat),
      canRollAgain: false,
      lastRoll: { seat: state.turn, dice },
      rng: newRngState,
    };
    events.push({ type: 'turnChanged', previousSeat: state.turn, nextSeat });
    return { state: nextState, events };
  }

  if (move.type === 'pass') {
    if (state.phase !== 'move') {
      throw new Error('Passen nur in der Zugphase möglich');
    }
    const nextSeat = ((state.turn + 1) % state.seats) as SeatId;
    const nextState: LudoState = {
      ...state,
      turn: nextSeat,
      phase: 'roll',
      dice: null,
      rollsLeft: maxRollsForSeat(state, nextSeat),
      canRollAgain: false,
    };
    events.push({ type: 'turnChanged', previousSeat: state.turn, nextSeat });
    return { state: nextState, events };
  }

  if (move.type === 'move') {
    if (state.phase !== 'move' || state.dice === null) {
      throw new Error('Zug nicht erlaubt');
    }

    const seat = state.turn;
    const dice = state.dice;
    const pieceIdx = move.pieceIndex;
    const currentPiece = state.pieces[seat][pieceIdx];

    if (!currentPiece) {
      throw new Error('Ungültiger Figurenindex');
    }

    // Tiefe Kopie der Spielfiguren
    const newPieces: PiecePosition[][] = state.pieces.map((row) => row.map((p) => ({ ...p })));
    const targetPiece = newPieces[seat][pieceIdx];

    if (targetPiece.area === 'home') {
      // Aus dem Haus auf Startfeld setzen
      targetPiece.area = 'track';
      targetPiece.index = 0;
      const startAbs = startTrackIndex(seat, state.seats, state.board);
      events.push({ type: 'entered', seat, pieceIndex: pieceIdx, trackIndex: startAbs });

      // Gegner auf dem Startfeld schlagen
      for (let otherSeat = 0; otherSeat < state.seats; otherSeat++) {
        if (otherSeat === seat) continue;
        for (let oIdx = 0; oIdx < newPieces[otherSeat].length; oIdx++) {
          const other = newPieces[otherSeat][oIdx];
          if (other.area === 'track') {
            const otherAbs = toAbsoluteTrackIndex(otherSeat, other.index, state.seats, state.board);
            if (otherAbs === startAbs) {
              other.area = 'home';
              other.index = oIdx;
              events.push({
                type: 'captured',
                seat,
                pieceIndex: pieceIdx,
                capturedSeat: otherSeat,
                capturedPieceIndex: oIdx,
                trackIndex: startAbs,
              });
            }
          }
        }
      }
    } else if (targetPiece.area === 'track') {
      const nextStep = targetPiece.index + dice;
      if (nextStep < trackLengthOf(state.board)) {
        // Auf der Laufstrecke weiterziehen
        const targetAbs = toAbsoluteTrackIndex(seat, nextStep, state.seats, state.board);
        targetPiece.index = nextStep;
        events.push({ type: 'moved', seat, pieceIndex: pieceIdx, fromStep: currentPiece.index, toStep: nextStep });

        // Gegner auf Zielfeld schlagen
        for (let otherSeat = 0; otherSeat < state.seats; otherSeat++) {
          if (otherSeat === seat) continue;
          for (let oIdx = 0; oIdx < newPieces[otherSeat].length; oIdx++) {
            const other = newPieces[otherSeat][oIdx];
            if (other.area === 'track') {
              const otherAbs = toAbsoluteTrackIndex(otherSeat, other.index, state.seats, state.board);
              if (otherAbs === targetAbs) {
                other.area = 'home';
                other.index = oIdx;
                events.push({
                  type: 'captured',
                  seat,
                  pieceIndex: pieceIdx,
                  capturedSeat: otherSeat,
                  capturedPieceIndex: oIdx,
                  trackIndex: targetAbs,
                });
              }
            }
          }
        }
      } else {
        // Einzug ins Ziel
        const goalSlot = Math.min(GOAL_LENGTH - 1, nextStep - trackLengthOf(state.board));
        targetPiece.area = 'goal';
        targetPiece.index = goalSlot;
        events.push({
          type: 'goalEntered',
          seat,
          pieceIndex: pieceIdx,
          fromStep: currentPiece.index,
          goalSlot,
        });
      }
    } else if (targetPiece.area === 'goal') {
      const nextSlot = Math.min(GOAL_LENGTH - 1, targetPiece.index + dice);
      const fromSlot = targetPiece.index;
      targetPiece.index = nextSlot;
      events.push({
        type: 'goalMoved',
        seat,
        pieceIndex: pieceIdx,
        fromSlot,
        toSlot: nextSlot,
      });
    }

    // Siegprüfung
    const allInGoal = newPieces[seat].every((p) => p.area === 'goal');
    if (allInGoal) {
      events.push({ type: 'win', winners: [seat] });
      const nextState: LudoState = {
        ...state,
        pieces: newPieces,
        dice: null,
      };
      return { state: nextState, events };
    }

    // Nachspielprüfung: Wurde eine 6 gewürfelt (canRollAgain)?
    if (state.canRollAgain) {
      events.push({ type: 'extraRoll', seat });
      const nextState: LudoState = {
        ...state,
        pieces: newPieces,
        phase: 'roll',
        dice: null,
        rollsLeft: 1,
        canRollAgain: false,
      };
      return { state: nextState, events };
    }

    // Nächster Spieler ist dran
    const nextSeat = ((state.turn + 1) % state.seats) as SeatId;
    const nextState: LudoState = {
      ...state,
      turn: nextSeat,
      pieces: newPieces,
      phase: 'roll',
      dice: null,
      rollsLeft: maxRollsForSeat({ pieces: newPieces, threeRollsRule: state.threeRollsRule }, nextSeat),
      canRollAgain: false,
    };
    events.push({ type: 'turnChanged', previousSeat: state.turn, nextSeat });
    return { state: nextState, events };
  }

  throw new Error('Unbekannter Zugtyp');
}

export function result(state: LudoState): Result | null {
  for (let s = 0; s < state.seats; s++) {
    if (state.pieces[s].every((p) => p.area === 'goal')) {
      return { kind: 'win', winners: [s] };
    }
  }
  return null;
}

export function playerView(state: LudoState): LudoState {
  // Alle Informationen auf dem Brett sind offen, lediglich der Zufalls-Seed wird nicht an Clients gesendet
  return {
    ...state,
    rng: [0, 0, 0, 0],
  };
}

export function timeoutMove(state: LudoState, seat: SeatId): LudoMove {
  if (state.phase === 'roll') {
    return { type: 'roll' };
  }
  const moves = legalMoves(state, seat);
  return moves[0] ?? { type: 'pass' };
}
