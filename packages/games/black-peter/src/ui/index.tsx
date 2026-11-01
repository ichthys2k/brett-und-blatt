import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { SeatRing, CardFan, ContentCard, useElementSize, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState } from 'react';
import { faceOf, PETER } from '../content';
import { sourceOf, type BlackPeterMove, type BlackPeterState, type Card } from '../rules';
import './styles.css';

const SEAT_COLORS = ['#d6336c', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599'];

function Face({ set, card, small = false, anim }: { set: string; card: Card; small?: boolean; anim?: 'drop' | 'shake' | 'deal' | null }) {
  return (
    <ContentCard
      content={faceOf(set, card.pair, card.side)}
      caption={card.pair === PETER && !small ? 'Schwarzer Peter' : undefined}
      className={card.pair === PETER ? 'bp-peter' : ''}
      anim={anim}
    />
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, hint, events, table }: BoardProps<BlackPeterState, BlackPeterMove>) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [shufflingSeat, setShufflingSeat] = useState<SeatId | null>(null);
  const seenEventsRef = useRef<GameEvent[] | null>(null);

  useEffect(() => {
    if (seenEventsRef.current === events) return;
    seenEventsRef.current = events;
    const shuffleEvent = events.find((e) => e.type === 'shuffled') as { seat: SeatId } | undefined;
    if (shuffleEvent) {
      setShufflingSeat(shuffleEvent.seat);
      const timer = window.setTimeout(() => setShufflingSeat(null), 400);
      return () => window.clearTimeout(timer);
    }
  }, [events]);

  const source = sourceOf(view);
  const canDraw = legalMoves.some((m) => m.type === 'draw');
  const canShuffle = legalMoves.some((m) => m.type === 'shuffle');
  const others = view.hands.map((_, seat) => seat).filter((seat) => seat !== viewer);
  const own = viewer === 'spectator' ? [] : (view.hands[viewer] ?? []);
  // Zwei große Fächer (Ziehen und eigene Hand) plus Mitte müssen auch im Querformat in die Höhe passen.
  const big = Math.max(44, Math.min(96, width / 5.5, height > 0 ? (height - 130) / 2.9 : 96));
  const small = Math.max(22, Math.min(40, width / (others.length * 4.5)));
  const hintIndex = hint?.type === 'draw' ? hint.index : null;
  const recent = view.discarded.slice(-6).reverse();

  const othersRow = (
    <>
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
                shuffling={shufflingSeat === seat}
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

    </>
  );

  const middle = (
    <>
      <div className="bp-middle" aria-label="Abgelegte Paare">
        {canDraw && <p className="bp-help">Tippe eine Karte von {seatNames[source ?? 0] ?? 'deinem Nachbarn'} an.</p>}
        <div className="bp-pairs">
          {recent.map((entry, i) => (
            <span key={`${entry.pair}-${i}`} className="bp-pair" title={seatNames[entry.seat]}>
              <span className="bp-mini">
                <Face set={view.set} card={{ pair: entry.pair, side: 'a' }} small anim={i === 0 ? 'drop' : null} />
              </span>
              <span className="bp-mini">
                <Face set={view.set} card={{ pair: entry.pair, side: 'b' }} small anim={i === 0 ? 'drop' : null} />
              </span>
            </span>
          ))}
        </div>
        <p className="bp-count">{view.discarded.length} Paare abgelegt</p>
      </div>

    </>
  );

  const ownArea = (
    <>
      {viewer !== 'spectator' && (
        <div className="bp-own">
          <CardFan
            count={own.length}
            cardWidth={big}
            label="Deine Karten"
            shuffling={shufflingSeat === viewer}
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
    </>
  );

  return (
    <div ref={ref} className="bp-table" data-around={table ? '' : undefined}>
      {table ? (
        <SeatRing
          seats={view.hands.length}
          bottomSeat={viewer === 'spectator' ? 0 : viewer}
          status={table.status}
          bottom={ownArea}
          renderSeat={(seat) => (
            <>
              {seat !== viewer && (
                <div className="w-24" aria-hidden="true">
                  <CardFan count={view.hands[seat]?.length ?? 0} cardWidth={22} label="" renderCard={() => <ContentCard content={null} className="bp-card" />} />
                </div>
              )}
              {table.seatChip(seat)}
            </>
          )}
        >
          {/* Am Sitz wären die Karten zu eng zum Antippen: Gezogen wird in der Mitte. */}
          {canDraw && source !== null && source !== undefined && (
            <CardFan
              count={view.hands[source]?.length ?? 0}
              cardWidth={big}
              label={`Karten von ${seatNames[source] ?? `Platz ${source + 1}`}`}
              shuffling={shufflingSeat === source}
              renderCard={(index) => (
                <ContentCard
                  content={null}
                  highlight={hintIndex === index ? 'hint' : null}
                  onClick={() => onMove({ type: 'draw', index })}
                  label={`Karte ${index + 1} ziehen`}
                  className="bp-card"
                />
              )}
            />
          )}
          {middle}
        </SeatRing>
      ) : (
        <>{othersRow}{middle}{ownArea}</>
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
  seatsAround: true,
  SeatSymbol,
  sounds: { drawn: 'karte-ziehen', discarded: 'paar', shuffled: 'mischen', lost: 'peter-gezogen' },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const cards = view.hands[seat]?.length ?? 0;
    if (view.loser === seat) return '🐈‍⬛ hat den Schwarzen Peter';
    return cards === 0 ? 'fertig' : `${cards} ${cards === 1 ? 'Karte' : 'Karten'}`;
  },
};
