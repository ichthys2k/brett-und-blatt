import type { GameEvent, SeatId } from './types';

/**
 * Remis anbieten und annehmen – für Zwei-Personen-Spiele mit Zugwechsel (Schach, Dame).
 *
 * Wer am Zug ist, kann statt zu ziehen Remis anbieten. Dann ist der Gegner dran und kann
 * nur annehmen (die Partie endet unentschieden) oder ablehnen (der Anbieter zieht weiter).
 * Danach darf derselbe Platz erst nach `DRAW_OFFER_GAP` Halbzügen wieder anbieten – sonst
 * ließe sich der Gegner mit Angeboten aufhalten.
 *
 * „Anbieten“ steht absichtlich nicht in `legalMoves`: Bots und Zufallspartien bieten so nie
 * von selbst an, und Suchbots, die ihre Züge aus `legalMoves` holen, sehen es nicht. Das Spiel
 * lässt es über `isLegal` zu (`isDrawMoveLegal`).
 */
export type DrawMove = { type: 'offerDraw' } | { type: 'acceptDraw' } | { type: 'declineDraw' };

export interface DrawOffer {
  /** Wer gerade Remis angeboten hat (wartet auf Antwort), sonst null. */
  by: SeatId | null;
  /** Halbzug, bei dem jeder Platz zuletzt angeboten hat (-Infinity gibt es in JSON nicht, daher null). */
  last: (number | null)[];
}

/** Halbzüge, die zwischen zwei Angeboten desselben Platzes liegen müssen. */
export const DRAW_OFFER_GAP = 10;

export const noDrawOffer = (): DrawOffer => ({ by: null, last: [null, null] });

export function isDrawMove(move: unknown): move is DrawMove {
  const type = (move as { type?: unknown } | null)?.type;
  return type === 'offerDraw' || type === 'acceptDraw' || type === 'declineDraw';
}

/** Wer muss gerade auf ein Angebot antworten? */
export function drawResponder(offer: DrawOffer | undefined): SeatId | null {
  return offer?.by == null ? null : offer.by === 0 ? 1 : 0;
}

/** Darf `seat` jetzt anbieten? `turn` ist der Platz am Zug, `ply` die Zahl der gespielten Halbzüge. */
export function canOfferDraw(offer: DrawOffer | undefined, seat: SeatId, turn: SeatId, ply: number): boolean {
  if (offer?.by != null || seat !== turn) return false;
  const last = offer?.last[seat] ?? null;
  return last === null || ply - last >= DRAW_OFFER_GAP;
}

/** Antwortzüge für den Gegner, solange ein Angebot offen ist. */
export function drawResponses(offer: DrawOffer | undefined, actor: unknown): DrawMove[] {
  return actor === drawResponder(offer) ? [{ type: 'acceptDraw' }, { type: 'declineDraw' }] : [];
}

export function isDrawMoveLegal(offer: DrawOffer | undefined, actor: unknown, move: DrawMove, turn: SeatId, ply: number): boolean {
  if (move.type === 'offerDraw') return typeof actor === 'number' && canOfferDraw(offer, actor, turn, ply);
  return actor === drawResponder(offer);
}

/** Wendet einen Remis-Zug an: neues Angebot, ob die Partie damit endet, und das Ereignis dazu. */
export function applyDrawMove(offer: DrawOffer | undefined, actor: SeatId, move: DrawMove, ply: number): { offer: DrawOffer; agreed: boolean; event: GameEvent } {
  const current = offer ?? noDrawOffer();
  if (move.type === 'offerDraw') {
    const last = [...current.last];
    last[actor] = ply;
    return { offer: { by: actor, last }, agreed: false, event: { type: 'drawOffered', seat: actor } };
  }
  const agreed = move.type === 'acceptDraw';
  return { offer: { by: null, last: current.last }, agreed, event: { type: agreed ? 'drawAccepted' : 'drawDeclined', seat: actor } };
}
