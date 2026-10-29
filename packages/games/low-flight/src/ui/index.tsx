import { useEffect, useRef, useState } from 'react';
import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
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

function Card({ value, junior, hidden, label, className = '', onClick }: { value: number | null; junior: boolean; hidden?: boolean; label?: string; className?: string; onClick?: () => void }) {
  const face =
    hidden || value === null ? (
      <span className="lf-back" aria-hidden="true">
        🛩️
      </span>
    ) : junior ? (
      <>
        <span className="lf-num">{value}</span>
        <span className="lf-fruits" aria-hidden="true">
          {FRUITS[value]!.repeat(value)}
        </span>
      </>
    ) : (
      <>
        <span className="lf-corner">{value}</span>
        <span className="lf-num">{value}</span>
      </>
    );
  const cls = `lf-card ${hidden || value === null ? 'lf-card-hidden' : tone(value, junior)} ${className}`;
  const text = label ?? (hidden || value === null ? 'verdeckte Karte' : valueLabel(value, junior));
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={text}>
      {face}
    </button>
  ) : (
    <div className={cls} role="img" aria-label={text}>
      {face}
    </div>
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
}: {
  grid: ViewCell[];
  cols: number;
  junior: boolean;
  fresh: Set<number>;
  canTap?: (slot: number) => boolean;
  onTap?: (slot: number) => void;
  small?: boolean;
  hintSlot?: number | null;
}) {
  return (
    <div className={`lf-grid${small ? ' lf-grid-small' : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {grid.map((cell, slot) =>
        cell ? (
          <Card
            key={slot}
            value={cell.open ? cell.value : null}
            junior={junior}
            className={`${fresh.has(slot) ? 'lf-fresh' : ''}${canTap?.(slot) ? ' lf-tap' : ''}${hintSlot === slot ? ' lf-hint' : ''}`}
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

export function LowFlightBoard({ view, legalMoves, onMove, viewer, activeSeat, seatNames, events, hint }: BoardProps<LowFlightView, LowFlightMove>) {
  const junior = view.options.variant === 'junior';
  // Am geteilten Gerät gilt der Platz, der gerade handelt; während Bot-Zügen bleibt der letzte Mensch unten.
  const lastMe = useRef<SeatId>(0);
  if (typeof viewer === 'number') lastMe.current = viewer;
  const me = lastMe.current;
  const myTurn = activeSeat === me && legalMoves.length > 0;
  const [discarding, setDiscarding] = useState(false);
  useEffect(() => setDiscarding(false), [view.drawn, view.turn]);

  const has = (type: LowFlightMove['type'], slot?: number) => legalMoves.some((m) => m.type === type && (slot === undefined || ('slot' in m && m.slot === slot)));
  const top = view.discard[view.discard.length - 1];
  const mine = view.players[me]!;
  const drawnFromDeck = view.drawn?.from === 'deck';
  const hintSlot = hint && 'slot' in hint ? hint.slot : null;

  function tapSlot(slot: number) {
    if (view.phase === 'reveal') return onMove({ type: 'reveal', slot });
    if (!view.drawn) return;
    if (discarding && has('flip', slot)) return onMove({ type: 'flip', slot });
    if (has('swap', slot)) onMove({ type: 'swap', slot });
  }
  const canTap = (slot: number) => {
    if (!myTurn) return false;
    if (view.phase === 'reveal') return has('reveal', slot);
    if (!view.drawn) return false;
    return discarding ? has('flip', slot) : has('swap', slot);
  };

  function tapDiscard() {
    if (!myTurn) return;
    if (!view.drawn && has('takeDiscard')) onMove({ type: 'takeDiscard' });
    else if (drawnFromDeck) {
      if (has('discardDrawn')) onMove({ type: 'discardDrawn' });
      else setDiscarding((d) => !d);
    }
  }

  let status = '';
  if (view.phase === 'reveal') {
    const need = junior ? 1 : 2;
    status = myTurn ? `Decke ${need === 1 ? 'eine Karte' : 'zwei Karten'} auf.` : `${name(seatNames, view.turn)} deckt auf …`;
  } else if (view.phase === 'turn') {
    if (!myTurn) status = `${name(seatNames, view.turn)} ist dran …`;
    else if (!view.drawn) status = 'Ziehe vom Stapel oder nimm die Ablagekarte.';
    else if (discarding) status = 'Decke eine verdeckte Karte auf.';
    else if (drawnFromDeck) status = 'Tausche die Karte gegen eine eigene – oder tippe auf die Ablage, um sie abzuwerfen.';
    else status = 'Tausche die Karte gegen eine eigene.';
    if (view.ender !== null) status = `Letzte Runde (${name(seatNames, view.ender)} hat alles aufgedeckt). ${status}`;
  }

  const others = view.players.map((_, s) => s).filter((s) => s !== me);
  const ordered = [...others.filter((s) => s > me), ...others.filter((s) => s < me)];

  return (
    <div className={`lf-table${junior ? ' lf-junior' : ''}`}>
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
              <Grid grid={p.grid} cols={view.cols} junior={junior} fresh={freshSlots(events, seat)} small />
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
          {myTurn && drawnFromDeck && hiddenSlots(mine.grid).length > 0 && (
            <button type="button" className={`lf-button${discarding ? ' lf-button-on' : ''}`} onClick={() => setDiscarding((d) => !d)}>
              {discarding ? 'Doch tauschen' : 'Abwerfen & aufdecken'}
            </button>
          )}
        </div>
        <Grid
          grid={mine.grid}
          cols={view.cols}
          junior={junior}
          fresh={freshSlots(events, me)}
          hintSlot={myTurn ? hintSlot : null}
          canTap={canTap}
          onTap={tapSlot}
        />
      </div>

      {(view.phase === 'roundEnd' || view.phase === 'gameEnd') && view.lastRound && (
        <div className="lf-overlay">
          <div className="lf-overlay-box">
            <div className="lf-overlay-title">Runde {view.lastRound.round}</div>
            <table className="lf-scores">
              <thead>
                <tr>
                  <th />
                  <th>Runde</th>
                  <th>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {view.players.map((p, seat) => (
                  <tr key={seat} className={seat === me ? 'lf-row-me' : undefined}>
                    <td>
                      {name(seatNames, seat)}
                      {seat === view.lastRound!.ender ? ' ✈️' : ''}
                    </td>
                    <td className={seat === view.lastRound!.ender && view.lastRound!.doubled ? 'lf-doubled' : undefined}>
                      {view.lastRound!.points[seat]}
                      {seat === view.lastRound!.ender && view.lastRound!.doubled ? ' (×2)' : ''}
                    </td>
                    <td className="lf-total">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {view.lastRound.doubled && <p className="lf-note">✈️ {name(seatNames, view.lastRound.ender)} hat die Runde beendet, hatte aber nicht allein die niedrigste Summe – doppelt!</p>}
            {legalMoves.some((m) => m.type === 'ready') ? (
              <button type="button" className="lf-button lf-button-main" onClick={() => onMove({ type: 'ready' })}>
                Nächste Runde
              </button>
            ) : (
              view.phase === 'roundEnd' && <p className="lf-note">Warte auf die anderen …</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<LowFlightView, LowFlightMove> = {
  Board: LowFlightBoard,
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
