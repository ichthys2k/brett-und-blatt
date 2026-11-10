import { useEffect, useMemo, useState } from 'react';
import { cardRank, isJoker, rankLabel, type CardId, type DeckStyle, type SeatId } from '@brett-und-blatt/engine';
import { SeatRing, PlayingCard, RoundSummary, type RoundSummaryPlayer, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { cardValue, groupsOf, JOKER_VALUE, placeKind, placeTitle, topPlay, type PlaceKind, type PresidentMove, type PresidentView, type Titles } from '../rules';
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
  if (isJoker(card)) return 'Joker';
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

function ExchangeStage({
  view,
  names,
  me,
  deckStyle,
}: {
  view: PresidentView;
  names: string[];
  me: SeatId | null;
  deckStyle: DeckStyle;
}) {
  const currentSwap = view.swaps.find((s) => !s.done) ?? view.swaps[view.swaps.length - 1];

  return (
    <div className="prs-exchange-stage">
      <div className="prs-exchange-title">👑 Kartentausch – Runde {view.round}</div>
      <div className="prs-exchange-lanes">
        {view.swaps.map((s, idx) => {
          const isCurrent = s === currentSwap;
          const lowTitle = titleOf(view, s.low);
          const highTitle = titleOf(view, s.high);
          const iAmInvolved = me !== null && (s.low === me || s.high === me);

          return (
            <div key={idx} className={`prs-exchange-lane${isCurrent ? ' prs-lane-active' : ''}${s.done ? ' prs-lane-done' : ''}`}>
              <div className="prs-exchange-party prs-party-low">
                <span className="prs-exchange-badge">{lowTitle?.badge}</span>
                <span className="prs-exchange-role">{lowTitle?.title ?? 'Bettler'}</span>
                <span className="prs-exchange-name">{seatName(names, s.low)}</span>
              </div>

              <div className="prs-exchange-track">
                {/* Aufwärts: Bettler gibt beste Karten an Präsident */}
                <div className="prs-exchange-direction">
                  <span className="prs-exchange-label">
                    {s.count === 1 ? 'Beste Karte' : `${s.count} beste Karten`} ➔
                  </span>
                  <div className="prs-exchange-cards">
                    {(s.up.length > 0 ? s.up : Array.from({ length: s.count }, () => null)).map((card, cIdx) => (
                      <div
                        key={`up-${cIdx}`}
                        className="prs-flying-card prs-fly-up"
                        style={{ animationDelay: `${cIdx * 160}ms` }}
                      >
                        <PlayingCard
                          card={card}
                          deckStyle={deckStyle}
                          className="prs-card prs-mini-card"
                          label={iAmInvolved && card ? undefined : 'Verdeckte Karte'}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Abwärts: Präsident gibt gewählte Karten zurück */}
                {s.done ? (
                  <div className="prs-exchange-direction prs-dir-return">
                    <span className="prs-exchange-label">
                      ⬅ {s.count === 1 ? 'Rückgabe' : `${s.count} Karten Rückgabe`}
                    </span>
                    <div className="prs-exchange-cards">
                      {(s.down.length > 0 ? s.down : Array.from({ length: s.count }, () => null)).map((card, cIdx) => (
                        <div
                          key={`down-${cIdx}`}
                          className="prs-flying-card prs-fly-down"
                          style={{ animationDelay: `${cIdx * 160}ms` }}
                        >
                          <PlayingCard
                            card={card}
                            deckStyle={deckStyle}
                            className="prs-card prs-mini-card"
                            label={iAmInvolved && card ? undefined : 'Verdeckte Karte'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="prs-exchange-status">
                    {s.high === me ? 'Wähle deine Rückgabe-Karten' : `Warte auf ${seatName(names, s.high)} …`}
                  </div>
                )}
              </div>

              <div className="prs-exchange-party prs-party-high">
                <span className="prs-exchange-badge">{highTitle?.badge}</span>
                <span className="prs-exchange-role">{highTitle?.title ?? 'Präsident'}</span>
                <span className="prs-exchange-name">{seatName(names, s.high)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PresidentBoard({ view, legalMoves, onMove, viewer, seatNames, hint, table, handOnly }: BoardProps<PresidentView, PresidentMove>) {
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
    if (value === JOKER_VALUE) {
      return plays.some((m) => m.cards.length === selected.length && m.cards.every(isJoker))
        ? { type: 'play', cards: selected }
        : null;
    }
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
    if (value === JOKER_VALUE) {
      setSelected((s) => (s.includes(card) ? [] : [card]));
      return;
    }
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

  const opponents = (
    <>
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

    </>
  );

  const center = (
    <>
      <div className="prs-center">
        {view.reversed && <div className="prs-revolution">✊ Revolution – die Rangfolge ist umgekehrt</div>}
        {view.phase === 'exchange' ? (
          <ExchangeStage view={view} names={seatNames} me={me} deckStyle={deckStyle} />
        ) : (
          <div className="prs-trick">
            {previous && (
              <div className="prs-play prs-play-prev">
                {previous.cards.map((c) => (
                  <PlayingCard key={c} card={c} deckStyle={deckStyle} className="prs-card" />
                ))}
              </div>
            )}
            {top ? (
              <div className={`prs-play prs-play-top ${top.seat === me ? 'prs-from-me' : 'prs-from-opp'}`} key={top.cards.join()}>
                {top.cards.map((c) => (
                  <PlayingCard key={c} card={c} deckStyle={deckStyle} className="prs-card" />
                ))}
                <span className="prs-play-who">{top.seat === me ? 'Du' : seatName(seatNames, top.seat)}</span>
              </div>
            ) : (
              <div className="prs-empty">{view.phase === 'play' ? 'Neuer Stich' : ''}</div>
            )}
          </div>
        )}
        <div className="prs-hint" aria-live="polite">
          <Hint view={view} mine={view.phase === 'play' && view.turn === me} names={seatNames} />
        </div>
      </div>
    </>
  );

  const own = (
    <>
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

    </>
  );

  return (
    <div className="prs-table" data-around={table ? '' : undefined} data-hand={handOnly ? '' : undefined}>
      {table ? (
        <SeatRing
          seats={view.counts.length}
          bottomSeat={me ?? 0}
          status={table.status}
          bottom={own}
          renderSeat={(seat) => {
            const title = titleOf(view, seat);
            const out = view.finished.includes(seat);
            return (
              <>
                {seat !== me && (
                  <div className={`prs-opp-cards${out ? ' prs-opp-out' : ''}`}>
                    <span className="prs-mini">
                      <PlayingCard card={null} deckStyle={deckStyle} />
                    </span>
                    <b>{view.counts[seat]}</b>
                  </div>
                )}
                {table.seatChip(seat)}
                <div className="prs-opp-state">
                  {title && !out ? `${title.badge} ` : ''}
                  {out ? title?.title : view.phase === 'play' && view.passed[seat] && view.trick.length > 0 ? 'passt' : ' '}
                </div>
              </>
            );
          }}
        >
          {center}
        </SeatRing>
      ) : handOnly ? (
        // Hand-Ansicht (#100): Kartenzahlen der anderen und der Hinweis, darunter die eigene Hand; den Stich zeigt der Tisch-Bildschirm.
        <>
          {opponents}
          <div className="prs-hint" aria-live="polite">
            <Hint view={view} mine={view.phase === 'play' && view.turn === me} names={seatNames} />
          </div>
          {own}
        </>
      ) : (
        <>{opponents}{center}{own}</>
      )}
      {view.phase === 'roundEnd' && view.lastRound && (
        <RoundSummary
          title={`Runde ${view.lastRound.round} von ${view.options.rounds} beendet`}
          players={view.counts.map((_, seat) => {
            const roundChange = view.lastRound!.points[seat] ?? 0;
            const currentScore = view.scores[seat] ?? 0;
            const previousScore = currentScore - roundChange;
            const placeIndex = view.lastRound!.order.indexOf(seat);
            const badge =
              placeIndex >= 0
                ? BADGES[view.options.titles][placeKind(placeIndex, view.counts.length)]
                : undefined;
            const detail =
              placeIndex >= 0
                ? placeTitle(placeIndex, view.counts.length, view.options.titles)
                : undefined;

            return {
              seat,
              name: seatName(seatNames, seat),
              badge,
              previousScore,
              roundChange,
              currentScore,
              detail,
              isMe: seat === me,
            };
          })}
          note="In der nächsten Runde gibt der Bettler dem Präsidenten seine zwei besten Karten."
          actions={
            canReady ? (
              <button
                type="button"
                className="bub-round-summary-btn"
                onClick={() => onMove({ type: 'ready' })}
              >
                Nächste Runde
              </button>
            ) : (
              <p className="bub-round-summary-note">Warte auf die anderen …</p>
            )
          }
        />
      )}

    </div>
  );
}

export const gameUi: GameUi<PresidentView, PresidentMove> = {
  handView: true,
  Board: PresidentBoard,
  seatsAround: true,
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
    trickWon: 'stich-einsammeln',
    cleared: 'stich-einsammeln',
    exchanged: 'karten-tausch',
    roundStarted: 'mischen',
    out: 'ansage',
    revolution: () => ['revolution', 'ruf-revolution'],
  },
};
