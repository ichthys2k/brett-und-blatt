import { sortHand, type CardId, type DeckStyle, type SeatId, type Suit } from '@brett-und-blatt/engine';
import {
  cardSuitColor,
  CardFan,
  PlayingCard,
  RoundSummary,
  type RoundSummaryPlayer,
  TRICK_HAND_MIN_STEP,
  SuitShape,
  SeatRing,
  TrickTable,
  trickHandCardWidth,
  useTrickDisplay,
  type BoardProps,
  type GameUi,
  type TrickTableSlot,
} from '@brett-und-blatt/ui';
import { useState } from 'react';
import { binokelContract, SUIT_NAMES, SUITS } from '../cards';
import { findMelds, meldPoints } from '../melds';
import { activeSeats, seatCount, teamOf, type BinokelMove, type BinokelState } from '../rules';

const panel = 'rounded-xl border border-line bg-surface p-3 shadow-sm';
const button = 'rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-semibold hover:brightness-95 disabled:opacity-40';
const primary = 'rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow hover:brightness-110 disabled:opacity-40';

function SuitIcon({ suit, deck = 'four-color', className = 'h-4 w-4' }: { suit: Suit; deck?: DeckStyle; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`inline-block ${className}`} fill={cardSuitColor(suit, deck)} aria-hidden="true">
      <SuitShape suit={suit} deckStyle={deck} />
    </svg>
  );
}

function SuitLabel({ suit, deck }: { suit: Suit; deck: DeckStyle }) {
  return (
    <span className="inline-flex items-center gap-1">
      <SuitIcon suit={suit} deck={deck} />
      {SUIT_NAMES[suit]}
    </span>
  );
}

/** Handkarten in der Hand-Ansicht (#100): Es gibt nur die Hand, also dürfen sie größer sein. */
const HAND_VIEW_CARD_WIDTH = 72;

function BinokelBoard({ view, legalMoves, onMove, viewer, seatNames, hint, table, handOnly, display: onTv }: BoardProps<BinokelState, BinokelMove>) {
  const mySeat = typeof viewer === 'number' ? viewer : 0;
  const name = (s: number) => seatNames[s] ?? `Platz ${s + 1}`;
  const myTurn = legalMoves.length > 0;
  const hand = (view.hands[mySeat] ?? []).filter((c): c is CardId => c !== null);
  const myHand = sortHand(hand, binokelContract(view.trump));
  const [selected, setSelected] = useState<CardId[]>([]);
  const [lastPhase, setLastPhase] = useState(view.phase);
  if (lastPhase !== view.phase) {
    setLastPhase(view.phase);
    setSelected([]);
  }

  const display = useTrickDisplay(view.currentTrick, view.completedTricks);
  const playing = activeSeats(view);
  const allSeats = Array.from({ length: seatCount(view) }, (_, s) => s);
  const partnerOfDeclarer = view.kreuz && view.declarer !== null ? teamOf(view, view.declarer).find((s) => s !== view.declarer) ?? null : null;
  const slots: TrickTableSlot[] = playing.map((seat) => ({
    seat,
    name: `${name(seat)}${seat === view.declarer ? ' (Spielmacher)' : seat === partnerOfDeclarer ? ' (Partner)' : ''}`,
    card: display.cards.find((p) => p.player === seat)?.card ?? null,
    isLeader: display.cards[0]?.player === seat,
    isWinner: display.winner === seat,
  }));

  const playable = new Set(legalMoves.flatMap((m) => (m.type === 'play' ? [m.card] : [])));
  const hintCard = hint?.type === 'play' ? hint.card : null;
  const bids = legalMoves.filter((m): m is Extract<BinokelMove, { type: 'bid' }> => m.type === 'bid');
  const discardCount = view.dabb.length;
  const discarding = view.phase === 'discard' && myTurn;

  const tapCard = (card: CardId) => {
    if (discarding) {
      setSelected(selected.includes(card) ? selected.filter((c) => c !== card) : selected.length < discardCount ? [...selected, card] : selected);
    } else if (playable.has(card)) {
      onMove({ type: 'play', card });
    }
  };

  const tricksWon = (seat: number) => view.completedTricks.filter((t) => t.winner === seat).length;
  const round = view.lastRound;

  // Kopfzeile
  const header = (
      <div className={`${panel} flex flex-wrap items-center justify-between gap-2 text-sm`}>
        <span className="font-semibold">Spiel {view.gameNumber}</span>
        {view.declarer !== null ? (
          <span>
            Spielmacher: <strong>{name(view.declarer)}</strong> mit {view.bid}
            {view.durch ? ' · Durch' : view.trump ? <> · Trumpf <SuitLabel suit={view.trump} deck={view.deckStyle} /></> : ''}
          </span>
        ) : view.phase === 'bidding' ? (
          <span>Reizen: {view.bid !== null ? `${view.bid} von ${name(view.bidder!)}` : 'noch kein Gebot'}</span>
        ) : null}
        <span className="text-muted">
          Geber: {name(view.dealer)}
          {!playing.includes(view.dealer) ? ' (setzt aus)' : ''}
          {view.kreuz ? ` · Kreuzbinokel: ${teamOf(view, 0).map(name).join(' + ')} gegen ${activeSeats(view).filter((s) => !teamOf(view, 0).includes(s)).map(name).join(' + ')}` : ''}
        </span>
      </div>

  );

  const dialogs = (
    <>
      {/* Dabb */}
      {(view.phase === 'bidding' || view.phase === 'discard' || view.phase === 'declare') && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted">Dabb</span>
          {view.dabb.map((card, i) => (
            <div key={i} style={{ width: 44 }}>
              <PlayingCard card={card} deckStyle={view.deckStyle} />
            </div>
          ))}
        </div>
      )}

      {/* Reizen */}
      {view.phase === 'bidding' && myTurn && (
        <div className={panel}>
          <p className="mb-2 text-sm">
            {view.bid === null ? `Mindestgebot ${view.minBid}.` : `Höchstes Gebot: ${view.bid}.`} Was bietest du?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => onMove({ type: 'pass' })}>
              Weg (passen)
            </button>
            {bids.map((m, i) => (
              <button key={m.value} type="button" className={i === 0 ? primary : button} onClick={() => onMove(m)}>
                {m.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drücken */}
      {discarding && (
        <div className={panel}>
          <p className="mb-2 text-sm">
            Du hast den Dabb aufgenommen. Wähle {discardCount} Karten zum Drücken ({selected.length}/{discardCount}). Gedrückte Augen zählen für dich.
          </p>
          <button type="button" className={primary} disabled={selected.length !== discardCount} onClick={() => onMove({ type: 'discard', cards: selected })}>
            Karten drücken
          </button>
        </div>
      )}

      {/* Trumpf ansagen */}
      {view.phase === 'declare' && myTurn && (
        <div className={panel}>
          <p className="mb-2 text-sm">Sag Trumpf an. In Klammern stehen deine Meldepunkte mit dieser Farbe.</p>
          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUITS.map((suit) => (
              <button key={suit} type="button" className={hint?.type === 'declareTrump' && hint.suit === suit ? primary : button} onClick={() => onMove({ type: 'declareTrump', suit })}>
                <SuitLabel suit={suit} deck={view.deckStyle} /> ({meldPoints(findMelds(hand, suit))})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {legalMoves.some((m) => m.type === 'declareDurch') && (
              <button type="button" className={button} onClick={() => onMove({ type: 'declareDurch' })}>
                Durch (alle Stiche)
              </button>
            )}
            <button type="button" className={button} onClick={() => onMove({ type: 'fold' })}>
              Abgehen (−{view.bid})
            </button>
          </div>
        </div>
      )}

      {/* Meldungen */}
      {view.phase === 'play' && !view.durch && (
        <div className={`${panel} space-y-1 py-2 text-xs`}>
          {playing.map((seat) => (
            <div key={seat} className="flex gap-2">
              <span className="w-24 flex-none truncate font-semibold">{name(seat)}</span>
              <span className="w-14 flex-none">
                {meldPoints(view.melds[seat]!)}
                {tricksWon(seat) > 0 ? ' ✓' : ''}
              </span>
              <span className="text-muted">{view.melds[seat]!.length === 0 ? 'keine Meldung' : view.melds[seat]!.map((m) => m.label).join(', ')}</span>
            </div>
          ))}
          <div className="text-muted">✓ = hat einen Stich, die Meldung zählt.</div>
        </div>
      )}

    </>
  );

  const trick = (
      <div className="flex min-h-[90px] flex-1 flex-col">
        <TrickTable slots={slots} bottomSeat={mySeat} deckStyle={view.deckStyle} cardWidth={72} collecting={display.collecting} />
      </div>

  );

  // Eigene Hand
  const handFan = viewer !== 'spectator' && (
        <CardFan
          className="w-full flex-none pb-1"
          count={myHand.length}
          label="Deine Handkarten"
          cardWidth={handOnly ? HAND_VIEW_CARD_WIDTH : trickHandCardWidth}
          minStep={TRICK_HAND_MIN_STEP}
          maxRows={2}
          keyOf={(idx) => myHand[idx]!}
          renderCard={(idx) => {
            const card = myHand[idx]!;
            return (
              <PlayingCard
                card={card}
                deckStyle={view.deckStyle}
                selected={selected.includes(card)}
                highlight={card === hintCard ? 'hint' : playable.has(card) ? 'target' : null}
                onClick={discarding || playable.has(card) ? () => tapCard(card) : undefined}
              />
            );
          }}
        />
  );

  // Abrechnung
  const roundPlayers: RoundSummaryPlayer[] = round && round.kind !== 'passedOut'
    ? allSeats.map((seat) => {
        const currentScore = view.scores[seat] ?? 0;
        const roundChange = round.points[seat] ?? 0;
        const meldText =
          round.melds[seat]! > 0 && !round.madeTrick[seat] && round.kind === 'normal'
            ? `Meldung: ${round.melds[seat]} (kein Stich) · Augen: ${round.eyes[seat]}`
            : `Meldung: ${round.melds[seat]} · Augen: ${round.eyes[seat]}`;

        return {
          seat,
          name: name(seat),
          previousScore: currentScore - roundChange,
          roundChange,
          currentScore,
          detail: meldText,
          isMe: seat === mySeat,
        };
      })
    : allSeats.map((seat) => ({
        seat,
        name: name(seat),
        previousScore: view.scores[seat] ?? 0,
        roundChange: 0,
        currentScore: view.scores[seat] ?? 0,
        isMe: seat === mySeat,
      }));

  const roundEnd = (
    <>
      {view.phase === 'roundOver' && round && (
        <RoundSummary
          title="Runde beendet"
          subtitle={
            round.kind === 'passedOut'
              ? 'Alle haben gepasst – neu geben.'
              : round.kind === 'fold'
                ? `${name(round.declarer!)} ist abgegangen.`
                : `${name(round.declarer!)} hat ${round.kind === 'durch' ? 'den Durch' : `mit ${round.bid}`} ${round.won ? 'gewonnen' : 'verloren'}.`
          }
          note={
            round.kind !== 'passedOut' && view.kreuz
              ? 'Partner zählen zusammen: Beide bekommen die Punkte ihrer Partei.'
              : null
          }
          players={roundPlayers}
          actions={
            legalMoves.some((m) => m.type === 'nextGame') && (
              <button
                type="button"
                className="bub-round-summary-btn"
                onClick={() => onMove({ type: 'nextGame' })}
              >
                Nächstes Spiel
              </button>
            )
          }
        />
      )}
    </>
  );


  return (
    <div className={`flex h-full flex-col w-full mx-auto p-1 gap-2 sm:p-2 flat:p-0 text-ink ${table ? '' : 'max-w-4xl'}`}>
      {header}
      {table ? (
        <SeatRing
          seats={seatNames.length}
          bottomSeat={mySeat}
          status={table.status}
          bottom={onTv ? undefined : handFan || undefined}
          renderSeat={(seat) => (
            <>
              {(onTv || seat !== mySeat) && (view.hands[seat]?.length ?? 0) > 0 && (
                <div className="w-20" aria-hidden="true">
                  <CardFan count={view.hands[seat]!.length} label="" cardWidth={16} renderCard={() => <PlayingCard card={null} deckStyle={view.deckStyle} />} />
                </div>
              )}
              {table.seatChip(seat)}
            </>
          )}
        >
          {dialogs}
          {roundEnd}
          {trick}
        </SeatRing>
      ) : handOnly ? (
        // Hand-Ansicht (#100): der Stich klein als Zusammenfassung des Tisches, darunter die eigene Hand.
        <>
          {dialogs}
          <div className="flex min-h-[170px] flex-col">
            <TrickTable slots={slots} bottomSeat={mySeat} deckStyle={view.deckStyle} cardWidth={44} collecting={display.collecting} />
          </div>
          {handFan}
          {roundEnd}
        </>
      ) : (
        <>
          {dialogs}
          {trick}
          {!onTv && handFan}
          {roundEnd}
        </>
      )}
    </div>
  );
}

export const gameUi: GameUi<BinokelState, BinokelMove> = {
  handView: true,
  Board: BinokelBoard,
  seatsAround: true,
  SeatSymbol: ({ seat, className = '' }) => <SuitIcon suit={(['C', 'S', 'H', 'D'] as Suit[])[seat % 4]!} className={`h-6 w-6 ${className}`} />,
  seatLabel: (seat: SeatId) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) =>
    `${view.scores[seat]} Punkte${seat === view.declarer ? ' · Spielmacher' : ''}${view.kreuz ? ` · Partei ${teamOf(view, 0).includes(seat) ? 'A' : 'B'}` : ''}${!activeSeats(view).includes(seat) ? ' · setzt aus' : ''}`,
  sounds: {
    cardPlayed: 'karte-legen',
    trickTaken: 'stich-einsammeln',
    announced: (event) => (event.call === 'declareDurch' ? 'ruf-durch' : event.call === 'fold' ? 'ruf-abgehen' : event.call === 'bid' ? 'reizen-klopfen' : 'ansage'),
    newDeal: 'karten-austeilen',
  },
};
