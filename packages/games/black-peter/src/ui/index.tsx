import type { SeatId } from '@brett-und-blatt/engine';
import { CardFan, ContentCard, useElementSize, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { faceOf, PETER } from '../content';
import { sourceOf, type BlackPeterMove, type BlackPeterState, type Card } from '../rules';
import './styles.css';

const SEAT_COLORS = ['#d6336c', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599'];

function Face({ set, card, small = false }: { set: string; card: Card; small?: boolean }) {
  return <ContentCard content={faceOf(set, card.pair, card.side)} caption={card.pair === PETER && !small ? 'Schwarzer Peter' : undefined} className={card.pair === PETER ? 'bp-peter' : ''} />;
}

function Board({ view, legalMoves, onMove, viewer, seatNames, hint }: BoardProps<BlackPeterState, BlackPeterMove>) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const source = sourceOf(view);
  const canDraw = legalMoves.some((m) => m.type === 'draw');
  const canShuffle = legalMoves.some((m) => m.type === 'shuffle');
  const others = view.hands.map((_, seat) => seat).filter((seat) => seat !== viewer);
  const own = viewer === 'spectator' ? [] : (view.hands[viewer] ?? []);
  const big = Math.max(44, Math.min(96, width / 5.5));
  const small = Math.max(22, Math.min(40, width / (others.length * 4.5)));
  const hintIndex = hint?.type === 'draw' ? hint.index : null;
  const recent = view.discarded.slice(-6).reverse();

  return (
    <div ref={ref} className="bp-table">
      <div className="bp-others">
        {others.map((seat) => {
          const hand = view.hands[seat] ?? [];
          const isSource = seat === source && canDraw;
          return (
            <section key={seat} className={`bp-seat ${isSource ? 'bp-source' : ''} ${seat === view.turn ? 'bp-turn' : ''}`} aria-label={`${seatNames[seat] ?? `Platz ${seat + 1}`}: ${hand.length} Karten`}>
              <span className="bp-name" style={{ color: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
                {seatNames[seat] ?? `Platz ${seat + 1}`} · {hand.length}
              </span>
              <CardFan
                count={hand.length}
                cardWidth={isSource ? big : small}
                label={`Karten von ${seatNames[seat] ?? `Platz ${seat + 1}`}`}
                renderCard={(index) => (
                  <ContentCard
                    content={null}
                    highlight={isSource && hintIndex === index ? 'hint' : null}
                    onClick={isSource ? () => onMove({ type: 'draw', index }) : undefined}
                    label={isSource ? `Karte ${index + 1} ziehen` : 'verdeckte Karte'}
                    className="bp-card"
                  />
                )}
              />
            </section>
          );
        })}
      </div>

      <div className="bp-middle" aria-label="Abgelegte Paare">
        {canDraw && <p className="bp-help">Tippe eine Karte von {seatNames[source ?? 0] ?? 'deinem Nachbarn'} an.</p>}
        <div className="bp-pairs">
          {recent.map((entry, i) => (
            <span key={`${entry.pair}-${i}`} className="bp-pair" title={seatNames[entry.seat]}>
              <span className="bp-mini">
                <Face set={view.set} card={{ pair: entry.pair, side: 'a' }} small />
              </span>
              <span className="bp-mini">
                <Face set={view.set} card={{ pair: entry.pair, side: 'b' }} small />
              </span>
            </span>
          ))}
        </div>
        <p className="bp-count">{view.discarded.length} Paare abgelegt</p>
      </div>

      {viewer !== 'spectator' && (
        <div className="bp-own">
          <CardFan
            count={own.length}
            cardWidth={big}
            label="Deine Karten"
            renderCard={(index) => {
              const card = own[index];
              return card ? <Face set={view.set} card={card} /> : <ContentCard content={null} />;
            }}
          />
          {canShuffle && (
            <button type="button" className="bp-shuffle" onClick={() => onMove({ type: 'shuffle' })}>
              🔀 Karten mischen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`bp-symbol ${className}`} style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
      {seat + 1}
    </span>
  );
}

export const gameUi: GameUi<BlackPeterState, BlackPeterMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const cards = view.hands[seat]?.length ?? 0;
    if (view.loser === seat) return '🐈‍⬛ hat den Schwarzen Peter';
    return cards === 0 ? 'fertig' : `${cards} ${cards === 1 ? 'Karte' : 'Karten'}`;
  },
};
