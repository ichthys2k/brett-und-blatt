import { useEffect, useMemo, useState } from 'react';
import { cardRank, rankLabel, type CardId, type SeatId } from '@brett-und-blatt/engine';
import { PlayingCard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { cardValue, groupsOf, placeKind, placeTitle, topPlay, type PlaceKind, type PresidentMove, type PresidentView, type Titles } from '../rules';
import './styles.css';

const BADGES: Record<Titles, Record<PlaceKind, string>> = {
  president: { top: '👑', vice: '🎩', middle: '🙂', viceLow: '🧹', low: '🪣' },
  court: { top: '🤴', vice: '🗡️', middle: '🙂', viceLow: '🧺', low: '🪣' },
};

const COUNT_WORDS = ['', 'Einzelkarte', 'Paar', 'Drilling', 'Vierling'];

function seatName(names: string[], seat: SeatId): string {
  return names[seat] ?? `Platz ${seat + 1}`;
}

function rankName(card: CardId, deckStyle: string): string {
  const rank = cardRank(card);
  if (deckStyle === 'german') return ({ 1: 'Sau', 11: 'Unter', 12: 'Ober', 13: 'König' } as Record<number, string>)[rank] ?? String(rank);
  return ({ 1: 'Ass', 11: 'Bube', 12: 'Dame', 13: 'König' } as Record<number, string>)[rank] ?? rankLabel(rank);
}

/** Titel eines Platzes aus der letzten Runde bzw. der laufenden (wer schon draußen ist). */
function titleOf(view: PresidentView, seat: SeatId): { badge: string; title: string } | null {
  const n = view.counts.length;
  const done = view.finished.indexOf(seat);
  const place = done >= 0 ? done : view.lastPlace[seat];
  if (place === null || place === undefined) return null;
  return { badge: BADGES[view.options.titles][placeKind(place, n)], title: placeTitle(place, n, view.options.titles) };
}

function Hint({ view, mine, names }: { view: PresidentView; mine: boolean; names: string[] }) {
  if (view.phase === 'exchange') {
    const swap = view.swaps.find((s) => !s.done);
    return <>{swap ? `${seatName(names, swap.high)} wählt ${swap.count === 1 ? 'eine Karte' : `${swap.count} Karten`} für ${seatName(names, swap.low)}.` : ''}</>;
  }
  if (view.phase !== 'play') return null;
  const top = topPlay(view);
  const who = mine ? 'Du' : seatName(names, view.turn);
  if (!top) return <>{mine ? 'Du beginnst: Lege eine Karte oder mehrere gleiche.' : `${who} beginnt den Stich.`}</>;
  const n = top.cards.length;
  const word = COUNT_WORDS[n] ?? `${n} Gleiche`;
  const higher = view.reversed ? 'niedriger' : 'höher';
  return (
    <>
      {mine ? 'Gesucht: ' : `${who} ist dran – gesucht: `}
      {word} {higher} als {rankName(top.cards[0]!, view.options.deckStyle)}
      {view.options.sameSkips ? ' (oder gleich)' : ''}
    </>
  );
}

export function PresidentBoard({ view, legalMoves, onMove, viewer, seatNames, hint }: BoardProps<PresidentView, PresidentMove>) {
  const me = typeof viewer === 'number' ? viewer : null;
  const hand = me !== null ? view.hands[me] ?? [] : [];
  const deckStyle = view.options.deckStyle;
  const [selected, setSelected] = useState<CardId[]>([]);

  const canPass = legalMoves.some((m) => m.type === 'pass');
  const canReady = legalMoves.some((m) => m.type === 'ready');
  const swap = view.phase === 'exchange' ? view.swaps.find((s) => !s.done && s.high === me) : undefined;
  const plays = legalMoves.filter((m): m is Extract<PresidentMove, { type: 'play' }> => m.type === 'play');
  const twoHigh = view.options.twoHigh && view.deckSize === 52;
  const top = topPlay(view);

  // Auswahl verwerfen, sobald sich die Lage ändert.
  const stamp = `${view.phase}/${view.round}/${view.turn}/${view.trick.length}/${hand.length}`;
  useEffect(() => setSelected([]), [stamp]);

  // Tipp-Knopf: den vorgeschlagenen Zug vorauswählen.
  useEffect(() => {
    if (hint && (hint.type === 'play' || hint.type === 'give')) setSelected(hint.cards);
  }, [hint]);

  /** Welche Ränge gerade spielbar sind (Wert → Anzahl der nötigen Karten). */
  const playable = useMemo(() => new Set(plays.map((m) => cardValue(m.cards[0]!, twoHigh))), [plays, twoHigh]);

  const selectionMove: PresidentMove | null = useMemo(() => {
    if (swap) return selected.length === swap.count ? { type: 'give', cards: selected } : null;
    if (selected.length === 0) return null;
    const value = cardValue(selected[0]!, twoHigh);
    const ok = plays.some((m) => cardValue(m.cards[0]!, twoHigh) === value && m.cards.length === selected.length);
    return ok && selected.every((c) => cardValue(c, twoHigh) === value) ? { type: 'play', cards: selected } : null;
  }, [selected, swap, plays, twoHigh]);

  function toggle(card: CardId) {
    if (swap) {
      setSelected((s) => (s.includes(card) ? s.filter((c) => c !== card) : [...s, card].slice(-swap.count)));
      return;
    }
    const value = cardValue(card, twoHigh);
    if (!playable.has(value)) return;
    setSelected((s) => {
      if (s.includes(card)) return s.filter((c) => c !== card);
      const same = s.filter((c) => cardValue(c, twoHigh) === value);
      // Beim Bedienen gleich so viele Karten dieses Rangs wählen, wie gebraucht werden.
      if (top && same.length === 0) return hand.filter((c) => cardValue(c, twoHigh) === value && c !== card).slice(0, top.cards.length - 1).concat(card);
      return [...same, card].slice(-(top?.cards.length ?? 4));
    });
  }

  const groups = groupsOf(view, hand);
  const others = view.counts.map((_, s) => s).filter((s) => s !== me);
  const ordered = me === null ? others : [...others.filter((s) => s > me), ...others.filter((s) => s < me)];
  const previous = view.trick.length > 1 ? view.trick[view.trick.length - 2] : undefined;
  const myTitle = me !== null ? titleOf(view, me) : null;
  const mySwap = me !== null ? view.swaps.find((s) => s.low === me || s.high === me) : undefined;

  return (
    <div className="prs-table">
      <div className="prs-opponents">
        {ordered.map((seat) => {
          const title = titleOf(view, seat);
          const out = view.finished.includes(seat);
          const active = view.phase === 'play' && view.turn === seat;
          return (
            <div key={seat} className={`prs-opp${active ? ' prs-opp-active' : ''}${out ? ' prs-opp-out' : ''}`}>
              <div className="prs-opp-name">
                {title && <span title={title.title}>{title.badge} </span>}
                {seatName(seatNames, seat)}
              </div>
              <div className="prs-opp-cards">
                <span className="prs-mini">
                  <PlayingCard card={null} deckStyle={deckStyle} />
                </span>
                <b>{view.counts[seat]}</b>
              </div>
              <div className="prs-opp-state">{out ? title?.title : view.phase === 'play' && view.passed[seat] && view.trick.length > 0 ? 'passt' : ' '}</div>
            </div>
          );
        })}
      </div>

      <div className="prs-center">
        {view.reversed && <div className="prs-revolution">✊ Revolution – die Rangfolge ist umgekehrt</div>}
        <div className="prs-trick">
          {previous && (
            <div className="prs-play prs-play-prev">
              {previous.cards.map((c) => (
                <PlayingCard key={c} card={c} deckStyle={deckStyle} className="prs-card" />
              ))}
            </div>
          )}
          {top ? (
            <div className="prs-play prs-play-top" key={top.cards.join()}>
              {top.cards.map((c) => (
                <PlayingCard key={c} card={c} deckStyle={deckStyle} className="prs-card" anim="drop" />
              ))}
              <span className="prs-play-who">{top.seat === me ? 'Du' : seatName(seatNames, top.seat)}</span>
            </div>
          ) : (
            <div className="prs-empty">{view.phase === 'play' ? 'Neuer Stich' : ''}</div>
          )}
        </div>
        <div className="prs-hint" aria-live="polite">
          <Hint view={view} mine={view.phase === 'play' && view.turn === me} names={seatNames} />
        </div>
      </div>

      {me !== null && (
        <div className="prs-me">
          <div className="prs-me-head">
            {myTitle && (
              <span className="prs-me-title">
                {myTitle.badge} {myTitle.title}
              </span>
            )}
            {mySwap && view.phase === 'exchange' && mySwap.low === me && (
              <span className="prs-note">
                Du gibst {mySwap.count === 1 ? 'deine beste Karte' : `deine ${mySwap.count} besten Karten`} an {seatName(seatNames, mySwap.high)}.
              </span>
            )}
            {mySwap && mySwap.done && view.phase === 'play' && view.played.length === 0 && (
              <span className="prs-note">
                Tausch: Du hast {(mySwap.low === me ? mySwap.up : mySwap.down).map((c) => rankName(c, deckStyle)).join(' und ')} abgegeben und{' '}
                {(mySwap.low === me ? mySwap.down : mySwap.up).map((c) => rankName(c, deckStyle)).join(' und ')} bekommen.
              </span>
            )}
            {swap && (
              <span className="prs-note">
                Du hast {swap.up.map((c) => rankName(c, deckStyle)).join(' und ')} bekommen. Wähle {swap.count === 1 ? 'eine Karte' : `${swap.count} Karten`} für {seatName(seatNames, swap.low)}.
              </span>
            )}
          </div>
          <div className="prs-hand">
            {groups.map((g) => (
              <div key={g.value} className={`prs-group${!swap && playable.has(g.value) ? ' prs-group-ok' : ''}`}>
                {g.cards.map((c) => (
                  <PlayingCard
                    key={c}
                    card={c}
                    deckStyle={deckStyle}
                    className="prs-card prs-hand-card"
                    selected={selected.includes(c)}
                    highlight={!swap && playable.has(g.value) && !selected.includes(c) ? 'hint' : null}
                    onClick={swap || playable.has(g.value) ? () => toggle(c) : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="prs-actions">
            {canPass && (
              <button type="button" className="prs-button" onClick={() => onMove({ type: 'pass' })}>
                Passen
              </button>
            )}
            {(plays.length > 0 || swap) && (
              <button type="button" className="prs-button prs-button-main" disabled={!selectionMove} onClick={() => selectionMove && onMove(selectionMove)}>
                {swap ? 'Abgeben' : selected.length > 1 ? `${selected.length} Karten legen` : 'Legen'}
              </button>
            )}
          </div>
        </div>
      )}

      {(view.phase === 'roundEnd' || view.phase === 'gameEnd') && view.lastRound && (
        <div className="prs-overlay">
          <div className="prs-overlay-box">
            <div className="prs-overlay-title">
              Runde {view.lastRound.round} von {view.options.rounds}
            </div>
            <table className="prs-scores">
              <thead>
                <tr>
                  <th>Platz</th>
                  <th>Runde</th>
                  <th>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {view.lastRound.order.map((seat, place) => (
                  <tr key={seat} className={seat === me ? 'prs-row-me' : undefined}>
                    <td>
                      {BADGES[view.options.titles][placeKind(place, view.counts.length)]} {placeTitle(place, view.counts.length, view.options.titles)}: {seatName(seatNames, seat)}
                    </td>
                    <td>{view.lastRound!.points[seat]! > 0 ? `+${view.lastRound!.points[seat]}` : view.lastRound!.points[seat]}</td>
                    <td className="prs-total">{view.scores[seat]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {view.phase === 'roundEnd' && (
              <p className="prs-note">In der nächsten Runde gibt der Bettler dem Präsidenten seine zwei besten Karten.</p>
            )}
            {canReady ? (
              <button type="button" className="prs-button prs-button-main" onClick={() => onMove({ type: 'ready' })}>
                Nächste Runde
              </button>
            ) : (
              view.phase === 'roundEnd' && <p className="prs-note">Warte auf die anderen …</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<PresidentView, PresidentMove> = {
  Board: PresidentBoard,
  SeatSymbol: ({ className }) => <span className={className}>🃏</span>,
  seatLabel: (seat) => `Platz ${Number(seat) + 1}`,
  seatDetail: (view, seat) => {
    const title = titleOf(view, seat);
    const count = view.counts[seat] ?? 0;
    return `${title ? `${title.badge} ` : ''}${count} ${count === 1 ? 'Karte' : 'Karten'}`;
  },
  seatScore: (view, seat) => view.scores[seat] ?? 0,
  sounds: {
    played: 'karte-legen',
    passed: 'poker-check',
    trickWon: 'karte-ziehen',
    exchanged: 'karte-ziehen',
    roundStarted: 'mischen',
    out: 'ansage',
    revolution: 'ansage',
  },
};
