import { canOfferDraw, drawResponder, isDrawMove, type DrawMove, type DrawOffer, type SeatId } from '@brett-und-blatt/engine';

export interface DrawOfferBarProps<M> {
  offer: DrawOffer | undefined;
  /** Erlaubte Züge am Gerät (aus `BoardProps`): enthält Annehmen/Ablehnen, wenn man antworten muss. */
  legalMoves: M[];
  onMove: (move: M) => void;
  /** Platz am Zug auf dem Brett und Zahl der gespielten Halbzüge. */
  turn: SeatId;
  ply: number;
  seatNames: string[];
  ended: boolean;
}

/**
 * Leiste für Remis-Angebote (Schach, Dame; siehe `draw-offer.ts` in der Engine): „Remis anbieten“
 * für den Menschen am Zug, „Annehmen/Ablehnen“ für den Gegner, sonst ein Hinweis, dass ein
 * Angebot offen ist. Gibt es nichts zu tun, bleibt eine leere Zeile gleicher Höhe stehen –
 * so springt das Brett nicht bei jedem Zugwechsel.
 */
export function DrawOfferBar<M>({ offer, legalMoves, onMove, turn, ply, seatNames, ended }: DrawOfferBarProps<M>) {
  const empty = <div className="bub-draw bub-draw-quiet" aria-hidden="true" />;
  if (ended) return empty;
  const move = (m: DrawMove) => onMove(m as M);
  const responder = drawResponder(offer);
  if (responder !== null && offer?.by != null) {
    const canAnswer = legalMoves.some((m) => isDrawMove(m));
    const offerer = seatNames[offer.by] ?? `Platz ${offer.by + 1}`;
    return (
      <div className="bub-draw" role="status">
        <span>½ {offerer} bietet Remis an{canAnswer ? '.' : ' – warte auf Antwort …'}</span>
        {canAnswer && (
          <span className="bub-draw-actions">
            <button type="button" className="bub-draw-yes" onClick={() => move({ type: 'acceptDraw' })}>
              Annehmen
            </button>
            <button type="button" onClick={() => move({ type: 'declineDraw' })}>
              Ablehnen
            </button>
          </span>
        )}
      </div>
    );
  }
  // Gerade abgelehnt: Das letzte Angebot des Platzes am Zug stammt von diesem Halbzug.
  if (offer?.last[turn] === ply) {
    return (
      <div className="bub-draw bub-draw-quiet" role="status">
        ½ Remis abgelehnt – die Partie geht weiter.
      </div>
    );
  }
  // Anbieten nur, wer am Gerät am Zug ist – dann gibt es Brettzüge.
  if (legalMoves.length === 0 || !canOfferDraw(offer, turn, turn, ply)) return empty;
  return (
    <div className="bub-draw bub-draw-quiet">
      <button type="button" onClick={() => move({ type: 'offerDraw' })} title="Der Gegner kann annehmen (unentschieden) oder ablehnen">
        ½ Remis anbieten
      </button>
    </div>
  );
}
