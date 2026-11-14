/**
 * Kartenspiele in VR (#350, #358): Übersetzer von der Sicht eines Spiels zu dem, was der
 * Kartentisch zeigt. Keine Spielregeln – je Spiel wird nur gelesen, welche Karten wo liegen.
 * Was gespielt werden darf, sagt allein `legalMoves`; geschickt wird immer ein Eintrag daraus.
 * Ohne three.js, damit `tests/xr-karten.test.ts` die Übersetzer gegen echte Partien prüfen kann.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import brueche from '../../../../content/paare/brueche.json';
import einmaleins from '../../../../content/paare/einmaleins.json';
import englisch from '../../../../content/paare/englisch.json';
import ganzeZahlen from '../../../../content/paare/ganze-zahlen.json';
import groessen from '../../../../content/paare/groessen.json';
import grossesEinmaleins from '../../../../content/paare/grosses-einmaleins.json';
import kopfrechnen from '../../../../content/paare/kopfrechnen.json';
import teilbarkeit from '../../../../content/paare/teilbarkeit.json';
import tiere from '../../../../content/paare/tiere.json';

export const CARD_GAMES = ['mau-mau', 'uno', 'skat', 'doppelkopf', 'schafkopf', 'binokel', 'president', 'speed', 'black-peter', 'elevens', 'poker'] as const;

export function isCardGame(id: string | null | undefined): boolean {
  return (CARD_GAMES as readonly string[]).includes(id ?? '');
}

/** Wie eine Kartenseite aussieht. */
export interface Face {
  /** Großes Zeichen in der Mitte, z. B. „♥“, „7“ oder „+2“. */
  center: string;
  /** Ecke oben links, z. B. „A♥“. */
  corner: string;
  color: string;
  background: string;
}

export interface HandCard {
  id: string;
  face: Face;
}

/** Was der Kartentisch aus der Sicht braucht. */
export interface CardView {
  hand: HandCard[];
  /** Offene Stapel in der Tischmitte, jeweils die obere Karte (Ablage bei Mau-Mau, zwei Stapel bei Speed). */
  piles: (Face | null)[];
  /** Karten des laufenden Stichs mit dem Platz, der sie gespielt hat (Skat, Doppelkopf; bei Präsident mehrere). */
  trick: { seat: number; faces: Face[] }[];
  /** Offene Reihen in der Tischmitte (Elfer raus, Gemeinschaftskarten beim Poker). */
  rows: Face[][];
  /** Nachziehstapel: Anzahl verdeckter Karten. */
  stock: number;
  /** Handkarten der anderen Plätze: verdeckt als Anzahl, offen gezeigte Karten als Bilder. */
  others: { seat: number; count: number; open?: Face[] }[];
  /** Schwarzer Peter: Aus der verdeckten Hand dieses Platzes wird gezogen (Zug mit `index`). */
  drawFrom?: number;
  /** Hinweis neben der Ablage, z. B. die Wunschfarbe oder der Pot. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Französisches Blatt (Mau-Mau, Skat, Doppelkopf …): Karten-ID „S11.1“ = Farbe, Rang, Kopie

export const SUIT_SIGNS: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
const GERMAN_SUITS: Record<string, string> = { C: 'Eichel', D: 'Schellen', H: 'Herz', S: 'Grün' };
const RANKS: Record<number, string> = { 1: 'A', 11: 'B', 12: 'D', 13: 'K' };
const GERMAN_RANKS: Record<number, string> = { 1: 'Ass', 11: 'Unter', 12: 'Ober', 13: 'König' };

function suitColor(suit: string, deck: string): string {
  if (deck === 'french') return suit === 'H' || suit === 'D' ? '#b3261e' : '#1d1510';
  if (deck === 'simple') return { C: '#1f5fbf', D: '#c99a12', H: '#b3261e', S: '#2f7d32' }[suit] ?? '#1d1510';
  if (deck === 'german' || deck === 'bavarian') return { C: '#6b4728', D: '#c99a12', H: '#b3261e', S: '#2f7d32' }[suit] ?? '#1d1510';
  // Turnierblatt: Kreuz schwarz, Pik grün, Herz rot, Karo gelb
  return { C: '#1d1510', D: '#c99a12', H: '#b3261e', S: '#2f7d32' }[suit] ?? '#1d1510';
}

export function frenchFace(card: string, deck = 'four-color'): Face | null {
  if (/^(JK|JOKER)/.test(card)) return { center: '🃏', corner: 'J', color: '#7b2fa8', background: '#fbf5e6' };
  if (!/^[CDHS]\d+\./.test(card)) return null;
  const suit = card[0]!;
  const rank = Number(card.slice(1, card.indexOf('.')));
  const color = suitColor(suit, deck);
  if (deck === 'german' || deck === 'bavarian') {
    const r = GERMAN_RANKS[rank] ?? String(rank);
    return { center: GERMAN_SUITS[suit] ?? suit, corner: r, color, background: '#fbf5e6' };
  }
  const r = RANKS[rank] ?? String(rank);
  return { center: `${r}${SUIT_SIGNS[suit]}`, corner: `${r}${SUIT_SIGNS[suit]}`, color, background: '#fbf5e6' };
}

function faces(cards: readonly (string | null | undefined)[], deck?: string): HandCard[] {
  return cards.flatMap((id) => {
    const face = id ? frenchFace(id, deck) : null;
    return face && id ? [{ id, face }] : [];
  });
}

function openFaces(cards: readonly (string | null | undefined)[], deck?: string): Face[] {
  return faces(cards, deck).map((c) => c.face);
}

// ---------------------------------------------------------------------------
// Eins!-Karten: Objekt mit Vorder- und Rückseite (Flip)

const UNO_COLORS: Record<string, string> = {
  red: '#c62828',
  yellow: '#e0b000',
  green: '#2e7d32',
  blue: '#1e5bb8',
  orange: '#e06a00',
  teal: '#0d8478',
  purple: '#7b2fa8',
  pink: '#c2347a',
  wild: '#1d1510',
};
const UNO_SIGNS: Record<string, string> = {
  skip: '⊘',
  reverse: '⇄',
  draw1: '+1',
  draw2: '+2',
  draw6: '+6',
  draw10: '+10',
  skipAll: '⊘⊘',
  wild: '★',
  wildDraw4: '★+4',
  wildDraw6: '★+6',
  wildDraw10: '★+10',
  wildReverseDraw4: '⇄+4',
  flip: '↻',
  flipDraw5: '↻+5',
  wildDrawColor: '★?',
  roulette: '🎲',
  wildSkip: '★⊘',
  wildSkipAll: '★⊘⊘',
  wildTargetDraw2: '★🎯2',
  wildSwap: '★⇆',
};

interface UnoCard {
  id: string;
  front: { color: string; type: string };
  back?: { color: string; type: string };
}

function unoFace(card: UnoCard, side: string): Face {
  const face = side === 'dark' && card.back ? card.back : card.front;
  const sign = UNO_SIGNS[face.type] ?? face.type;
  return { center: sign, corner: sign, color: '#fbf5e6', background: UNO_COLORS[face.color] ?? '#1d1510' };
}

// ---------------------------------------------------------------------------
// Elfer raus: „r11“ = Farbe (r, y, g, b) und Zahl 1–20

const ELEVENS_COLORS: Record<string, string> = { r: '#c62828', y: '#d9a400', g: '#2e7d32', b: '#1e5bb8' };

function elevensFace(card: string): Face | null {
  const color = ELEVENS_COLORS[card[0] ?? ''];
  if (!color || !/^\d+$/.test(card.slice(1))) return null;
  return { center: card.slice(1), corner: card.slice(1), color: '#fbf5e6', background: color };
}

// ---------------------------------------------------------------------------
// Schwarzer Peter: Paare aus den Inhaltspaketen, der Peter ist eine schwarze Katze

const PAIR_SETS: Record<string, { pairs: { a: string; b: string }[] }> = {
  tiere,
  einmaleins,
  'grosses-einmaleins': grossesEinmaleins,
  kopfrechnen,
  groessen,
  teilbarkeit,
  brueche,
  'ganze-zahlen': ganzeZahlen,
  englisch,
};

export function peterFace(set: string, card: { pair: number; side: 'a' | 'b' }): Face {
  const text = card.pair < 0 ? '🐈‍⬛' : (PAIR_SETS[set]?.pairs[card.pair]?.[card.side] ?? '?');
  return { center: text, corner: '', color: '#1d1510', background: card.pair < 0 ? '#e9d7b0' : '#fbf5e6' };
}

// ---------------------------------------------------------------------------
// Übersetzer je Spiel

/** Die anderen Plätze mit ihrer Kartenzahl. */
function othersOf(game: GameMessage, count: (seat: number) => number, seats?: number[]): CardView['others'] {
  return (seats ?? game.seats.map((_, i) => i)).filter((s) => s !== game.yourSeat).map((seat) => ({ seat, count: count(seat) }));
}

function trickOf(cards: { player: number; card: string }[] | undefined, deck?: string): CardView['trick'] {
  return (cards ?? []).flatMap((p) => {
    const face = frenchFace(p.card, deck);
    return face ? [{ seat: p.player, faces: [face] }] : [];
  });
}

const EMPTY: Omit<CardView, 'hand'> = { piles: [], trick: [], rows: [], stock: 0, others: [] };

export function readCardView(game: GameMessage): CardView | null {
  const me = game.yourSeat;
  const view = game.view as Record<string, unknown>;
  switch (game.gameId) {
    case 'mau-mau': {
      const v = view as { hands: string[][]; discard: string[]; stock: string[]; activeSuit?: string; options?: { deckStyle?: string } };
      const deck = v.options?.deckStyle ?? 'four-color';
      const top = v.discard[v.discard.length - 1];
      return {
        ...EMPTY,
        hand: me === null ? [] : faces(v.hands[me] ?? [], deck),
        piles: [top ? frenchFace(top, deck) : null],
        stock: v.stock.length,
        others: othersOf(game, (s) => v.hands[s]?.length ?? 0),
        note: v.activeSuit && top && v.activeSuit !== top[0] ? `Wunschfarbe ${SUIT_SIGNS[v.activeSuit] ?? v.activeSuit}` : undefined,
      };
    }
    case 'uno': {
      const v = view as { hands: UnoCard[][]; discard: UnoCard[]; stock: unknown[]; activeSide: string; activeColor: string };
      const top = v.discard[v.discard.length - 1];
      return {
        ...EMPTY,
        hand: me === null ? [] : (v.hands[me] ?? []).map((c) => ({ id: c.id, face: unoFace(c, v.activeSide) })),
        piles: [top ? unoFace(top, v.activeSide) : null],
        stock: v.stock.length,
        others: othersOf(game, (s) => v.hands[s]?.length ?? 0),
        note: top && (top.front.color === 'wild' || (v.activeSide === 'dark' && top.back?.color === 'wild')) ? `Farbe: ${v.activeColor}` : undefined,
      };
    }
    case 'skat': {
      const v = view as { hands: Record<number, string[]>; currentTrick: { player: number; card: string }[]; deckStyle?: string; activeSeats: number[] };
      const deck = v.deckStyle ?? 'four-color';
      return {
        ...EMPTY,
        hand: me === null ? [] : faces(v.hands[me] ?? [], deck),
        trick: trickOf(v.currentTrick, deck),
        others: othersOf(game, (s) => v.hands[s]?.length ?? 0, v.activeSeats),
      };
    }
    case 'doppelkopf':
    case 'schafkopf': {
      const v = view as { hands: Record<string, string[]>; currentTrick: { player: number; card: string }[]; deckStyle?: string; activeSeats?: number[] };
      const deck = v.deckStyle ?? 'four-color';
      const seats = [...new Set(v.activeSeats ?? game.seats.map((_, i) => i))];
      return {
        ...EMPTY,
        hand: me === null ? [] : faces(v.hands[me] ?? [], deck),
        trick: trickOf(v.currentTrick, deck),
        others: othersOf(game, (s) => v.hands[s]?.length ?? 0, seats),
      };
    }
    case 'binokel': {
      const v = view as { hands: (string | null)[][]; currentTrick: { player: number; card: string }[]; deckStyle?: string; active?: number[]; trump?: string | null; dabb?: unknown[]; phase?: string };
      const deck = v.deckStyle ?? 'four-color';
      return {
        ...EMPTY,
        hand: me === null ? [] : faces(v.hands[me] ?? [], deck),
        trick: trickOf(v.currentTrick, deck),
        stock: v.phase === 'bidding' ? (v.dabb?.length ?? 0) : 0,
        others: othersOf(game, (s) => v.hands[s]?.length ?? 0, v.active),
        note: v.trump ? `Trumpf ${GERMAN_SUITS[v.trump] ?? v.trump}` : undefined,
      };
    }
    case 'president': {
      const v = view as { hands: string[][]; counts: number[]; trick: { seat: number; cards: string[] }[]; options?: { deckStyle?: string } };
      const deck = v.options?.deckStyle ?? 'four-color';
      const last = v.trick[v.trick.length - 1];
      return {
        ...EMPTY,
        hand: me === null ? [] : faces(v.hands[me] ?? [], deck),
        trick: last ? [{ seat: last.seat, faces: openFaces(last.cards, deck) }] : [],
        others: othersOf(game, (s) => v.counts[s] ?? 0),
      };
    }
    case 'speed': {
      const v = view as { piles: string[][]; deckStyle?: string; players: { hand: string[]; drawCount: number }[] };
      const deck = v.deckStyle ?? 'four-color';
      return {
        ...EMPTY,
        hand: me === null ? [] : faces(v.players[me]?.hand ?? [], deck),
        piles: v.piles.map((pile) => (pile.length ? frenchFace(pile[pile.length - 1]!, deck) : null)),
        stock: me === null ? 0 : (v.players[me]?.drawCount ?? 0),
        others: othersOf(game, (s) => v.players[s]?.hand.length ?? 0),
      };
    }
    case 'black-peter': {
      const v = view as { set: string; hands: ({ pair: number; side: 'a' | 'b' } | null)[][]; turn: number };
      // Gezogen wird beim nächsten Platz, der noch Karten hat (steht so auch im Zugtext).
      let drawFrom: number | undefined;
      if (game.legalMoves.some((m) => (m as { type?: string }).type === 'draw')) {
        for (let k = 1; k < v.hands.length; k++) {
          const seat = (v.turn + k) % v.hands.length;
          if ((v.hands[seat]?.length ?? 0) > 0) {
            drawFrom = seat;
            break;
          }
        }
      }
      return {
        ...EMPTY,
        hand: me === null ? [] : (v.hands[me] ?? []).flatMap((c, i) => (c ? [{ id: `peter-${i}`, face: peterFace(v.set, c) }] : [])),
        others: othersOf(game, (s) => v.hands[s]?.length ?? 0),
        drawFrom,
      };
    }
    case 'elevens': {
      const v = view as { hands: string[][]; stock: unknown[]; rows: Record<string, { low: number; high: number } | null> };
      const rows = ['r', 'y', 'g', 'b'].flatMap((color) => {
        const row = v.rows[color];
        if (!row) return [];
        const cards = row.low === row.high ? [row.low] : [row.low, row.high];
        return [cards.map((n) => elevensFace(`${color}${n}`)!)];
      });
      return {
        ...EMPTY,
        hand: me === null ? [] : (v.hands[me] ?? []).flatMap((id) => {
          const face = elevensFace(id);
          return face ? [{ id, face }] : [];
        }),
        rows,
        stock: v.stock.length,
        others: othersOf(game, (s) => v.hands[s]?.length ?? 0),
      };
    }
    case 'poker': {
      const v = view as { deckStyle?: string; board: string[]; seats: { seat: number; chips: number; inHand: boolean; folded: boolean; holeCards: string[]; holeCardCount: number; totalCommitted: number }[] };
      const deck = v.deckStyle ?? 'four-color';
      const mine = v.seats.find((s) => s.seat === me);
      const pot = v.seats.reduce((sum, s) => sum + s.totalCommitted, 0);
      return {
        ...EMPTY,
        hand: mine ? faces(mine.holeCards, deck) : [],
        rows: v.board.length ? [openFaces(v.board, deck)] : [],
        others: v.seats
          .filter((s) => s.seat !== me && s.inHand && !s.folded)
          .map((s) => ({ seat: s.seat, count: s.holeCards.length ? 0 : s.holeCardCount, open: openFaces(s.holeCards, deck) })),
        note: `Pot ${pot}${mine ? ` · Chips ${mine.chips}` : ''}`,
      };
    }
  }
  return null;
}

/** Welche Handkarten ein Zug ausspielt (leer, wenn der Zug keine Handkarte nutzt). */
export function cardsOfMove(move: unknown): string[] {
  const m = move as { type?: string; cardId?: string; card?: string; cards?: string[] };
  if (!['play', 'jumpIn', 'discard', 'give'].includes(m.type ?? '')) return [];
  if (typeof m.cardId === 'string') return [m.cardId];
  if (typeof m.card === 'string') return [m.card];
  if (Array.isArray(m.cards) && m.cards.every((c) => typeof c === 'string')) return m.cards;
  return [];
}

/** Züge, die der Kartentisch selbst anbietet: Karten ausspielen, drücken, abgeben, vom Stapel oder aus fremder Hand ziehen. */
export function cardMoveIndexes(moves: unknown[]): Set<number> {
  const handled = new Set<number>();
  moves.forEach((m, i) => {
    const type = (m as { type?: string }).type;
    if (cardsOfMove(m).length > 0 || type === 'draw') handled.add(i);
  });
  return handled;
}

// ---------------------------------------------------------------------------
// Kartenflug (#366): Aus zwei aufeinanderfolgenden Sichten ergibt sich, woher eine neue Karte kam.

/** Wo eine Karte losfliegt. */
export type Origin = { kind: 'hand'; index: number; count: number } | { kind: 'seat'; seat: number } | { kind: 'stock' };

export interface Flights {
  /** Neue Runde: Die Karten kommen alle vom Stapel. */
  deal: boolean;
  /** Je Ablage: Herkunft der neuen oberen Karte (null: unverändert oder unbekannt). */
  piles: (Origin | null)[];
  /** Je Reihe und Karte. */
  rows: (Origin | null)[][];
  /** Parallel zu `view.trick`. */
  trick: (Origin | null)[];
  /** Neue Karten der eigenen Hand nach Karten-ID. */
  handDraws: Record<string, Origin>;
  /** Je Platz: Zahl der neu in die Hand gekommenen (äußersten) Karten. */
  otherDraws: Record<number, number>;
}

export const NO_FLIGHTS: Flights = { deal: false, piles: [], rows: [], trick: [], handDraws: {}, otherDraws: {} };

const faceKey = (face: Face | null | undefined): string => (face ? `${face.corner}|${face.center}|${face.color}` : '');

/**
 * Vergleicht die vorige mit der neuen Sicht. `deal`: Neue Runde, alles kommt vom Stapel.
 * Wer eine Karte gespielt hat, ergibt sich daraus, wessen Hand kleiner wurde; bei mehreren
 * gleichzeitig (Speed) bleibt die Herkunft unbekannt und die Karte erscheint ohne Flug.
 */
export function diffFlights(prev: CardView | null, next: CardView, opts: { mySeat: number | null; deal: boolean }): Flights {
  if (opts.deal) {
    return {
      ...NO_FLIGHTS,
      deal: true,
      handDraws: Object.fromEntries(next.hand.map((c) => [c.id, { kind: 'stock' } as Origin])),
      otherDraws: Object.fromEntries(next.others.map((o) => [o.seat, o.count])),
    };
  }
  if (!prev) return NO_FLIGHTS;

  const nextIds = new Set(next.hand.map((c) => c.id));
  const prevIds = new Set(prev.hand.map((c) => c.id));
  const missing = prev.hand.map((c, index) => ({ id: c.id, index })).filter((x) => !nextIds.has(x.id));
  const movers: Origin[] = [];
  if (missing.length > 0) movers.push({ kind: 'hand', index: missing[0]!.index, count: prev.hand.length });
  for (const o of next.others) {
    const before = prev.others.find((p) => p.seat === o.seat);
    if (before && o.count < before.count) movers.push({ kind: 'seat', seat: o.seat });
  }
  const mover = movers.length === 1 ? movers[0]! : null;

  const piles = next.piles.map((face, k) => (face && faceKey(face) !== faceKey(prev.piles[k]) ? mover : null));
  const rows = next.rows.map((row, r) => {
    const before = new Set((prev.rows[r] ?? []).map(faceKey));
    return row.map((face) => (before.has(faceKey(face)) ? null : mover));
  });
  const trick = next.trick.map((t) => {
    const sameBefore = prev.trick.some((p) => p.seat === t.seat && p.faces.map(faceKey).join() === t.faces.map(faceKey).join());
    if (sameBefore) return null;
    if (t.seat === opts.mySeat) return mover?.kind === 'hand' ? mover : ({ kind: 'seat', seat: t.seat } as Origin);
    return { kind: 'seat', seat: t.seat } as Origin;
  });
  const handDraws: Record<string, Origin> = {};
  for (const c of next.hand) if (!prevIds.has(c.id)) handDraws[c.id] = { kind: 'stock' };
  const otherDraws: Record<number, number> = {};
  for (const o of next.others) {
    const before = prev.others.find((p) => p.seat === o.seat);
    if (before && o.count > before.count) otherDraws[o.seat] = o.count - before.count;
  }
  return { deal: false, piles, rows, trick, handDraws, otherDraws };
}
