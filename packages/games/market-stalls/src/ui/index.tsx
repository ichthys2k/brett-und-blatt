import type { SeatId } from '@brett-und-blatt/engine';
import { SeatRing, CardFan, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import {
  STAND_CAPACITY,
  WARES,
  placeCard,
  scores,
  starsOf,
  tally,
  wareOf,
  type MarketStallsMove,
  type MarketStallsState,
} from '../rules';
import './styles.css';

const WARE_NAMES = ['Brot', 'Käse', 'Äpfel', 'Fisch'];
const WARE_ICONS = ['🥖', '🧀', '🍎', '🐟'];
const SEAT_SYMBOLS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

const handCardWidth = (containerWidth: number) => Math.round(Math.min(76, Math.max(50, containerWidth * 0.16), Math.max(44, window.innerHeight * 0.12)));

function cardLabel(card: number): string {
  const stars = starsOf(card);
  return `${card}, ${WARE_NAMES[wareOf(card)]}, ${stars} ${stars === 1 ? 'Stern' : 'Sterne'}`;
}

function WareCard({ card }: { card: number }) {
  return (
    <div className={`mst-card mst-w-${wareOf(card)}`} aria-label={cardLabel(card)}>
      <span className="mst-card-number">{card}</span>
      <span className="mst-card-icon" aria-hidden="true">
        {WARE_ICONS[wareOf(card)]}
      </span>
      <span className="mst-card-stars" aria-hidden="true">
        {'★'.repeat(starsOf(card))}
      </span>
    </div>
  );
}

/** Die Wertung als Tabelle: je Platz Karten und Sterne je Ware, die stärkste Ware markiert. */
function Pantries({ view, seatNames, order }: { view: MarketStallsState; seatNames: string[]; order: SeatId[] }) {
  const tallies = tally(view.pantries);
  const points = scores(view.pantries);
  return (
    <table className="mst-table">
      <thead>
        <tr>
          <th scope="col">Kammer</th>
          {WARES.map((_, ware) => (
            <th key={ware} scope="col" title={WARE_NAMES[ware]} aria-label={WARE_NAMES[ware]}>
              {WARE_ICONS[ware]}
            </th>
          ))}
          <th scope="col">Punkte</th>
        </tr>
      </thead>
      <tbody>
        {order.map((seat) => (
          <tr key={seat}>
            <th scope="row">{seatNames[seat] ?? `Platz ${seat + 1}`}</th>
            {tallies[seat]!.map((entry, ware) => (
              <td
                key={ware}
                className={entry.count === 0 ? 'mst-cell-empty' : entry.points >= 0 && entry.stars > 0 ? 'mst-cell-plus' : entry.best ? 'mst-cell-best' : ''}
                aria-label={`${WARE_NAMES[ware]}: ${entry.count} Karten, ${entry.points} Punkte${entry.best ? ', stärkste Ware' : ''}`}
              >
                {entry.count === 0 ? '·' : `${entry.count}/${entry.stars}★`}
              </td>
            ))}
            <td className="mst-cell-points">{points[seat]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, hint, table }: BoardProps<MarketStallsState, MarketStallsMove>) {
  const mySeat = typeof viewer === 'number' ? viewer : null;
  const hand = mySeat !== null ? (view.hands[mySeat] ?? []) : [];
  const selectable = new Set(legalMoves.flatMap((m) => (m.type === 'choose' ? [m.card] : [])));
  const targets = new Set(legalMoves.flatMap((m) => (m.type === 'place' ? [m.stand] : [])));
  const hintCard = hint?.type === 'choose' ? hint.card : null;
  const hintStand = hint?.type === 'place' ? hint.stand : null;
  const nameOf = (seat: SeatId) => seatNames[seat] ?? `Platz ${seat + 1}`;
  const current = view.queue[0];
  const mine = mySeat !== null ? view.chosen[mySeat] : null;
  const waiting = view.chosen.filter((card) => card === null).length;

  let status: string;
  if (view.phase === 'over') status = 'Der Markt ist geschlossen.';
  else if (view.phase === 'place') {
    if (targets.size === 0) status = `${nameOf(current!.seat)} legt die ${current!.card}.`;
    else {
      const taking = [...targets].every((stand) => placeCard(view.stands, stand, current!.card).forced);
      status = taking ? `Die ${current!.card} passt nirgends: Wähle den Stand, den du nimmst.` : `Wohin mit deiner ${current!.card}?`;
    }
  } else if (selectable.size > 0) status = 'Wähle eine Karte.';
  else status = `Deine Wahl steht. Noch ${waiting} ${waiting === 1 ? 'Wahl' : 'Wahlen'} offen.`;

  const order = mySeat !== null ? [mySeat, ...view.pantries.map((_, seat) => seat).filter((seat) => seat !== mySeat)] : view.pantries.map((_, seat) => seat);

  const center = (
    <>
      <div className="mst-head">
        <span>
          Markttag {view.day} von {view.days}
        </span>
        <span aria-hidden="true">🧺</span>
      </div>

      <div className="mst-stands" aria-label="Die vier Stände">
        {view.stands.map((stand, index) => {
          const target = targets.has(index);
          const outcome = target && current ? placeCard(view.stands, index, current.card) : null;
          const takes = outcome ? outcome.taken.length : 0;
          return (
            <button
              key={index}
              type="button"
              disabled={!target}
              onClick={target ? () => onMove({ type: 'place', stand: index }) : undefined}
              className={`mst-stand ${target ? 'mst-stand-target' : ''} ${takes > 0 ? 'mst-stand-take' : ''} ${hintStand === index ? 'mst-stand-hint' : ''}`}
              aria-label={`Stand ${index + 1}: ${stand.length === 0 ? 'leer' : stand.map(cardLabel).join('; ')}${takes > 0 ? `. Du nimmst ${takes} Karten` : target ? '. Hier anlegen' : ''}`}
            >
              {Array.from({ length: STAND_CAPACITY }, (_, slot) => {
                const card = stand[slot];
                return card !== undefined ? (
                  <WareCard key={card} card={card} />
                ) : (
                  <div key={`leer-${slot}`} className={`mst-slot ${slot === STAND_CAPACITY - 1 ? 'mst-slot-last' : ''}`} aria-hidden="true" />
                );
              })}
              {takes > 0 && <span className="mst-take-note">nimmst {takes}</span>}
            </button>
          );
        })}
      </div>

      {view.queue.length > 0 && (
        <ol className="mst-queue" aria-label="Aufgedeckte Karten in Legereihenfolge">
          {view.queue.map((play, index) => (
            <li key={play.card} className={index === 0 ? 'mst-queue-now' : ''}>
              <WareCard card={play.card} />
              <span>{nameOf(play.seat)}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mst-status" aria-live="polite">
        {status}
      </p>

      {mine !== null && mine > 0 && (
        <div className="mst-mine">
          Gewählt: <WareCard card={mine} />
        </div>
      )}

      <div className="mst-pantries">
        <Pantries view={view} seatNames={seatNames} order={order} />
      </div>

    </>
  );

  const own = (
    <>
      {mySeat !== null && hand.length > 0 && (
        <div className="mst-hand">
          <CardFan
            count={hand.length}
            label="Deine Handkarten"
            cardWidth={handCardWidth}
            minStep={(width) => width * 0.5}
            cardAspect={4 / 3}
            maxRows={2}
            keyOf={(index) => hand[index]!}
            renderCard={(index) => {
              const card = hand[index]!;
              const can = selectable.has(card);
              return (
                <button
                  type="button"
                  className={`mst-hand-card ${can ? 'mst-hand-playable' : ''} ${hintCard === card ? 'mst-hand-hint' : ''}`}
                  aria-disabled={!can}
                  onClick={can ? () => onMove({ type: 'choose', card }) : undefined}
                  aria-label={`${cardLabel(card)}${can ? ', wählen' : ''}`}
                >
                  <WareCard card={card} />
                </button>
              );
            }}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mst-board" data-phase={view.phase} data-around={table ? '' : undefined}>
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

export const gameUi: GameUi<MarketStallsState, MarketStallsMove> = {
  Board,
  seatsAround: true,
  SeatSymbol,
  seatLabel: (seat) => `Platz ${Number(seat) + 1}`,
  seatDetail: (view, seat) => {
    const count = view.pantries[Number(seat)]?.length ?? 0;
    return `${count} ${count === 1 ? 'Karte' : 'Karten'} in der Kammer`;
  },
  seatScore: (view, seat) => scores(view.pantries)[Number(seat)] ?? null,
  sounds: {
    revealed: 'karten-faecher',
    cardPlayed: 'karte-legen',
    standTaken: 'karten-kaskade',
    newDeal: 'karten-austeilen',
  },
};
