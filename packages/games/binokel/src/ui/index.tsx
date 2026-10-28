import { sortHand, type CardId, type SeatId, type Suit } from '@brett-und-blatt/engine';
import { cardSuitColor, PlayingCard, SuitShape, TrickTable, useTrickDisplay, type BoardProps, type GameUi, type TrickTableSlot } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { binokelContract, SUIT_NAMES, SUITS } from '../cards';
import { findMelds, meldPoints } from '../melds';
import { type BinokelMove, type BinokelState } from '../rules';

const DECK = 'german' as const;
const HAND_CARD_WIDTH = 'clamp(42px, 10.5vw, 72px)';

const panel = 'rounded-xl border border-line bg-surface p-3 shadow-sm';
const button = 'rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-semibold hover:brightness-95 disabled:opacity-40';
const primary = 'rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow hover:brightness-110 disabled:opacity-40';

function SuitIcon({ suit, className = 'h-4 w-4' }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`inline-block ${className}`} fill={cardSuitColor(suit, DECK)} aria-hidden="true">
      <SuitShape suit={suit} deckStyle={DECK} />
    </svg>
  );
}

function SuitLabel({ suit }: { suit: Suit }) {
  return (
    <span className="inline-flex items-center gap-1">
      <SuitIcon suit={suit} />
      {SUIT_NAMES[suit]}
    </span>
  );
}

function BinokelBoard({ view, legalMoves, onMove, viewer, seatNames, hint }: BoardProps<BinokelState, BinokelMove>) {
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
  const slots: TrickTableSlot[] = [0, 1, 2].map((seat) => ({
    seat,
    name: `${name(seat)}${seat === view.declarer ? ' (Spielmacher)' : ''}`,
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

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-2 overflow-y-auto p-1 text-ink">
      {/* Kopfzeile */}
      <div className={`${panel} flex flex-wrap items-center justify-between gap-2 text-sm`}>
        <span className="font-semibold">Spiel {view.gameNumber}</span>
        {view.declarer !== null ? (
          <span>
            Spielmacher: <strong>{name(view.declarer)}</strong> mit {view.bid}
            {view.durch ? ' · Durch' : view.trump ? <> · Trumpf <SuitLabel suit={view.trump} /></> : ''}
          </span>
        ) : view.phase === 'bidding' ? (
          <span>Reizen: {view.bid !== null ? `${view.bid} von ${name(view.bidder!)}` : 'noch kein Gebot'}</span>
        ) : null}
        <span className="text-muted">Geber: {name(view.dealer)}</span>
      </div>

      {/* Dabb */}
      {(view.phase === 'bidding' || view.phase === 'discard' || view.phase === 'declare') && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted">Dabb</span>
          {view.dabb.map((card, i) => (
            <div key={i} style={{ width: 44 }}>
              <PlayingCard card={card} deckStyle={DECK} />
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
                <SuitLabel suit={suit} /> ({meldPoints(findMelds(hand, suit))})
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
          {[0, 1, 2].map((seat) => (
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

      <TrickTable slots={slots} bottomSeat={mySeat} deckStyle={DECK} cardWidth={72} collecting={display.collecting} />

      {/* Eigene Hand */}
      {viewer !== 'spectator' && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {myHand.map((card) => (
            <div key={card} className="transition-transform hover:-translate-y-1" style={{ width: HAND_CARD_WIDTH }}>
              <PlayingCard
                card={card}
                deckStyle={DECK}
                selected={selected.includes(card)}
                highlight={card === hintCard ? 'hint' : playable.has(card) ? 'target' : null}
                onClick={discarding || playable.has(card) ? () => tapCard(card) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* Abrechnung */}
      {(view.phase === 'roundOver' || view.phase === 'finished') && round && (
        <div className={`${panel} flex flex-col gap-2`}>
          <h3 className="font-bold">
            {round.kind === 'passedOut'
              ? 'Alle haben gepasst – neu geben.'
              : round.kind === 'fold'
                ? `${name(round.declarer!)} ist abgegangen.`
                : `${name(round.declarer!)} hat ${round.kind === 'durch' ? 'den Durch' : `mit ${round.bid}`} ${round.won ? 'gewonnen' : 'verloren'}.`}
          </h3>
          {round.kind !== 'passedOut' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th />
                  <th>Meldung</th>
                  <th>Augen</th>
                  <th>Runde</th>
                  <th>Stand</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((seat) => (
                  <tr key={seat}>
                    <td className="font-semibold">{name(seat)}</td>
                    <td>
                      {round.melds[seat]}
                      {round.melds[seat]! > 0 && !round.madeTrick[seat] && round.kind === 'normal' ? ' (kein Stich)' : ''}
                    </td>
                    <td>{round.eyes[seat]}</td>
                    <td>{round.points[seat]! > 0 ? `+${round.points[seat]}` : round.points[seat]}</td>
                    <td>{view.scores[seat]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {legalMoves.some((m) => m.type === 'nextGame') && (
            <button type="button" className={primary} onClick={() => onMove({ type: 'nextGame' })}>
              Nächstes Spiel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<BinokelState, BinokelMove> = {
  Board: BinokelBoard,
  SeatSymbol: ({ seat, className = '' }) => <SuitIcon suit={(['C', 'S', 'H'] as Suit[])[seat % 3]!} className={`h-6 w-6 ${className}`} />,
  seatLabel: (seat: SeatId) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${view.scores[seat]} Punkte${seat === view.declarer ? ' · Spielmacher' : ''}`,
  sounds: { cardPlayed: 'karte-legen', trickTaken: 'karte-ziehen', announced: 'ansage', newDeal: 'mischen' },
};
