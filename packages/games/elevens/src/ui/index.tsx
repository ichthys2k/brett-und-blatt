import type { SeatId } from '@brett-und-blatt/engine';
import { SeatRing, CardFan, useLatestEvent, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import {
  COLORS,
  HIDDEN,
  HIGHEST,
  LOWEST,
  cardId,
  colorOf,
  valueOf,
  type CardId,
  type Color,
  type ElevensMove,
  type ElevensState,
} from '../rules';
import './styles.css';

const COLOR_NAMES: Record<Color, string> = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau' };
const SEAT_SYMBOLS = ['①', '②', '③', '④', '⑤', '⑥'];
const VALUES = Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => LOWEST + i);

/** Breite der Handkarten nach verfügbarem Platz. */
const handCardWidth = (containerWidth: number) => Math.round(Math.min(78, Math.max(52, containerWidth * 0.17), Math.max(44, window.innerHeight * 0.13)));

function cardLabel(card: CardId): string {
  return `${COLOR_NAMES[colorOf(card)]} ${valueOf(card)}`;
}

/** Eine Zahlenkarte: Farbe als Fläche, Zahl groß in der Mitte und klein in der Ecke. */
function NumberCard({ card }: { card: CardId | null }) {
  if (!card || card === HIDDEN) return <div className="elv-card elv-card-back" aria-hidden="true" />;
  const value = valueOf(card);
  return (
    <div className={`elv-card elv-c-${colorOf(card)}`} aria-label={cardLabel(card)}>
      <span className="elv-card-corner">{value}</span>
      <span className="elv-card-value">{value}</span>
    </div>
  );
}

function Board({ view, legalMoves, onMove, events, viewer, seatNames, hint, table }: BoardProps<ElevensState, ElevensMove>) {
  const mySeat = typeof viewer === 'number' ? viewer : null;
  const hand = mySeat !== null ? (view.hands[mySeat] ?? []) : [];
  const playable = new Set(
    legalMoves.flatMap((m) => (m.type === 'play' ? [m.card] : [])),
  );
  const canDraw = legalMoves.some((m) => m.type === 'draw');
  const canEnd = legalMoves.some((m) => m.type === 'end');
  const hintCard = hint?.type === 'play' ? hint.card : null;
  const lastPlayed = useLatestEvent(events, (event) => event.type === 'cardPlayed').event as { card?: CardId } | null;

  const myTurn = mySeat !== null && view.turn === mySeat && view.winner === null;
  const drawLabel =
    view.drawLimit === 'match' ? 'Ziehen' : `Ziehen (${view.drawn + 1}/${view.drawLimit})`;

  let status: string;
  if (view.winner !== null) status = `${seatNames[view.winner] ?? `Platz ${view.winner + 1}`} hat keine Karten mehr!`;
  else if (!myTurn) status = `${seatNames[view.turn] ?? `Platz ${view.turn + 1}`} ist dran.`;
  else if (view.opening) status = `Du beginnst mit der ${cardLabel(view.opening).replace(/ 11$/, 'en Elf')}.`;
  else if (playable.size > 0) status = view.played > 0 ? 'Weitere Karten anlegen oder „Fertig“.' : 'Lege eine passende Karte an.';
  else if (canDraw) status = 'Nichts passt – zieh eine Karte.';
  else status = 'Nichts passt mehr – gib weiter.';

  const center = (
    <>
      <div className="elv-others">
        <div className="elv-stock" title="Karten im Stapel">
          🂠 {view.stock.length} im Stapel
        </div>
      </div>

      <div className="elv-rows" role="grid" aria-label="Ausgelegte Reihen">
        {COLORS.map((color) => {
          const row = view.rows[color];
          return (
            <div key={color} className="elv-row" role="row" aria-label={`${COLOR_NAMES[color]}: ${row ? `${row.low} bis ${row.high}` : 'noch leer'}`}>
              {VALUES.map((value) => {
                const card = cardId(color, value);
                const laid = row !== null && value >= row.low && value <= row.high;
                const target = playable.has(card);
                const fresh = laid && lastPlayed?.card === card;
                return (
                  <button
                    key={value}
                    type="button"
                    role="gridcell"
                    disabled={!target}
                    onClick={target ? () => onMove({ type: 'play', card }) : undefined}
                    className={[
                      'elv-cell',
                      `elv-c-${color}`,
                      laid ? 'elv-cell-laid' : '',
                      value === 11 ? 'elv-cell-eleven' : '',
                      target ? 'elv-cell-target' : '',
                      hintCard === card ? 'elv-cell-hint' : '',
                      fresh ? 'bub-plop' : '',
                    ].join(' ')}
                    aria-label={`${COLOR_NAMES[color]} ${value}${laid ? ', liegt' : target ? ', anlegen' : ''}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="elv-controls">
        <p className="elv-status" aria-live="polite">
          {status}
        </p>
        <div className="elv-buttons">
          {canDraw && (
            <button type="button" className="elv-btn" onClick={() => onMove({ type: 'draw' })}>
              {drawLabel}
            </button>
          )}
          {canEnd && (
            <button type="button" className="elv-btn elv-btn-main" onClick={() => onMove({ type: 'end' })}>
              {view.played > 0 ? 'Fertig' : 'Weitergeben'}
            </button>
          )}
        </div>
      </div>

    </>
  );

  const own = (
    <>
      {mySeat !== null && (
        <div className="elv-hand">
          <CardFan
            count={hand.length}
            label="Deine Handkarten"
            cardWidth={handCardWidth}
            minStep={(width) => width * 0.42}
            maxRows={3}
            keyOf={(index) => hand[index]!}
            renderCard={(index) => {
              const card = hand[index]!;
              const can = playable.has(card);
              return (
                <button
                  type="button"
                  className={`elv-hand-card ${can ? 'elv-hand-playable' : myTurn ? 'elv-hand-dim' : ''} ${hintCard === card ? 'elv-hand-hint' : ''}`}
                  aria-disabled={!can}
                  onClick={can ? () => onMove({ type: 'play', card }) : undefined}
                  aria-label={`${cardLabel(card)}${can ? ', anlegen' : ''}`}
                >
                  <NumberCard card={card} />
                </button>
              );
            }}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="elv-board" data-around={table ? '' : undefined}>
      {table ? (
        <SeatRing
          seats={view.seats}
          bottomSeat={mySeat ?? 0}
          status={table.status}
          bottom={own}
          renderSeat={(seat) => table.seatChip(seat)}
        >
          {center}
        </SeatRing>
      ) : (
        <>{center}{own}</>
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; seats?: number; className?: string }) {
  // Feste Farbe: Der Ring um das Zeichen ist in jedem Aussehen hell.
  return (
    <span className={className} style={{ color: '#1f2328' }}>
      {SEAT_SYMBOLS[Number(seat) % SEAT_SYMBOLS.length]}
    </span>
  );
}

export const gameUi: GameUi<ElevensState, ElevensMove> = {
  Board,
  seatsAround: true,
  SeatSymbol,
  seatLabel: (seat) => `Platz ${Number(seat) + 1}`,
  seatDetail: (view, seat) => {
    const count = view.hands[Number(seat)]?.length ?? 0;
    return `${count} ${count === 1 ? 'Karte' : 'Karten'}`;
  },
  sounds: {
    cardPlayed: 'karte-legen',
    cardDrawn: 'karte-ziehen',
  },
};
