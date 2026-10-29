import { Rng, type Actor, type GameEvent, type MoveResult } from '@brett-und-blatt/engine';
import { buildAllWildDeck } from './decks/allWild';
import { buildClassicDeck } from './decks/classic';
import { buildFlipDeck } from './decks/flip';
import { buildJuniorDeck } from './decks/junior';
import { buildNoMercyDeck } from './decks/noMercy';
import {
  DARK_COLORS,
  LIGHT_COLORS,
  type CardFace,
  type UnoCard,
  type UnoColor,
  type UnoMove,
  type UnoOptions,
  type UnoState,
} from './types';

/** Standard-Optionen für Eins! */
export const defaultOptions: UnoOptions = {
  variant: 'classic',
  stacking: 'same',
  sevenZero: 'off',
  jumpIn: 'off',
  drawRule: 'one',
  callUno: 'on',
  mercyLimit: 0,
  mathLabels: 'off',
};

/** Aufgaben-Pool (Klasse 5/6: Kopfrechnen, Potenzen, Brüche, Dezimalzahlen) für Zahlenkarten 0–9. */
export const UNO_MATH_POOL: Record<string, readonly string[]> = {
  '0': ['0 · 9', '7 − 7', '0 : 5', '12 − 3·4', '0/8', '5 − 5', '2³ − 8', '0 · 15'],
  '1': ['9 : 9', '4/4', '10⁰', '15 − 14', '7/7', '2³ − 7', '0,5 + 0,5', '18 : 18'],
  '2': ['14 : 7', '6/3', '1,5 + 0,5', '20 : 10', '11 − 9', '1/2 · 4', '18 : 9', '8/4'],
  '3': ['21 : 7', '9/3', '12 : 4', '2,5 + 0,5', '27 : 9', '15 − 12', '1/3 · 9', '24 : 8'],
  '4': ['2²', '28 : 7', '12/3', '3,2 + 0,8', '36 : 9', '20 : 5', '1/2 · 8', '16 : 4'],
  '5': ['35 : 7', '15/3', '2,5 · 2', '45 : 9', '20 : 4', '13 − 8', '1/2 · 10', '30 : 6'],
  '6': ['42 : 7', '2 · 3', '18 : 3', '54 : 9', '24 : 4', '4,5 + 1,5', '3/4 · 8', '12/2'],
  '7': ['49 : 7', '21 : 3', '63 : 9', '15 − 8', '3,5 · 2', '28 : 4', '14/2', '4,2 + 2,8'],
  '8': ['2³', '56 : 7', '72 : 9', '24 : 3', '32 : 4', '16/2', '6,4 + 1,6', '4 · 2'],
  '9': ['3²', '63 : 7', '81 : 9', '27 : 3', '36 : 4', '18/2', '4,5 · 2', '15 − 6'],
};

/** Liefert für eine Zahlenkarte (0–9) deterministisch anhand der Karten-ID einen Rechenterm. */
export function mathCardLabel(type: string, cardId: string): string | null {
  const pool = UNO_MATH_POOL[type];
  if (!pool || pool.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 31 + cardId.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length]!;
}

/** Holt die sichtbare Kartenseite (Vorderseite oder Rückseite bei Flip Dark). */
export function getActiveFace(card: UnoCard, side: 'light' | 'dark'): CardFace {
  if (side === 'dark' && card.back) {
    return card.back;
  }
  return card.front;
}

/** Ermittelt die nächste aktive Spielerposition unter Berücksichtigung von Richtung und Ausgeschiedenen. */
export function getNextPlayer(current: number, direction: 1 | -1, total: number, eliminated: boolean[], steps = 1): number {
  let pos = current;
  let remainingSteps = steps;
  while (remainingSteps > 0) {
    pos = (pos + direction + total) % total;
    if (!eliminated[pos]) {
      remainingSteps--;
    }
    // Sicherheitsabbruch bei vollständiger Eliminierung
    if (pos === current && eliminated.filter((e) => !e).length <= 1) {
      return pos;
    }
  }
  return pos;
}

/** Prüft, ob zwei Karten identisch sind (für Jump-In). */
export function isIdenticalCard(a: UnoCard, b: UnoCard, side: 'light' | 'dark'): boolean {
  const fa = getActiveFace(a, side);
  const fb = getActiveFace(b, side);
  return fa.color === fb.color && fa.type === fb.type;
}

/** Prüft, ob eine Karte auf die aktuelle Ablage gelegt werden darf. */
export function canPlayCard(card: UnoCard, topCard: UnoCard, activeColor: UnoColor, side: 'light' | 'dark'): boolean {
  const face = getActiveFace(card, side);
  const topFace = getActiveFace(topCard, side);

  // Joker darf immer gespielt werden
  if (face.color === 'wild') return true;

  // Passende Farbe zur aktiven Wunschfarbe
  if (face.color === activeColor) return true;

  // Gleicher Wert / Typ wie die oberste Karte
  if (face.type === topFace.type) return true;

  return false;
}

/** Prüft, ob eine Karte auf einen bestehenden Strafkarten-Stapel gestapelt werden darf. */
export function canStackCard(card: UnoCard, topCard: UnoCard, side: 'light' | 'dark', mode: 'same' | 'progressive'): boolean {
  const face = getActiveFace(card, side);
  const topFace = getActiveFace(topCard, side);

  if (mode === 'same') {
    return face.type === topFace.type;
  }

  // Progressive: gleiche oder höhere Ziehstrafe
  const rank: Record<string, number> = {
    draw1: 1,
    draw2: 2,
    wildDraw4: 4,
    flipDraw5: 5,
    draw6: 6,
    wildDraw6: 6,
    draw10: 10,
    wildDraw10: 10,
  };

  const topRank = rank[topFace.type] ?? 0;
  const cardRank = rank[face.type] ?? 0;
  return cardRank > 0 && cardRank >= topRank;
}

/** Mischt den Ablagestapel (bis auf die oberste Karte) neu in den Nachziehstapel. */
function recycleDiscards(state: UnoState, rng: Rng): void {
  if (state.discard.length <= 1) return;
  const top = state.discard[state.discard.length - 1];
  const rest = state.discard.slice(0, -1);
  state.discard = [top];
  state.stock.push(...rng.shuffle(rest));
}

/** Zieht eine Karte vom Nachziehstapel. */
function drawCard(state: UnoState, rng?: Rng): UnoCard | undefined {
  if (state.stock.length === 0 && rng) {
    recycleDiscards(state, rng);
  }
  return state.stock.pop();
}

/** Initialisiert eine Partie Eins! */
export function setup(seats: number, rng: Rng, optionsPartial: Partial<UnoOptions> = {}): UnoState {
  const variant = optionsPartial.variant ?? defaultOptions.variant;
  const options: UnoOptions = {
    ...defaultOptions,
    ...optionsPartial,
    variant,
    // No-Mercy Standards
    mercyLimit: variant === 'no-mercy' ? (optionsPartial.mercyLimit ?? 25) : (optionsPartial.mercyLimit ?? 0),
    stacking: variant === 'no-mercy' ? (optionsPartial.stacking ?? 'progressive') : (optionsPartial.stacking ?? defaultOptions.stacking),
    sevenZero: variant === 'no-mercy' ? (optionsPartial.sevenZero ?? 'on') : (optionsPartial.sevenZero ?? defaultOptions.sevenZero),
  };

  let deck: UnoCard[];
  switch (variant) {
    case 'no-mercy':
      deck = buildNoMercyDeck();
      break;
    case 'flip':
      deck = buildFlipDeck();
      break;
    case 'all-wild':
      deck = buildAllWildDeck();
      break;
    case 'junior':
      deck = buildJuniorDeck();
      break;
    case 'classic':
    default:
      deck = buildClassicDeck();
      break;
  }

  deck = rng.shuffle(deck);

  // 7 Karten an jeden Spieler austeilen
  const hands: UnoCard[][] = Array.from({ length: seats }, () => []);
  for (let i = 0; i < 7; i++) {
    for (let s = 0; s < seats; s++) {
      const c = deck.pop();
      if (c) hands[s].push(c);
    }
  }

  // Erste offene Karte für den Ablagestapel aufdecken (keine +4, +6, +10 oder Roulette als Startkarte)
  let startCard = deck.pop()!;
  while (['wildDraw4', 'wildDraw6', 'wildDraw10', 'draw6', 'draw10', 'roulette'].includes(startCard.front.type)) {
    deck.unshift(startCard);
    startCard = deck.pop()!;
  }

  const activeColor = startCard.front.color === 'wild' ? 'red' : startCard.front.color;

  return {
    options,
    hands,
    stock: deck,
    discard: [startCard],
    activeColor,
    activeSide: 'light',
    direction: 1,
    turn: 0,
    pendingDraw: 0,
    hasDrawn: false,
    unoProtection: Array.from({ length: seats }, () => false),
    eliminated: Array.from({ length: seats }, () => false),
    rng: rng.state,
    winner: null,
  };
}

/** Liefert die aktiven Spieler (wer ist am Zug oder darf zwischenwerfen). */
export function currentPlayers(state: UnoState): number[] {
  if (state.winner !== null) return [];

  const players = [state.turn];

  // Bei Jump-In dürfen auch andere Spieler mit exakt gleicher Karte aktiv werden
  if (state.options.jumpIn === 'on' && state.pendingDraw === 0 && state.discard.length > 0) {
    const top = state.discard[state.discard.length - 1];
    for (let s = 0; s < state.hands.length; s++) {
      if (s === state.turn || state.eliminated[s]) continue;
      if (state.hands[s].some((c) => isIdenticalCard(c, top, state.activeSide))) {
        players.push(s);
      }
    }
  }

  return players;
}

/** Prüft, ob ein Zug unter den aktuellen Spielregeln erlaubt ist. */
export function isLegal(state: UnoState, actor: Actor, move: UnoMove): boolean {
  if (typeof actor !== 'number' || state.winner !== null || state.eliminated[actor]) return false;

  const topCard = state.discard[state.discard.length - 1];
  const hand = state.hands[actor];
  if (!hand) return false;
  const side = state.activeSide;
  const isTurn = actor === state.turn;

  if (move.type === 'draw') {
    if (!isTurn) return false;
    return state.pendingDraw > 0 || !state.hasDrawn;
  }

  if (move.type === 'pass') {
    if (!isTurn) return false;
    return state.hasDrawn && state.pendingDraw === 0;
  }

  if (move.type === 'catchUno') {
    if (state.options.callUno !== 'on') return false;
    const target = move.target;
    return (
      typeof target === 'number' &&
      target >= 0 &&
      target < state.hands.length &&
      !state.eliminated[target] &&
      state.hands[target].length === 1 &&
      !state.unoProtection[target]
    );
  }

  if (move.type === 'callUno') {
    if (state.options.callUno !== 'on') return false;
    if (state.eliminated[actor]) return false;
    const hand = state.hands[actor];
    if (!hand) return false;
    return hand.length === 1 && !state.unoProtection[actor];
  }

  if (move.type === 'jumpIn') {
    if (state.options.jumpIn !== 'on' || state.pendingDraw > 0 || !topCard) return false;
    const card = hand.find((c) => c.id === move.cardId);
    if (!card) return false;
    return isIdenticalCard(card, topCard, side);
  }

  if (move.type === 'play') {
    if (!isTurn) return false;
    const card = hand.find((c) => c.id === move.cardId);
    if (!card) return false;
    const face = getActiveFace(card, side);

    if (state.pendingDraw > 0) {
      if (state.options.stacking === 'off') return false;
      if (!canStackCard(card, topCard, side, state.options.stacking)) return false;
    } else {
      if (!canPlayCard(card, topCard, state.activeColor, side)) return false;
    }

    if (face.color === 'wild') {
      const validColors: readonly UnoColor[] = side === 'dark' ? DARK_COLORS : LIGHT_COLORS;
      if (!move.chosenColor || !validColors.includes(move.chosenColor)) return false;
    }

    if (face.type === '7' && state.options.sevenZero === 'on') {
      const otherSeats = state.hands
        .map((_, idx) => idx)
        .filter((idx) => idx !== actor && !state.eliminated[idx]);
      if (otherSeats.length > 0) {
        const target = move.targetPlayer;
        if (typeof target !== 'number' || !otherSeats.includes(target)) return false;
      }
    }

    return true;
  }

  return false;
}

/** Ermittelt alle legalen Züge für einen bestimmten Spieler. */
export function legalMoves(state: UnoState, actor: number): UnoMove[] {
  if (state.winner !== null || state.eliminated[actor]) return [];

  const moves: UnoMove[] = [];
  const topCard = state.discard[state.discard.length - 1];
  const hand = state.hands[actor];
  const side = state.activeSide;
  const isTurn = actor === state.turn;
  const willHaveOne = hand.length === 2;

  const pushPlay = (base: { cardId: string; chosenColor?: UnoColor; targetPlayer?: number }) => {
    if (willHaveOne) {
      moves.push({ type: 'play', ...base, callUno: true });
    } else {
      moves.push({ type: 'play', ...base });
    }
  };

  // 1. Jump-In außerhalb der Reihe
  if (!isTurn) {
    if (state.options.jumpIn === 'on' && state.pendingDraw === 0 && topCard) {
      for (const card of hand) {
        if (isIdenticalCard(card, topCard, side)) {
          if (willHaveOne) {
            moves.push({ type: 'jumpIn', cardId: card.id, callUno: true });
          } else {
            moves.push({ type: 'jumpIn', cardId: card.id });
          }
        }
      }
    }
    return moves;
  }

  // 2. Anprangern eines Gegners mit 1 Karte, der nicht "Eins!" gerufen hat
  if (state.options.callUno === 'on') {
    for (let s = 0; s < state.hands.length; s++) {
      if (!state.eliminated[s] && state.hands[s].length === 1 && !state.unoProtection[s]) {
        moves.push({ type: 'catchUno', target: s });
      }
    }
  }

  // 3. Wenn Strafkarten im Stapel ausstehen (pendingDraw > 0)
  if (state.pendingDraw > 0) {
    if (state.options.stacking !== 'off') {
      for (const card of hand) {
        if (canStackCard(card, topCard, side, state.options.stacking)) {
          const face = getActiveFace(card, side);

          if (face.color === 'wild') {
            const colors = side === 'dark' ? DARK_COLORS : LIGHT_COLORS;
            for (const col of colors) {
              pushPlay({ cardId: card.id, chosenColor: col });
            }
          } else {
            pushPlay({ cardId: card.id });
          }
        }
      }
    }

    // Wenn man nicht stapeln kann (oder will), muss man die Strafkarten ziehen
    moves.push({ type: 'draw' });
    return moves;
  }

  // 4. Regulärer Zug: Karten anlegen
  for (const card of hand) {
    if (canPlayCard(card, topCard, state.activeColor, side)) {
      const face = getActiveFace(card, side);

      // 7er-Handtausch bei Option sevenZero
      if (face.type === '7' && state.options.sevenZero === 'on') {
        const otherSeats = state.hands
          .map((_, idx) => idx)
          .filter((idx) => idx !== actor && !state.eliminated[idx]);
        for (const target of otherSeats) {
          pushPlay({ cardId: card.id, targetPlayer: target });
        }
        continue;
      }

      // Farbwahl bei Jokern
      if (face.color === 'wild') {
        const colors = side === 'dark' ? DARK_COLORS : LIGHT_COLORS;
        for (const col of colors) {
          pushPlay({ cardId: card.id, chosenColor: col });
        }
      } else {
        pushPlay({ cardId: card.id });
      }
    }
  }

  // 5. Nachziehen oder Passen
  if (!state.hasDrawn) {
    moves.push({ type: 'draw' });
  } else {
    // Nach dem Ziehen darf gepasst werden
    moves.push({ type: 'pass' });
  }

  return moves;
}

/** Wendet einen Zug auf den Zustand an und erzeugt Ereignisse. */
export function applyMove(
  state: UnoState,
  actor: number,
  move: UnoMove,
): MoveResult<UnoState> {
  if (!isLegal(state, actor, move)) {
    throw new Error('Dieser Zug ist nicht erlaubt.');
  }
  const next = JSON.parse(JSON.stringify(state)) as UnoState;
  const rng = new Rng(next.rng);
  const events: GameEvent[] = [];
  const side = next.activeSide;
  const total = next.hands.length;

  const finish = () => {
    next.rng = rng.state;
    return { state: next, events };
  };

  // Helfer: Strafkarten an einen Spieler austeilen
  const giveCards = (target: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const card = drawCard(next, rng);
      if (card) next.hands[target].push(card);
    }
    // Mercy-Regel prüfen
    if (next.options.mercyLimit > 0 && next.hands[target].length >= next.options.mercyLimit) {
      next.eliminated[target] = true;
      events.push({ type: 'eliminated', player: target, reason: 'mercy' });
      // Gewinner prüfen, falls nur noch einer übrig ist
      const remaining = next.eliminated.map((el, i) => (el ? null : i)).filter((p) => p !== null);
      if (remaining.length === 1) {
        next.winner = remaining[0]!;
      }
    }
  };

  // 0. Eigenen „Eins!“-Ruf nachträglich abgeben (auch außer der Reihe).
  if (move.type === 'callUno') {
    if (next.hands[actor].length === 1 && !next.unoProtection[actor]) {
      next.unoProtection[actor] = true;
      events.push({ type: 'calledUno', player: actor });
      next.lastAction = { player: actor, text: 'Eins! gerufen' };
    }
    return finish();
  }

  // 1. Anprangern (catchUno)
  if (move.type === 'catchUno') {
    const target = move.target;
    if (next.hands[target].length === 1 && !next.unoProtection[target]) {
      giveCards(target, 2);
      next.unoProtection[target] = true; // Jetzt geschützt
      events.push({ type: 'caughtUno', actor, target });
      next.lastAction = {
        player: actor,
        text: `Ertappt! +2 Strafkarten an Spieler ${target + 1}`,
        target,
      };
    }
    return finish();
  }

  // 2. Nachziehen (draw)
  if (move.type === 'draw') {
    // Falls ein Strafstapel aktiv ist (z. B. +2, +4)
    if (next.pendingDraw > 0) {
      const count = next.pendingDraw;
      giveCards(actor, count);
      events.push({ type: 'drewPenalty', player: actor, count });
      next.lastAction = {
        player: actor,
        text: `+${count} Strafkarten gezogen`,
      };
      next.pendingDraw = 0;
      next.hasDrawn = false;
      next.turn = getNextPlayer(actor, next.direction, total, next.eliminated);
      return finish();
    }

    // Reguläres Ziehen
    const card = drawCard(next, rng);
    if (card) {
      next.hands[actor].push(card);
      events.push({ type: 'drewCard', player: actor });
      next.lastAction = {
        player: actor,
        text: 'Karte gezogen',
      };
    }

    if (next.options.drawRule === 'one') {
      next.hasDrawn = true;
      // Prüfen, ob die gezogene Karte gelegt werden kann
      const top = next.discard[next.discard.length - 1];
      if (!card || !canPlayCard(card, top, next.activeColor, side)) {
        // Nicht legbar -> Zug geht automatisch weiter
        next.hasDrawn = false;
        next.turn = getNextPlayer(actor, next.direction, total, next.eliminated);
      }
    } else {
      // untilMatch / upToThree
      const top = next.discard[next.discard.length - 1];
      if (card && canPlayCard(card, top, next.activeColor, side)) {
        next.hasDrawn = true;
      } else {
        next.turn = getNextPlayer(actor, next.direction, total, next.eliminated);
      }
    }

    return finish();
  }

  // 3. Passen (pass)
  if (move.type === 'pass') {
    next.hasDrawn = false;
    next.turn = getNextPlayer(actor, next.direction, total, next.eliminated);
    next.lastAction = {
      player: actor,
      text: 'Gepasst',
    };
    return finish();
  }

  // 4. Karte spielen (play oder jumpIn)
  if (move.type === 'play' || move.type === 'jumpIn') {
    const cardIndex = next.hands[actor].findIndex((c) => c.id === move.cardId);
    if (cardIndex === -1) return finish();

    const [card] = next.hands[actor].splice(cardIndex, 1);
    next.discard.push(card);
    const face = getActiveFace(card, side);

    events.push({
      type: 'cardPlayed',
      player: actor,
      card,
      jumpIn: move.type === 'jumpIn',
    });

    next.lastAction = {
      player: actor,
      text: move.type === 'jumpIn' ? 'Jump-In gelegt' : 'Karte gelegt',
      card,
      ...(move.type === 'play' && move.targetPlayer !== undefined ? { target: move.targetPlayer } : {}),
    };

    // "Eins!"-Schutz verwalten
    if (next.hands[actor].length === 1) {
      next.unoProtection[actor] = !!move.callUno;
      if (move.callUno) {
        events.push({ type: 'calledUno', player: actor });
      }
    } else {
      next.unoProtection[actor] = false;
    }

    // Siegbedingung: Hand leer
    if (next.hands[actor].length === 0) {
      next.winner = actor;
      events.push({ type: 'win', winner: actor });
      return finish();
    }

    // Aktive Farbe aktualisieren
    if (face.color === 'wild') {
      next.activeColor = move.chosenColor ?? (side === 'dark' ? 'orange' : 'red');
    } else {
      next.activeColor = face.color;
    }

    next.hasDrawn = false;

    // Sonderkarten auswerten
    let stepCount = 1;

    switch (face.type) {
      case 'skip':
        stepCount = 2;
        events.push({ type: 'skip', player: getNextPlayer(actor, next.direction, total, next.eliminated, 1) });
        break;

      case 'skipAll':
        // Niemand anders kommt dran; Spieler bleibt am Zug
        stepCount = 0;
        events.push({ type: 'skipAll', player: actor });
        break;

      case 'reverse':
        if (total === 2) {
          // Zu zweit wirkt Richtungswechsel wie Aussetzen
          stepCount = 2;
        } else {
          next.direction = (next.direction * -1) as 1 | -1;
          stepCount = 1;
        }
        events.push({ type: 'reverse', direction: next.direction });
        break;

      case 'draw1':
        if (next.options.stacking !== 'off') {
          next.pendingDraw += 1;
        } else {
          const victim = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
          giveCards(victim, 1);
          stepCount = 2; // Überspringen
        }
        break;

      case 'draw2':
        if (next.options.stacking !== 'off') {
          next.pendingDraw += 2;
        } else {
          const victim = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
          giveCards(victim, 2);
          stepCount = 2;
        }
        break;

      case 'wildDraw4':
        if (next.options.stacking !== 'off') {
          next.pendingDraw += 4;
        } else {
          const victim = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
          giveCards(victim, 4);
          stepCount = 2;
        }
        break;

      case 'flipDraw5':
        if (next.options.stacking !== 'off') {
          next.pendingDraw += 5;
        } else {
          const victim = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
          giveCards(victim, 5);
          stepCount = 2;
        }
        break;

      case 'draw6':
      case 'wildDraw6':
        if (next.options.stacking !== 'off') {
          next.pendingDraw += 6;
        } else {
          const victim = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
          giveCards(victim, 6);
          stepCount = 2;
        }
        break;

      case 'draw10':
      case 'wildDraw10':
        if (next.options.stacking !== 'off') {
          next.pendingDraw += 10;
        } else {
          const victim = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
          giveCards(victim, 10);
          stepCount = 2;
        }
        break;

      case 'flip':
        // Wenden: Helle Seite <-> Dunkle Seite
        next.activeSide = next.activeSide === 'light' ? 'dark' : 'light';
        // Aktive Wunschfarbe auf das Pendant der anderen Seite spiegeln
        if (next.activeSide === 'dark') {
          const map: Record<string, UnoColor> = { red: 'orange', yellow: 'teal', green: 'purple', blue: 'pink' };
          next.activeColor = map[next.activeColor] ?? 'orange';
        } else {
          const map: Record<string, UnoColor> = { orange: 'red', teal: 'yellow', purple: 'green', pink: 'blue' };
          next.activeColor = map[next.activeColor] ?? 'red';
        }
        events.push({ type: 'flip', side: next.activeSide });
        break;

      case 'roulette': {
        // Nächster Spieler muss so lange ziehen, bis er die gewählte Farbe zieht
        const victim = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
        let drawn: UnoCard | undefined;
        let drawnCount = 0;
        do {
          drawn = drawCard(next, rng);
          if (drawn) {
            next.hands[victim].push(drawn);
            drawnCount++;
          }
        } while (drawn && getActiveFace(drawn, side).color !== next.activeColor && drawnCount < 15);
        events.push({ type: 'roulette', victim, drawnCount });
        stepCount = 2;
        break;
      }

      case '7':
        if (move.type === 'play' && next.options.sevenZero === 'on' && move.targetPlayer !== undefined && !next.eliminated[move.targetPlayer]) {
          const target = move.targetPlayer;
          const temp = next.hands[actor];
          next.hands[actor] = next.hands[target];
          next.hands[target] = temp;
          events.push({ type: 'swapHands', player1: actor, player2: target });
        }
        break;

      case '0':
        if (next.options.sevenZero === 'on') {
          // Alle Hände rotieren um 1 in Spielrichtung
          const oldHands = [...next.hands];
          for (let i = 0; i < total; i++) {
            if (!next.eliminated[i]) {
              const src = getNextPlayer(i, (next.direction * -1) as 1 | -1, total, next.eliminated, 1);
              next.hands[i] = oldHands[src];
            }
          }
          events.push({ type: 'rotateHands', direction: next.direction });
        }
        break;

      default:
        break;
    }

    if (move.type === 'jumpIn') {
      // Beim Jump-In geht das Spiel ab dem Einwerfer weiter!
      next.turn = getNextPlayer(actor, next.direction, total, next.eliminated, 1);
    } else if (stepCount > 0) {
      next.turn = getNextPlayer(actor, next.direction, total, next.eliminated, stepCount);
    }

    return finish();
  }

  return finish();
}

/** Füllt verborgene Informationen (fremde Hände und Nachziehstapel) für Bot-Simulationen auf. */
export function sampleHidden(view: UnoState, seat: number | 'spectator', rng: Rng): UnoState {
  const next = JSON.parse(JSON.stringify(view)) as UnoState;
  const targetSeat = typeof seat === 'number' ? seat : -1;

  // Bekannte Karten sammeln: Eigene Hand und Ablagestapel
  const knownCardIds = new Set<string>();
  if (targetSeat >= 0 && next.hands[targetSeat]) {
    for (const c of next.hands[targetSeat]) knownCardIds.add(c.id);
  }
  for (const c of next.discard) knownCardIds.add(c.id);

  // Vollständiges Deck der gewählten Variante erzeugen
  let fullDeck: UnoCard[];
  switch (next.options.variant) {
    case 'no-mercy':
      fullDeck = buildNoMercyDeck();
      break;
    case 'flip':
      fullDeck = buildFlipDeck();
      break;
    case 'all-wild':
      fullDeck = buildAllWildDeck();
      break;
    case 'junior':
      fullDeck = buildJuniorDeck();
      break;
    case 'classic':
    default:
      fullDeck = buildClassicDeck();
      break;
  }

  // Unbekannte Karten mischen
  const pool = rng.shuffle(fullDeck.filter((c) => !knownCardIds.has(c.id)));

  // Auf fremde Hände verteilen
  // Jede Karte passend zu dem, was man von ihr sieht (bei Flip die sichtbare Seite).
  const looks = (c: UnoCard, s: number, i: number) => JSON.stringify([maskCard(c, next.activeSide, s, i).front, maskCard(c, next.activeSide, s, i).back]);
  for (let s = 0; s < next.hands.length; s++) {
    if (s === targetSeat || next.winner !== null) continue;
    const seen = next.hands[s];
    next.hands[s] = [];
    for (let i = 0; i < seen.length; i++) {
      const wanted = JSON.stringify([seen[i]!.front, seen[i]!.back]);
      let at = -1;
      for (let k = pool.length - 1; k >= 0; k--) {
        if (looks(pool[k]!, s, i) === wanted) {
          at = k;
          break;
        }
      }
      const [c] = pool.splice(at >= 0 ? at : pool.length - 1, 1);
      if (c) next.hands[s].push(c);
    }
  }

  // Restlicher Pool wird zum Nachziehstapel
  next.stock = pool;
  next.rng = rng.state;
  return next;
}

/** Wie eine fremde Handkarte für die anderen aussieht (bei Flip bleibt die sichtbare Seite). */
function maskCard(c: UnoCard, side: UnoState['activeSide'], seat: number, index: number): UnoCard {
  return {
    id: `verdeckt-${seat}-${index}`,
    front: side === 'dark' ? { color: 'wild', type: 'wild' } : (c.back ?? { color: 'wild', type: 'wild' }),
    back: side === 'light' ? (c.back ?? { color: 'wild', type: 'wild' }) : { color: 'wild', type: 'wild' },
  } as UnoCard;
}

/** Sicht eines Spielers: verbirgt verdeckte Handkarten der Mitspieler. */
export function playerView(state: UnoState, seat: number | 'spectator'): UnoState {
  const isOver = state.winner !== null;
  const side = state.activeSide;

  return {
    ...state,
    rng: [0, 0, 0, 0],
    hands: state.hands.map((hand, idx) => {
      if (idx === seat || isOver) {
        return hand;
      }
      // Für Mitspieler: Karteninfo verbergen, aber bei Flip die Rückseite sichtbar lassen.
      // Auch die Kennung wird ersetzt: Sie wird vor dem Mischen fortlaufend vergeben und
      // verriete sonst, welche Karte es ist.
      return hand.map((c, i) => maskCard(c, side, idx, i));
    }),
    stock: Array.from({ length: state.stock.length }, (_, i) => ({
      id: `stock_${i}`,
      front: { color: 'wild', type: 'wild' },
    })),
  };
}

/** Ermittelt das Spielergebnis. */
export function result(state: UnoState): { kind: 'win'; winners: [number] } | null {
  if (state.winner !== null) {
    return { kind: 'win', winners: [state.winner] };
  }
  return null;
}
