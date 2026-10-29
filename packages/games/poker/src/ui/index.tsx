import type { CardId, SeatId } from '@brett-und-blatt/engine';
import { PlayingCard, type BoardProps, type DeckStyle, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { bestFive, describeValue } from '../eval';
import { currentPots, isLegal, raiseBounds, totalPot, type ChipTheme, type PokerMove, type PokerView } from '../rules';
import './styles.css';

const SEAT_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];

function themeUnit(theme: ChipTheme): { icon: string; name: string } {
  if (theme === 'beans') return { icon: '🫘', name: 'Bohnen' };
  if (theme === 'matches') return { icon: '🔥', name: 'Hölzer' };
  return { icon: '🪙', name: 'Chips' };
}

function streetLabel(street: PokerView['street']): string {
  switch (street) {
    case 'preflop':
      return 'Pre-Flop';
    case 'flop':
      return 'Flop';
    case 'turn':
      return 'Turn';
    case 'river':
      return 'River';
    case 'complete':
      return 'Beendet';
  }
}

function structureLabel(structure: PokerView['structure']): string {
  if (structure === 'pl') return 'Pot Limit';
  if (structure === 'fl') return 'Fixed Limit';
  return 'No Limit';
}

/** Berechnet die Position (in %) eines Platzes auf dem ovalen Tisch, gedreht sodass `hero` unten (6 Uhr) sitzt. */
function seatCoordinates(seatIndex: number, totalSeats: number, hero: number): { left: string; top: string } {
  const rel = (seatIndex - hero + totalSeats) % totalSeats;
  // Winkel: 0 = unten (Math.PI / 2), im Uhrzeigersinn um den Tisch.
  const angle = Math.PI / 2 + (rel / totalSeats) * Math.PI * 2;
  const rx = 42;
  const ry = 40;
  const x = 50 + Math.cos(angle) * rx;
  const y = 50 + Math.sin(angle) * ry;
  return { left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%` };
}

const HAND_RANKINGS = [
  { name: 'Royal Flush', desc: 'A–K–D–B–10 in einer Farbe (höchster Straight Flush)' },
  { name: 'Straight Flush', desc: 'Fünf aufeinanderfolgende Karten derselben Farbe' },
  { name: 'Vierling', desc: 'Vier Karten desselben Rangs (z. B. 4× Dame)' },
  { name: 'Full House', desc: 'Drilling plus Paar (z. B. 3× Zehn und 2× Ass)' },
  { name: 'Flush', desc: 'Fünf beliebige Karten derselben Farbe' },
  { name: 'Straße', desc: 'Fünf aufeinanderfolgende Ränge (Ass zählt hoch oder als 1)' },
  { name: 'Drilling', desc: 'Drei Karten desselben Rangs' },
  { name: 'Zwei Paare', desc: 'Zwei verschiedene Paare plus Beikarte' },
  { name: 'Paar', desc: 'Zwei Karten desselben Rangs' },
  { name: 'Höchste Karte', desc: 'Keine Kombination – die höchste Einzelkarte entscheidet' },
];

function Board({
  view,
  legalMoves,
  onMove,
  activeSeat,
  hint,
  viewer,
  seatNames,
  humanSeats,
  canJoinSeat,
  onJoinSeat,
  canLeaveSeat,
  onLeaveSeat,
}: BoardProps<PokerView, PokerMove>) {
  const isHotseatMulti = humanSeats !== undefined && humanSeats.length > 1;
  const heroSeat: SeatId = typeof viewer === 'number' ? viewer : (activeSeat ?? 0);
  const mySeatObj = typeof viewer === 'number' ? view.seats[viewer] : undefined;
  const isMyTurn = typeof viewer === 'number' && activeSeat === viewer && legalMoves.length > 0;

  const [peeking, setPeeking] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showLastHand, setShowLastHand] = useState(false);

  const bounds = typeof viewer === 'number' ? raiseBounds(view, viewer) : { canRaise: false, minTo: 0, maxTo: 0, maxByStack: 0 };
  const [sliderValue, setSliderValue] = useState<number>(bounds.minTo);

  useEffect(() => {
    setSliderValue(bounds.minTo);
  }, [bounds.minTo, bounds.maxTo, view.handNumber, view.street, view.currentBet, activeSeat]);

  useEffect(() => {
    setPeeking(false);
  }, [activeSeat, view.handNumber]);

  const deckStyle: DeckStyle = view.deckStyle;
  const unit = themeUnit(view.theme);
  const potTotal = totalPot(view);
  const pots = currentPots(view);

  const showMyHoleCards = mySeatObj && mySeatObj.holeCards.length > 0 && (!isHotseatMulti || peeking || mySeatObj.revealed);
  const myBest =
    showMyHoleCards && mySeatObj && mySeatObj.holeCards.length >= 2
      ? bestFive([...mySeatObj.holeCards, ...view.board])
      : null;
  const highlightCards = new Set<CardId>(myBest?.cards ?? []);

  const toCall = mySeatObj ? Math.max(0, view.currentBet - mySeatObj.streetBet) : 0;

  // Tastaturkürzel (F = Passen, C = Schieben/Mitgehen, A = All-in, Enter = Setzen/Erhöhen).
  useEffect(() => {
    if (!isMyTurn || typeof viewer !== 'number') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 'f' && toCall > 0) {
        e.preventDefault();
        onMove({ type: 'fold' });
      } else if (key === 'c') {
        e.preventDefault();
        if (toCall === 0) onMove({ type: 'check' });
        else if (mySeatObj && mySeatObj.chips > toCall) onMove({ type: 'call' });
        else onMove({ type: 'allIn' });
      } else if (key === 'a') {
        const move: PokerMove = { type: 'allIn' };
        if (isLegal(view, viewer, move)) {
          e.preventDefault();
          onMove(move);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMyTurn, viewer, toCall, mySeatObj, view, onMove]);

  const canAddExtraSeat = view.seats.length < 10 && Boolean(canJoinSeat?.(view.seats.length)) && Boolean(onJoinSeat);

  const submitRaiseOrBet = (targetAmount: number) => {
    if (typeof viewer !== 'number') return;
    const clamped = Math.max(bounds.minTo, Math.min(bounds.maxTo, Math.round(targetAmount)));
    if (clamped >= bounds.maxByStack) {
      const allInMove: PokerMove = { type: 'allIn' };
      if (isLegal(view, viewer, allInMove)) onMove(allInMove);
      return;
    }
    const move: PokerMove = view.currentBet === 0 ? { type: 'bet', amount: clamped } : { type: 'raise', to: clamped };
    if (isLegal(view, viewer, move)) onMove(move);
  };

  return (
    <div className="poker-root">
      {/* Kopfzeile mit Blind-Stufe, Handnummer, letzter Hand und Ranglisten-Knopf */}
      <div className="poker-topbar">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            Hand #{view.handNumber}/{view.maxHands}
          </span>
          <span className="text-muted">·</span>
          <span>
            {structureLabel(view.structure)} · Blinds {view.smallBlind}/{view.bigBlind}
            {view.ante > 0 ? ` (Ante ${view.ante})` : ''}
          </span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
            {streetLabel(view.street)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {view.lastHand && (
            <button
              type="button"
              onClick={() => setShowLastHand(!showLastHand)}
              className="cursor-pointer rounded-lg border border-line bg-bg px-2 py-1 text-xs font-medium hover:border-accent"
            >
              📜 Hand #{view.lastHand.handNumber}
            </button>
          )}
          {canAddExtraSeat && (
            <button
              type="button"
              onClick={() => onJoinSeat?.(view.seats.length, 'human')}
              className="poker-join-btn"
              title="Weiteren Platz am Tisch einnehmen (spielt ab nächster Hand mit)"
            >
              + Platz ({view.seats.length + 1}/10)
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRankings(!showRankings)}
            className="cursor-pointer rounded-lg border border-line bg-bg px-2 py-1 text-xs font-medium hover:border-accent"
          >
            🏆 Hände
          </button>
        </div>
      </div>

      {/* Rückblick auf die letzte Hand */}
      {showLastHand && view.lastHand && (
        <div className="rounded-xl border border-line bg-surface p-2.5 text-xs shadow-sm">
          <div className="flex items-center justify-between font-semibold">
            <span>
              Ergebnis Hand #{view.lastHand.handNumber} ({view.lastHand.showdown ? 'Showdown' : 'Alle anderen gepasst'}):
            </span>
            <button type="button" className="cursor-pointer text-muted hover:text-ink" onClick={() => setShowLastHand(false)}>
              ✕
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {view.lastHand.pots.map((p) => (
              <span key={p.potIndex} className="rounded bg-bg px-2 py-0.5">
                {p.potIndex === 0 ? 'Pot' : `Side-Pot ${p.potIndex}`}: <strong>{p.amount} {unit.icon}</strong> →{' '}
                {p.winners.map((w) => seatNames[w] ?? `Platz ${w + 1}`).join(', ')}
              </span>
            ))}
          </div>
          {view.lastHand.shownHands.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-3 text-muted">
              {view.lastHand.shownHands.map((sh) => (
                <span key={sh.seat}>
                  <strong>{seatNames[sh.seat] ?? `Platz ${sh.seat + 1}`}:</strong> {sh.handName} ({sh.cards.join(' ')})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ovaler Pokertisch */}
      <div className="poker-arena">
        <div className="poker-table-felt" role="region" aria-label="Pokertisch">
          {/* Tischmitte: Pot und 5 Gemeinschaftskarten */}
          <div className="poker-center">
            <div className="poker-pot-pill" aria-live="polite">
              Pot: {potTotal} {unit.icon}
            </div>
            {pots.length > 1 && (
              <div className="poker-sidepots">
                {pots.map((p, idx) => (
                  <span key={idx} className="poker-sidepot-tag">
                    {idx === 0 ? 'Hauptpot' : `Side ${idx}`}: {p.amount}
                  </span>
                ))}
              </div>
            )}
            <div className="poker-board-row" aria-label="Gemeinschaftskarten">
              {[0, 1, 2, 3, 4].map((idx) => {
                const card = view.board[idx] ?? null;
                const isBest = card !== null && highlightCards.has(card);
                return (
                  <div key={idx} className={`poker-board-slot ${isBest ? 'poker-board-slot-highlight' : ''}`}>
                    {card ? <PlayingCard card={card} deckStyle={deckStyle} anim="deal" /> : null}
                  </div>
                );
              })}
            </div>
            {view.lastHand && !showLastHand && (
              <div className="text-[11px] text-amber-200/90">
                Letzte Hand #{view.lastHand.handNumber}:{' '}
                {view.lastHand.pots
                  .map((p) => `${p.winners.map((w) => seatNames[w] ?? `P${w + 1}`).join('/')} (+${p.amount})`)
                  .join(', ')}
              </div>
            )}
          </div>

          {/* Plätze rings um den Tisch */}
          {view.seats.map((s) => {
            const pos = seatCoordinates(s.seat, view.seats.length, heroSeat);
            const isTurn = activeSeat === s.seat && view.street !== 'complete';
            const name = seatNames[s.seat] ?? `Platz ${s.seat + 1}`;
            const joinable = Boolean(canJoinSeat?.(s.seat)) && Boolean(onJoinSeat);

            if (s.status === 'empty') {
              return (
                <div key={s.seat} className="poker-seat-node" style={pos}>
                  <div className="poker-seat-box poker-seat-box-empty">
                    <span className="text-[11px] text-slate-300">Freier Platz {s.seat + 1}</span>
                    {joinable && (
                      <div className="mt-1 flex gap-1">
                        <button
                          type="button"
                          className="poker-join-btn"
                          onClick={() => onJoinSeat?.(s.seat, 'human')}
                        >
                          + Hinsetzen
                        </button>
                        {humanSeats !== undefined && (
                          <button
                            type="button"
                            className="poker-join-btn"
                            style={{ background: 'rgba(59, 130, 246, 0.85)' }}
                            onClick={() => onJoinSeat?.(s.seat, 'bot')}
                          >
                            + Bot
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const isDealer = view.button === s.seat;
            const isSb = view.smallBlindSeat === s.seat;
            const isBb = view.bigBlindSeat === s.seat;

            return (
              <div key={s.seat} className="poker-seat-node" style={pos}>
                {/* Einsatz-Blase vor dem Platz */}
                {s.streetBet > 0 && (
                  <div className="poker-bet-bubble">
                    {s.streetBet} {unit.icon}
                  </div>
                )}

                {/* Karten am Platz (für andere Plätze verdeckt bzw. beim Showdown offen) */}
                {s.seat !== viewer && s.inHand && !s.folded && (
                  <div className="poker-mini-cards">
                    {s.revealed && s.holeCards.length === 2 ? (
                      s.holeCards.map((c) => (
                        <div key={c} className="poker-mini-card-showdown">
                          <PlayingCard card={c} deckStyle={deckStyle} />
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="poker-mini-card">
                          <PlayingCard card={null} deckStyle={deckStyle} />
                        </div>
                        <div className="poker-mini-card">
                          <PlayingCard card={null} deckStyle={deckStyle} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div
                  className={`poker-seat-box ${isTurn ? 'poker-seat-box-active' : ''} ${
                    s.folded && s.status === 'active' ? 'poker-seat-box-folded' : ''
                  }`}
                >
                  <div className="poker-seat-badges">
                    {isDealer && <span className="poker-role-badge" title="Dealer">D</span>}
                    {isSb && <span className="poker-role-badge poker-role-sb" title="Small Blind">SB</span>}
                    {isBb && <span className="poker-role-badge poker-role-bb" title="Big Blind">BB</span>}
                    <span className="truncate font-semibold">{name}</span>
                  </div>
                  <div className="text-[11px] text-amber-300 font-semibold">
                    {s.chips} {unit.icon}
                  </div>
                  {s.status === 'waiting' && (
                    <span className="mt-0.5 rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                      ⏳ Ab nächster Hand
                    </span>
                  )}
                  {s.status === 'eliminated' && (
                    <div className="mt-0.5 flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-rose-300">Ausgeschieden {s.place ? `(#${s.place})` : ''}</span>
                      {joinable && (
                        <button type="button" className="poker-join-btn" onClick={() => onJoinSeat?.(s.seat, 'human')}>
                          ↻ Neu einsteigen
                        </button>
                      )}
                    </div>
                  )}
                  {s.status === 'active' && s.lastAction && (
                    <span className="text-[10px] text-slate-300">{s.lastAction}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unterer Bereich: Eigene Handkarten, Lernhilfe, Ein-/Ausstieg und Setz-Steuerung */}
      <div className="poker-controls">
        <div className="poker-hand-row">
          <div className="flex items-center gap-3">
            {mySeatObj && mySeatObj.inHand && (
              <div className="poker-my-cards" aria-label="Deine Handkarten">
                {[0, 1].map((idx) => {
                  const card = showMyHoleCards ? (mySeatObj.holeCards[idx] ?? null) : null;
                  const isBest = card !== null && highlightCards.has(card);
                  return (
                    <div key={idx} className={`poker-my-card ${isBest ? 'poker-board-slot-highlight rounded-md' : ''}`}>
                      <PlayingCard card={card} deckStyle={deckStyle} />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-1">
              {mySeatObj ? (
                <>
                  <div className="text-sm font-semibold">
                    {seatNames[mySeatObj.seat] ?? `Platz ${mySeatObj.seat + 1}`} ·{' '}
                    <span className="text-accent">
                      {mySeatObj.chips} {unit.name}
                    </span>
                  </div>
                  {mySeatObj.status === 'waiting' && (
                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ⏳ Du bist vorgemerkt und spielst ab der nächsten Hand automatisch mit!
                    </div>
                  )}
                  {view.aid === 'name' && myBest && (
                    <div className="text-xs font-medium text-muted">
                      Aktuelle Hand: <strong className="text-ink">{describeValue(myBest.value)}</strong>
                    </div>
                  )}
                  {hint && isMyTurn && (
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      💡 Tipp:{' '}
                      {hint.type === 'fold'
                        ? 'Passen'
                        : hint.type === 'check'
                          ? 'Schieben'
                          : hint.type === 'call'
                            ? `Mitgehen (${toCall})`
                            : hint.type === 'allIn'
                              ? 'All-in'
                              : hint.type === 'bet'
                                ? `Setzen auf ${hint.amount}`
                                : hint.type === 'raise'
                                  ? `Erhöhen auf ${hint.to}`
                                  : ''}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-muted">
                  Du schaust gerade zu. Klicke auf einen freien Platz am Tisch, um in der nächsten Hand mitzuspielen!
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isHotseatMulti && mySeatObj && mySeatObj.inHand && !mySeatObj.revealed && (
              <button
                type="button"
                className="cursor-pointer select-none rounded-xl border border-line bg-bg px-3 py-2 text-xs font-semibold shadow-sm active:bg-accent/15"
                onPointerDown={() => setPeeking(true)}
                onPointerUp={() => setPeeking(false)}
                onPointerLeave={() => setPeeking(false)}
                onPointerCancel={() => setPeeking(false)}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setPeeking(true)}
                onKeyUp={() => setPeeking(false)}
              >
                👁️ {peeking ? 'Karten sichtbar' : 'Karten ansehen (halten)'}
              </button>
            )}

            {typeof viewer === 'number' && canLeaveSeat?.(viewer) && onLeaveSeat && (
              <button
                type="button"
                onClick={() => onLeaveSeat(viewer)}
                className="cursor-pointer rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-medium text-muted hover:border-danger hover:text-danger"
                title="Laufende Hand passen und den Platz am Tisch freigeben"
              >
                🚶 Aufstehen
              </button>
            )}
          </div>
        </div>

        {/* Aktionsleiste für den Spieler am Zug */}
        {isMyTurn && mySeatObj && (
          <div className="flex flex-col gap-2 border-t border-line pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {toCall > 0 && (
                <button
                  type="button"
                  onClick={() => onMove({ type: 'fold' })}
                  className="cursor-pointer rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-500/25 dark:text-rose-300"
                >
                  Passen (Fold)
                </button>
              )}

              {toCall === 0 ? (
                <button
                  type="button"
                  onClick={() => onMove({ type: 'check' })}
                  className="cursor-pointer rounded-xl border border-sky-500/40 bg-sky-500/15 px-3.5 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-500/25 dark:text-sky-200"
                >
                  Schieben (Check)
                </button>
              ) : mySeatObj.chips > toCall ? (
                <button
                  type="button"
                  onClick={() => onMove({ type: 'call' })}
                  className="cursor-pointer rounded-xl border border-sky-500/40 bg-sky-500/15 px-3.5 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-500/25 dark:text-sky-200"
                >
                  Mitgehen (+{toCall} {unit.icon})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onMove({ type: 'allIn' })}
                  className="cursor-pointer rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
                >
                  All-in mitgehen ({mySeatObj.chips} {unit.icon})
                </button>
              )}

              {bounds.canRaise && (
                <>
                  {bounds.minTo < bounds.maxByStack && (
                    <button
                      type="button"
                      onClick={() => submitRaiseOrBet(sliderValue)}
                      className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-500"
                    >
                      {view.currentBet === 0 ? `Setzen: ${sliderValue}` : `Erhöhen auf ${sliderValue}`} {unit.icon}
                    </button>
                  )}

                  {bounds.maxTo >= bounds.maxByStack && (
                    <button
                      type="button"
                      onClick={() => onMove({ type: 'allIn' })}
                      className="cursor-pointer rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
                    >
                      All-in ({bounds.maxByStack} {unit.icon})
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Schieberegler und Schnellwahl-Knöpfe für freie Einsatzgrößen */}
            {bounds.canRaise && view.structure !== 'fl' && bounds.minTo < bounds.maxTo && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Einsatz verringern"
                    onClick={() => setSliderValue((v) => Math.max(bounds.minTo, v - view.bigBlind))}
                    className="cursor-pointer rounded-lg border border-line bg-bg px-2.5 py-1 text-sm font-bold"
                  >
                    −
                  </button>
                  <label htmlFor="poker-bet-slider" className="sr-only">
                    Einsatzhöhe wählen
                  </label>
                  <input
                    id="poker-bet-slider"
                    type="range"
                    className="poker-slider"
                    min={bounds.minTo}
                    max={bounds.maxTo}
                    step={Math.max(1, view.smallBlind)}
                    value={sliderValue}
                    aria-valuetext={`${sliderValue} ${unit.name}`}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    aria-label="Einsatz erhöhen"
                    onClick={() => setSliderValue((v) => Math.min(bounds.maxTo, v + view.bigBlind))}
                    className="cursor-pointer rounded-lg border border-line bg-bg px-2.5 py-1 text-sm font-bold"
                  >
                    +
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Min', val: bounds.minTo },
                    { label: '½ Pot', val: view.currentBet + toCall + Math.round((potTotal + toCall) * 0.5) },
                    { label: '¾ Pot', val: view.currentBet + toCall + Math.round((potTotal + toCall) * 0.75) },
                    { label: 'Pot', val: view.currentBet + toCall + (potTotal + toCall) },
                    { label: 'Max', val: bounds.maxTo },
                  ].map((preset) => {
                    const clamped = Math.max(bounds.minTo, Math.min(bounds.maxTo, preset.val));
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSliderValue(clamped)}
                        className={`cursor-pointer rounded-lg border px-2 py-0.5 text-xs font-medium ${
                          sliderValue === clamped ? 'border-accent bg-accent/15 text-accent font-semibold' : 'border-line bg-bg text-muted hover:text-ink'
                        }`}
                      >
                        {preset.label} ({clamped})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Rangfolge der Pokerhände */}
      {showRankings && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowRankings(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Rangfolge der Pokerhände"
          >
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-base font-bold">🏆 Rangfolge der Hände (hoch → niedrig)</h2>
              <button type="button" className="cursor-pointer px-2 text-lg text-muted hover:text-ink" onClick={() => setShowRankings(false)}>
                ✕
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-xs">
              {HAND_RANKINGS.map((h, i) => (
                <li key={h.name} className="flex items- baseline justify-between gap-3 rounded-lg bg-bg p-2">
                  <span className="font-bold text-ink">
                    {i + 1}. {h.name}
                  </span>
                  <span className="text-right text-muted">{h.desc}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  const color = SEAT_COLORS[seat % SEAT_COLORS.length] ?? '#2563eb';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ backgroundColor: color, width: '1.35rem', height: '1.35rem', fontSize: '0.7rem' }}
      aria-hidden="true"
    >
      {seat + 1}
    </span>
  );
}

export const gameUi: GameUi<PokerView, PokerMove> = {
  Board,
  SeatSymbol,
  sounds: {
    deal: 'fs-mischen',
    blindLevelUp: 'schach',
    street: (event) =>
      event.street === 'flop' || event.street === 'runout'
        ? ['drachen-karte-ziehen', 'karte-ziehen']
        : 'drachen-karte-ziehen',
    check: 'poker-check',
    fold: 'poker-fold',
    call: 'poker-call',
    bet: 'poker-bet',
    raise: () => ['poker-raise', 'fs-pop'],
    allIn: () => ['poker-all-in', 'fs-auszahlung'],
    handEnd: (event) =>
      event.showdown
        ? ['aufdecken', 'stapel-fertig', 'fs-auszahlung']
        : ['fs-auszahlung', 'paar'],
    eliminated: 'leben-weg',
    joined: 'stein-heraus',
    left: 'karte-legen',
  },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const s = view.seats[seat];
    if (!s) return null;
    if (s.status === 'empty') return 'Frei';
    if (s.status === 'waiting') return `${s.chips} · ab nächster Hand`;
    if (s.status === 'eliminated') return s.place ? `Platz #${s.place}` : 'Ausgeschieden';
    const role = view.button === seat ? ' · D' : view.smallBlindSeat === seat ? ' · SB' : view.bigBlindSeat === seat ? ' · BB' : '';
    return `${s.chips}${role}`;
  },
};
