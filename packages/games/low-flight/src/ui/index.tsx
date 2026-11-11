import { useEffect, useRef, useState } from 'react';
import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { GameCard, RoundSummary, getNoteField, useCardCosmetics, useCardOverride, type BoardProps, type GameUi, type RoundSummaryPlayer } from '@brett-und-blatt/ui';
import { hiddenSlots, openSum, type LowFlightMove, type LowFlightView } from '../rules';
import './styles.css';

type ViewCell = LowFlightView['players'][number]['grid'][number];

const FRUITS: Record<number, string> = { 1: '🍒', 2: '🍓', 3: '🍋', 4: '🍎', 5: '🍉' };
const FRUIT_NAMES: Record<number, string> = { 1: 'Kirsche', 2: 'Erdbeere', 3: 'Zitrone', 4: 'Apfel', 5: 'Melone' };

/** Farbstufe nach Wert – die Zahl steht trotzdem immer groß drauf. */
function tone(value: number, junior: boolean): string {
  if (junior) return `lf-fruit-${value}`;
  if (value < 0) return 'lf-tone-neg';
  if (value === 0) return 'lf-tone-zero';
  if (value <= 4) return 'lf-tone-low';
  if (value <= 8) return 'lf-tone-mid';
  return 'lf-tone-high';
}

function valueLabel(value: number, junior: boolean): string {
  return junior ? `${FRUIT_NAMES[value]} (${value})` : String(value);
}

export function Card({
  value,
  knownValue,
  junior,
  hidden,
  label,
  className = '',
  onClick,
}: {
  value: number | null;
  knownValue?: number;
  junior: boolean;
  hidden?: boolean;
  label?: string;
  className?: string;
  onClick?: () => void;
}) {
  const cosmetics = useCardCosmetics();
  const isHidden = hidden || value === null;

  const overrideNote =
    value !== null
      ? useCardOverride(`tiefflug:${value}`) ?? useCardOverride(String(value))
      : undefined;

  const text = label ?? (isHidden ? (typeof knownValue === 'number' ? `verdeckte Karte (gemerkt: ${knownValue})` : 'verdeckte Karte') : valueLabel(value, junior));
  const toneClass = !isHidden ? tone(value, junior) : '';
  const frameAsset = getNoteField(overrideNote, 12) || getNoteField(overrideNote, 30);
  const overrideVal = getNoteField(overrideNote, 3) || getNoteField(overrideNote, 4);

  const face = isHidden ? null : junior ? (
    <>
      <span className="lf-num">{overrideVal || value}</span>
      <span className="lf-fruits" aria-hidden="true">
        {FRUITS[value]!.repeat(value)}
      </span>
    </>
  ) : (
    <>
      <span className="lf-corner">{overrideVal || value}</span>
      <span className="lf-num">{overrideVal || value}</span>
    </>
  );

  return (
    <GameCard
      faceDown={isHidden}
      cardBackProps={{ design: cosmetics.cardBack, crest: cosmetics.crest }}
      frameAsset={frameAsset}
      className={`lf-card ${isHidden ? 'lf-card-hidden' : toneClass} ${className} lf-gamecard`}
      label={text}
      onClick={onClick}
    >
      {face}
      {isHidden && typeof knownValue === 'number' && (
        <span className="lf-memo-badge" title={`Gespäht: ${knownValue}`}>
          👁️ {knownValue}
        </span>
      )}
    </GameCard>
  );
}

function Grid({
  grid,
  cols,
  junior,
  fresh,
  canTap,
  onTap,
  small,
  hintSlot = null,
  knownMap,
  selectedSlot = null,
}: {
  grid: ViewCell[];
  cols: number;
  junior: boolean;
  fresh: Set<number>;
  canTap?: (slot: number) => boolean;
  onTap?: (slot: number) => void;
  small?: boolean;
  hintSlot?: number | null;
  knownMap?: Map<number, number>;
  selectedSlot?: number | null;
}) {
  return (
    <div className={`lf-grid${small ? ' lf-grid-small' : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {grid.map((cell, slot) =>
        cell ? (
          <Card
            key={slot}
            value={cell.open ? cell.value : null}
            knownValue={cell.open ? undefined : knownMap?.get(slot)}
            junior={junior}
            className={`${fresh.has(slot) ? 'lf-fresh' : ''}${canTap?.(slot) ? ' lf-tap' : ''}${hintSlot === slot ? ' lf-hint' : ''}${selectedSlot === slot ? ' lf-selected' : ''}`}
            onClick={canTap?.(slot) && onTap ? () => onTap(slot) : undefined}
          />
        ) : (
          <div key={slot} className="lf-gone" aria-label="abgeräumt" />
        ),
      )}
    </div>
  );
}

/** Welche Felder eines Platzes sich im letzten Zug geändert haben (für die Aufdeck-Animation). */
function freshSlots(events: GameEvent[], seat: SeatId): Set<number> {
  const set = new Set<number>();
  for (const e of events) {
    const ev = e as { type: string; seat?: number; slot?: number };
    if (ev.seat === seat && typeof ev.slot === 'number' && ['revealed', 'flipped', 'swapped'].includes(ev.type)) set.add(ev.slot);
  }
  return set;
}

function name(names: string[], seat: SeatId): string {
  return names[seat] ?? `Platz ${seat + 1}`;
}

export function LowFlightBoard({ view, legalMoves, onMove, viewer, activeSeat, seatNames, events, hint, handOnly, display }: BoardProps<LowFlightView, LowFlightMove>) {
  const junior = view.options.variant === 'junior';
  // Am geteilten Gerät gilt der Platz, der gerade handelt; während Bot-Zügen bleibt der letzte Mensch unten.
  const lastMe = useRef<SeatId>(0);
  if (typeof viewer === 'number') lastMe.current = viewer;
  // Tisch-Bildschirm (#100): Wer gerade dran ist, sitzt unten und groß, die anderen klein darüber.
  const me = display ? view.turn : lastMe.current;
  const myTurn = activeSeat === me && legalMoves.length > 0;
  const [discarding, setDiscarding] = useState(false);
  const [actionState, setActionState] = useState<
    | { type: 'none' }
    | { type: 'peek' }
    | { type: 'swap'; mySlot?: number }
    | { type: 'doubleFlip'; firstSlot?: number }
  >({ type: 'none' });

  useEffect(() => {
    setDiscarding(false);
    setActionState({ type: 'none' });
  }, [view.drawn, view.turn]);

  const has = (type: LowFlightMove['type'], slot?: number) => legalMoves.some((m) => m.type === type && (slot === undefined || ('slot' in m && m.slot === slot)));
  const top = view.discard[view.discard.length - 1];
  const mine = view.players[me]!;
  const drawnFromDeck = view.drawn?.from === 'deck';
  const hintSlot = hint && 'slot' in hint ? hint.slot : null;

  function getKnownMap(seat: SeatId): Map<number, number> {
    const map = new Map<number, number>();
    if (view.knownCards) {
      for (const k of view.knownCards) {
        if (k.targetSeat === seat) map.set(k.slot, k.value);
      }
    }
    return map;
  }

  function tapSlot(slot: number) {
    if (view.phase === 'reveal') return onMove({ type: 'reveal', slot });
    if (!view.drawn) return;
    if (actionState.type === 'peek') {
      return onMove({ type: 'actionPeek', targetSeat: me, slot });
    }
    if (actionState.type === 'swap') {
      if (actionState.mySlot === undefined) {
        return setActionState({ type: 'swap', mySlot: slot });
      }
    }
    if (actionState.type === 'doubleFlip') {
      if (actionState.firstSlot === undefined) {
        if (hiddenSlots(mine.grid).length <= 1) {
          return onMove({ type: 'actionDoubleFlip', slot1: slot, slot2: slot });
        }
        return setActionState({ type: 'doubleFlip', firstSlot: slot });
      } else {
        return onMove({ type: 'actionDoubleFlip', slot1: actionState.firstSlot, slot2: slot });
      }
    }
    if (discarding && has('flip', slot)) return onMove({ type: 'flip', slot });
    if (has('swap', slot)) onMove({ type: 'swap', slot });
  }

  const canTap = (slot: number) => {
    if (!myTurn) return false;
    if (view.phase === 'reveal') return has('reveal', slot);
    if (!view.drawn) return false;
    if (actionState.type === 'peek') {
      return legalMoves.some((m) => m.type === 'actionPeek' && m.targetSeat === me && m.slot === slot);
    }
    if (actionState.type === 'swap') {
      return actionState.mySlot === undefined && mine.grid[slot] !== null;
    }
    if (actionState.type === 'doubleFlip') {
      const isHidden = mine.grid[slot] && !mine.grid[slot]!.open;
      if (actionState.firstSlot === undefined) return Boolean(isHidden);
      return Boolean(isHidden && slot !== actionState.firstSlot);
    }
    return discarding ? has('flip', slot) : has('swap', slot);
  };

  function tapOppSlot(oppSeat: SeatId, slot: number) {
    if (!myTurn || !view.drawn) return;
    if (actionState.type === 'peek') {
      return onMove({ type: 'actionPeek', targetSeat: oppSeat, slot });
    }
    if (actionState.type === 'swap' && actionState.mySlot !== undefined) {
      return onMove({ type: 'actionSwap', mySlot: actionState.mySlot, targetSeat: oppSeat, targetSlot: slot });
    }
  }

  function canTapOppSlot(oppSeat: SeatId, slot: number) {
    if (!myTurn || !view.drawn) return false;
    if (actionState.type === 'peek') {
      return legalMoves.some((m) => m.type === 'actionPeek' && m.targetSeat === oppSeat && m.slot === slot);
    }
    if (actionState.type === 'swap' && actionState.mySlot !== undefined) {
      return legalMoves.some(
        (m) => m.type === 'actionSwap' && m.mySlot === actionState.mySlot && m.targetSeat === oppSeat && m.targetSlot === slot,
      );
    }
    return false;
  }

  function tapDiscard() {
    if (!myTurn) return;
    if (!view.drawn && has('takeDiscard')) onMove({ type: 'takeDiscard' });
    else if (drawnFromDeck) {
      if (has('discardDrawn')) onMove({ type: 'discardDrawn' });
      else {
        setActionState({ type: 'none' });
        setDiscarding((d) => !d);
      }
    }
  }

  let status = '';
  if (view.phase === 'reveal') {
    const need = junior ? 1 : 2;
    status = myTurn ? `Decke ${need === 1 ? 'eine Karte' : 'zwei Karten'} auf.` : `${name(seatNames, view.turn)} deckt auf …`;
  } else if (view.phase === 'turn') {
    if (!myTurn) status = `${name(seatNames, view.turn)} ist dran …`;
    else if (!view.drawn) status = 'Ziehe vom Stapel oder nimm die Ablagekarte.';
    else if (actionState.type === 'peek') status = 'Aktion Spähen: Wähle eine beliebige verdeckte Karte zum Ansehen.';
    else if (actionState.type === 'swap') status = actionState.mySlot === undefined ? 'Aktion Tauschen: Wähle zuerst eine eigene Karte.' : 'Aktion Tauschen: Wähle nun eine gegnerische Karte.';
    else if (actionState.type === 'doubleFlip') status = actionState.firstSlot === undefined ? 'Aktion Doppel-Aufdecken: Wähle die erste verdeckte Karte.' : 'Aktion Doppel-Aufdecken: Wähle die zweite verdeckte Karte.';
    else if (discarding) status = 'Decke eine verdeckte Karte auf.';
    else if (drawnFromDeck) status = 'Tausche die Karte gegen eine eigene – oder wähle eine Aktion / tippe auf die Ablage.';
    else status = 'Tausche die Karte gegen eine eigene.';
    if (view.ender !== null) status = `Letzte Runde (${name(seatNames, view.ender)} hat alles aufgedeckt). ${status}`;
  }

  if (view.lastPeek) {
    const peekInfo =
      view.lastPeek.peeker === me
        ? `👁️ Du hast Karte ${view.lastPeek.slot + 1} von ${name(seatNames, view.lastPeek.targetSeat)} erspäht: Wert ${view.lastPeek.value}.`
        : `👁️ ${name(seatNames, view.lastPeek.peeker)} hat eine Karte von ${name(seatNames, view.lastPeek.targetSeat)} erspäht.`;
    status = status ? `${status} (${peekInfo})` : peekInfo;
  }

  const others = view.players.map((_, s) => s).filter((s) => s !== me);
  const ordered = [...others.filter((s) => s > me), ...others.filter((s) => s < me)];

  return (
    <div className={`lf-table${junior ? ' lf-junior' : ''}`} data-crowded={view.players.length > 4 || undefined} data-hand={handOnly ? '' : undefined}>
      <div className="lf-others">
        {ordered.map((seat) => {
          const p = view.players[seat]!;
          return (
            <div key={seat} className={`lf-other${view.turn === seat && view.phase !== 'roundEnd' ? ' lf-active' : ''}`}>
              <div className="lf-other-head">
                <span className="lf-other-name">{name(seatNames, seat)}</span>
                <span className="lf-sum" title="Summe der offenen Karten">
                  Σ {openSum(p.grid)}
                </span>
              </div>
              {!handOnly && (
                <Grid
                  grid={p.grid}
                  cols={view.cols}
                  junior={junior}
                  fresh={freshSlots(events, seat)}
                  knownMap={getKnownMap(seat)}
                  canTap={(slot) => canTapOppSlot(seat, slot)}
                  onTap={(slot) => tapOppSlot(seat, slot)}
                  small
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="lf-center">
        <div className="lf-pile">
          <Card
            value={null}
            junior={junior}
            hidden
            label={`Nachziehstapel, ${view.deckCount} Karten`}
            className={`${myTurn && has('draw') ? 'lf-tap' : ''}${hint?.type === 'draw' ? ' lf-hint' : ''}`}
            onClick={myTurn && has('draw') ? () => onMove({ type: 'draw' }) : undefined}
          />
          <span>Stapel ({view.deckCount})</span>
        </div>
        <div className="lf-pile">
          {view.drawn ? (
            <Card value={view.drawn.value} junior={junior} className="lf-drawn" label={`Gezogen: ${valueLabel(view.drawn.value, junior)}`} />
          ) : (
            <div className="lf-slot" />
          )}
          <span>{view.drawn ? (view.turn === me ? 'Deine Karte' : 'Gezogen') : ' '}</span>
        </div>
        <div className="lf-pile">
          {top !== undefined ? (
            <Card
              value={top}
              junior={junior}
              label={`Ablage: ${valueLabel(top, junior)}`}
              className={`${myTurn && ((!view.drawn && has('takeDiscard')) || drawnFromDeck) ? 'lf-tap' : ''}${discarding ? ' lf-armed' : ''}${hint?.type === 'takeDiscard' ? ' lf-hint' : ''}`}
              onClick={myTurn && ((!view.drawn && has('takeDiscard')) || drawnFromDeck) ? tapDiscard : undefined}
            />
          ) : (
            <div className="lf-slot" />
          )}
          <span>Ablage</span>
        </div>
      </div>

      <div className="lf-status" aria-live="polite">
        {status}
      </div>

      <div className={`lf-mine${view.turn === me && view.phase !== 'roundEnd' ? ' lf-active' : ''}`}>
        <div className="lf-other-head">
          <span className="lf-other-name">{name(seatNames, me)}</span>
          <span className="lf-sum">Σ {openSum(mine.grid)} offen</span>
          {myTurn && drawnFromDeck && (
            <div className="lf-action-controls">
              {hiddenSlots(mine.grid).length > 0 && (
                <button
                  type="button"
                  className={`lf-button${discarding ? ' lf-button-on' : ''}`}
                  onClick={() => {
                    setActionState({ type: 'none' });
                    setDiscarding((d) => !d);
                  }}
                >
                  {discarding ? 'Doch tauschen' : 'Abwerfen & aufdecken'}
                </button>
              )}
              {legalMoves.some((m) => m.type === 'actionExtraTurn') && (
                <button type="button" className="lf-button lf-action-btn" onClick={() => onMove({ type: 'actionExtraTurn' })}>
                  ⚡ Doppelzug (Nochmal)
                </button>
              )}
              {legalMoves.some((m) => m.type === 'actionPeek') && (
                <button
                  type="button"
                  className={`lf-button lf-action-btn${actionState.type === 'peek' ? ' lf-button-on' : ''}`}
                  onClick={() => {
                    setDiscarding(false);
                    setActionState((s) => (s.type === 'peek' ? { type: 'none' } : { type: 'peek' }));
                  }}
                >
                  {actionState.type === 'peek' ? 'Spähen abbrechen' : '👁️ Karte spähen'}
                </button>
              )}
              {legalMoves.some((m) => m.type === 'actionSwap') && (
                <button
                  type="button"
                  className={`lf-button lf-action-btn${actionState.type === 'swap' ? ' lf-button-on' : ''}`}
                  onClick={() => {
                    setDiscarding(false);
                    setActionState((s) => (s.type === 'swap' ? { type: 'none' } : { type: 'swap' }));
                  }}
                >
                  {actionState.type === 'swap' ? 'Tausch abbrechen' : '🔄 Karten tauschen'}
                </button>
              )}
              {legalMoves.some((m) => m.type === 'actionDoubleFlip') && (
                <button
                  type="button"
                  className={`lf-button lf-action-btn${actionState.type === 'doubleFlip' ? ' lf-button-on' : ''}`}
                  onClick={() => {
                    setDiscarding(false);
                    setActionState((s) => (s.type === 'doubleFlip' ? { type: 'none' } : { type: 'doubleFlip' }));
                  }}
                >
                  {actionState.type === 'doubleFlip' ? 'Aufdecken abbrechen' : '✨ 2 Karten aufdecken'}
                </button>
              )}
            </div>
          )}
        </div>
        <Grid
          grid={mine.grid}
          cols={view.cols}
          junior={junior}
          fresh={freshSlots(events, me)}
          hintSlot={myTurn ? hintSlot : null}
          knownMap={getKnownMap(me)}
          selectedSlot={actionState.type === 'swap' ? actionState.mySlot : actionState.type === 'doubleFlip' ? actionState.firstSlot : null}
          canTap={canTap}
          onTap={tapSlot}
        />
      </div>

      {view.phase === 'roundEnd' && view.lastRound && (
        <RoundSummary
          title={`Runde ${view.lastRound.round} beendet`}
          subtitle={
            view.lastRound.doubled
              ? `${name(seatNames, view.lastRound.ender)} hat beendet, hatte aber nicht allein die niedrigste Summe – verdoppelt!`
              : `${name(seatNames, view.lastRound.ender)} hat die Runde beendet.`
          }
          sortDirection="asc"
          players={view.players.map((p, seat) => {
            const roundChange = view.lastRound!.points[seat];
            const currentScore = p.total;
            const previousScore = currentScore - roundChange;
            const isEnder = seat === view.lastRound!.ender;
            const detail = isEnder
              ? view.lastRound!.doubled
                ? 'Runde beendet (verdoppelt)'
                : 'Runde beendet'
              : undefined;

            return {
              seat,
              name: name(seatNames, seat),
              badge: isEnder ? '✈️' : undefined,
              previousScore,
              roundChange,
              currentScore,
              detail,
              isMe: seat === me,
            };
          })}
          actions={
            legalMoves.some((m) => m.type === 'ready') ? (
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

export const gameUi: GameUi<LowFlightView, LowFlightMove> = {
  Board: LowFlightBoard,
  handView: true,
  SeatSymbol: ({ className }) => <span className={className}>🛩️</span>,
  seatLabel: (seat) => `Platz ${Number(seat) + 1}`,
  seatDetail: (view, seat) => `Σ ${openSum(view.players[seat]?.grid ?? [])} offen`,
  seatScore: (view, seat) => view.players[seat]?.total ?? 0,
  sounds: {
    revealed: 'aufdecken',
    flipped: 'aufdecken',
    drew: 'karte-ziehen',
    tookDiscard: 'karte-ziehen',
    swapped: 'karte-legen',
    discarded: 'karte-legen',
    cleared: 'paar',
    lastRound: 'ansage',
    roundStarted: 'mischen',
    reshuffled: 'mischen',
  },
};
