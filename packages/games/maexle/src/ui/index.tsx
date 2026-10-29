import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState } from 'react';
import { MAEXLE, RANKING, isDouble, isIn, lastAnnouncement, valueOf, type MaexleMove, type MaexleState, type Reveal } from '../rules';
import './styles.css';

const SEAT_COLORS = ['#d6336c', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599', '#e8590c', '#5c940d', '#ae3ec9', '#495057'];

/** Wie ein Wert gesprochen wird: „Mäxle“, „Pasch 3“ oder „42“. */
function valueLabel(value: number): string {
  if (value === MAEXLE) return 'Mäxle';
  if (isDouble(value)) return `Pasch ${value % 10}`;
  return String(value);
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

function Die({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 100 100" className="mx-die" role="img" aria-label={`Würfel ${value}`}>
      <rect x="4" y="4" width="92" height="92" rx="18" />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" />
      ))}
    </svg>
  );
}

function Dice({ dice }: { dice: [number, number] }) {
  // Der höhere Würfel steht vorn, so liest man den Wert direkt ab.
  const [a, b] = [Math.max(...dice), Math.min(...dice)];
  return (
    <span className="mx-dice">
      <Die value={a} />
      <Die value={b} />
    </span>
  );
}

function CupShape() {
  return (
    <svg viewBox="0 0 120 110" className="mx-cup-shape" aria-hidden="true">
      <path d="M30 6 H90 L102 104 H18 Z" />
      <path d="M28 26 H92" className="mx-cup-band" />
      <path d="M22 86 H98" className="mx-cup-band" />
    </svg>
  );
}

const nameOf = (names: string[], seat: SeatId) => names[seat] ?? `Platz ${seat + 1}`;

function RevealText({ reveal, names }: { reveal: Reveal; names: string[] }) {
  const lives = reveal.amount === 1 ? 'ein Leben' : `${reveal.amount} Leben`;
  const loser = nameOf(names, reveal.loser);
  if (reveal.believedMaexle) return <>{loser} glaubt das Mäxle und verliert {lives}.</>;
  const announcer = nameOf(names, reveal.announcement.seat);
  return (
    <>
      {announcer} hatte {valueLabel(reveal.announcement.value)} angesagt – {reveal.truthful ? 'das stimmt' : 'gelogen'}! {loser} verliert {lives}.
    </>
  );
}

/** Der Becher: gedrückt halten zum Schauen. Beim Loslassen sind die Würfel wieder verdeckt. */
function Cup({ dice, canPeek, holder, revealed }: { dice: [number, number] | null; canPeek: boolean; holder: string | null; revealed: [number, number] | null }) {
  const [peeking, setPeeking] = useState(false);
  useEffect(() => setPeeking(false), [dice, canPeek]);
  const open = revealed !== null || (peeking && canPeek && dice !== null);
  const shown = revealed ?? dice;
  const hold = (on: boolean) => canPeek && setPeeking(on);

  return (
    <div className="mx-cup-area">
      <div className="mx-dice-slot" aria-live="polite">
        {open && shown ? (
          <>
            <Dice dice={shown} />
            <span className="mx-value">{valueLabel(valueOf(shown))}</span>
          </>
        ) : null}
      </div>
      {canPeek ? (
        <button
          type="button"
          className={`mx-cup ${open ? 'mx-cup-open' : ''}`}
          aria-label="Becher gedrückt halten, um heimlich zu schauen"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            hold(true);
          }}
          onPointerUp={() => hold(false)}
          onPointerCancel={() => hold(false)}
          onLostPointerCapture={() => hold(false)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              hold(true);
            }
          }}
          onKeyUp={() => hold(false)}
          onBlur={() => hold(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <CupShape />
        </button>
      ) : (
        <div className={`mx-cup ${revealed ? 'mx-cup-lifted' : ''} ${dice === null && !revealed && holder === null ? 'mx-cup-empty' : ''}`} aria-hidden="true">
          <CupShape />
        </div>
      )}
      <p className="mx-cup-caption">{canPeek ? (open ? 'Loslassen zum Verdecken' : 'Gedrückt halten zum Schauen') : holder ? `Becher bei ${holder}` : ' '}</p>
    </div>
  );
}

/** Die Leiter aller Werte in Rangfolge; nur höhere Ansagen sind wählbar. */
function Ladder({ allowed, onPick, label }: { allowed: Set<number>; onPick: (value: number) => void; label: string }) {
  const groups = [
    { name: 'normal', values: RANKING.filter((v) => !isDouble(v) && v !== MAEXLE) },
    { name: 'pasch', values: RANKING.filter(isDouble) },
    { name: 'maexle', values: [MAEXLE] },
  ];
  return (
    <div className="mx-ladder" role="group" aria-label={label}>
      {groups.map((group) => (
        <div key={group.name} className={`mx-rung-group mx-${group.name}`}>
          {group.values.map((value) => (
            <button key={value} type="button" className="mx-rung" disabled={!allowed.has(value)} onClick={() => onPick(value)}>
              {value === MAEXLE ? 'Mäxle' : value}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Würfeln durch Schütteln (Bewegungssensor). Auf iPhones muss man das einmal erlauben. */
type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };
/** Schütteln nur auf Geräten mit Touchscreen – am Rechner gibt es keinen Sensor, den man schütteln will. */
const canShake = typeof window !== 'undefined' && typeof DeviceMotionEvent !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
let motionAllowed = typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as unknown as MotionPermission).requestPermission !== 'function';

function useShake(active: boolean, onShake: () => void) {
  const callback = useRef(onShake);
  callback.current = onShake;
  const [allowed, setAllowed] = useState(motionAllowed);
  useEffect(() => {
    if (!active || !allowed || typeof window === 'undefined') return;
    let last: { x: number; y: number; z: number } | null = null;
    let fired = false;
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const now = { x: a.x, y: a.y, z: a.z };
      if (last && !fired) {
        const jolt = Math.abs(now.x - last.x) + Math.abs(now.y - last.y) + Math.abs(now.z - last.z);
        if (jolt > 28) {
          fired = true;
          callback.current();
        }
      }
      last = now;
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [active, allowed]);

  const ask = typeof DeviceMotionEvent !== 'undefined' ? (DeviceMotionEvent as unknown as MotionPermission).requestPermission : undefined;
  const request =
    !allowed && ask
      ? () => {
          ask()
            .then((answer) => {
              motionAllowed = answer === 'granted';
              setAllowed(motionAllowed);
            })
            .catch(() => undefined);
        }
      : null;
  return { allowed, request };
}

function Board({ view, legalMoves, onMove, viewer, seatNames, events, hint }: BoardProps<MaexleState, MaexleMove>) {
  const last = lastAnnouncement(view);
  const canRoll = legalMoves.some((m) => m.type === 'roll');
  const announceValues = new Set(legalMoves.flatMap((m) => (m.type === 'announce' ? [m.value] : [])));
  const blindValues = new Set(legalMoves.flatMap((m) => (m.type === 'passBlind' ? [m.value] : [])));
  const canRespond = legalMoves.some((m) => m.type === 'doubt');
  const [blindOpen, setBlindOpen] = useState(false);
  useEffect(() => setBlindOpen(false), [view.history.length, view.round]);

  const shakeOn = canShake && view.shake && canRoll;
  const shake = useShake(shakeOn, () => onMove({ type: 'roll' }));
  const justRevealed = events.some((e) => e.type === 'revealed');
  const knowsDice = viewer !== 'spectator' && viewer === view.rolledBy && view.dice !== null;
  const holder = view.rolledBy !== null && view.phase !== 'roll' ? nameOf(seatNames, view.turn) : null;
  // Nach dem Aufdecken liegen die Würfel offen, bis jemand neu würfelt.
  const revealedDice = view.history.length === 0 && view.phase === 'roll' ? (view.lastReveal?.dice ?? null) : null;
  const hintKey = hint ? (hint.type === 'announce' || hint.type === 'passBlind' ? `${hint.type}:${hint.value}` : hint.type) : null;

  return (
    <div className="mx-table">
      <div className="mx-top">
        {view.lastReveal && (
          <p key={view.round} className={`mx-reveal ${justRevealed ? 'mx-reveal-new' : ''}`}>
            {view.lastReveal.dice && (
              <span className="mx-reveal-dice">
                <Dice dice={view.lastReveal.dice} />
              </span>
            )}
            <span>
              <RevealText reveal={view.lastReveal} names={seatNames} />
            </span>
          </p>
        )}
        {view.history.length > 0 ? (
          <ol className="mx-history" aria-label="Ansagen dieser Runde">
            {view.history.map((entry, i) => (
              <li key={i} className={i === view.history.length - 1 ? 'mx-current' : ''}>
                <span className="mx-dot" style={{ background: SEAT_COLORS[entry.seat % SEAT_COLORS.length] }} />
                {nameOf(seatNames, entry.seat)}: <strong>{valueLabel(entry.value)}</strong>
                {entry.blind && <em> blind</em>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mx-help">Neue Runde: freie Ansage.</p>
        )}
      </div>

      <Cup dice={knowsDice ? view.dice : null} canPeek={knowsDice} holder={holder} revealed={revealedDice} />

      <div className="mx-controls">
        {canRoll && (
          <div className="mx-actions">
            <button type="button" className={`mx-button mx-primary ${hintKey === 'roll' ? 'mx-hint' : ''}`} onClick={() => onMove({ type: 'roll' })}>
              🎲 Würfeln
            </button>
            {shakeOn && shake.allowed && <p className="mx-help">… oder das Handy schütteln</p>}
            {shakeOn && shake.request && (
              <button type="button" className="mx-link" onClick={shake.request}>
                📳 Würfeln durch Schütteln erlauben
              </button>
            )}
          </div>
        )}

        {announceValues.size > 0 && (
          <>
            <p className="mx-help">{last ? `Sag etwas Höheres an als ${valueLabel(last.value)}:` : 'Freie Ansage – was liegt unter dem Becher?'}</p>
            <Ladder allowed={announceValues} label="Ansage wählen" onPick={(value) => onMove({ type: 'announce', value })} />
          </>
        )}

        {canRespond && last && (
          <>
            <p className="mx-said">
              {nameOf(seatNames, last.seat)} sagt <strong>{valueLabel(last.value)}</strong>
              {last.blind ? ' (blind)' : ''}
            </p>
            <div className="mx-actions mx-row">
              <button type="button" className={`mx-button ${hintKey === 'believe' ? 'mx-hint' : ''}`} onClick={() => onMove({ type: 'believe' })}>
                {last.value === MAEXLE ? `Glauben (−1 ${view.scoring === 'lives' ? '❤️' : 'Punkt'})` : '🙂 Glauben und würfeln'}
              </button>
              <button type="button" className={`mx-button mx-danger ${hintKey === 'doubt' ? 'mx-hint' : ''}`} onClick={() => onMove({ type: 'doubt' })}>
                🤨 Anzweifeln
              </button>
              {blindValues.size > 0 && (
                <button type="button" className="mx-button" aria-expanded={blindOpen} onClick={() => setBlindOpen((open) => !open)}>
                  🙈 Blind weitergeben
                </button>
              )}
            </div>
            {blindOpen && <Ladder allowed={blindValues} label="Blind ansagen" onPick={(value) => onMove({ type: 'passBlind', value })} />}
          </>
        )}
      </div>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`mx-symbol ${className}`} style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
      {seat + 1}
    </span>
  );
}

export const gameUi: GameUi<MaexleState, MaexleMove> = {
  Board,
  SeatSymbol,
  sounds: {
    rolled: 'wuerfelbecher-schuetteln',
    announced: 'ansage',
    doubted: 'zweifeln',
    revealed: (event) => (event.dice ? ['aufdecken', 'leben-weg'] : 'leben-weg'),
  },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const lost = view.penalties[seat] ?? 0;
    if (view.scoring === 'points') return `${lost} ${lost === 1 ? 'Strafpunkt' : 'Strafpunkte'}`;
    if (!isIn(view, seat)) return 'ausgeschieden';
    return '❤️'.repeat(view.limit - lost) + '🤍'.repeat(lost);
  },
};
