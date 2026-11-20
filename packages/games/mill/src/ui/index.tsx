import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, NetBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useLayoutEffect, useRef, useState } from 'react';
import { LINES, POINTS, pointName } from '../board';
import { describeStep } from '../describe';
import { FLY_MS, PLACE_MS, REMOVE_MS, SLIDE_MS, motionOfChoice, motionsOf, moverMs, type StoneMotion } from './motion';
import { phaseOf, stonesOnBoard, type MillMove, type MillState } from '../rules';
import './styles.css';

const LABELS = ['Weiß', 'Schwarz'];

function Stone({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={`ml-stone ml-${seat === 0 ? 'white' : 'black'} ${className}`} />;
}

interface Selection {
  /** Gewählter eigener Stein (Ziehen/Springen). */
  from: number | null;
  /** Gewähltes Ziel, nach dem noch weggenommen werden muss. */
  to: number | null;
  removed: number[];
}

const EMPTY: Selection = { from: null, to: null, removed: [] };

interface Fx {
  key: number;
  motions: StoneMotion[];
  /** Der ziehende oder gesetzte Stein ist angekommen. */
  moverDone: boolean;
  /** Ziel und Schlagsteine hat der Spieler schon selbst gewählt: der Stein gleitet nicht noch einmal. */
  chosen: boolean;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Bedienung in Schritten: Stein wählen (beim Ziehen), Ziel antippen – und wenn
 * eine Mühle entsteht, den gegnerischen Stein antippen, der weg soll.
 */
function Board({ view, legalMoves, onMove, hint }: BoardProps<MillState, MillMove>) {
  const [sel, setSel] = useState<Selection>(EMPTY);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    // Neuer Spielstand: angefangene Auswahl verwerfen.
    setLastView(view);
    setSel(EMPTY);
  }

  const [fx, setFx] = useState<Fx | null>(null);
  const prevView = useRef(view);
  const chosen = useRef(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const fxKey = useRef(0);

  // Nur bei einem echten Zug (Stand davor und danach passen zusammen) bewegt sich etwas (#590).
  useLayoutEffect(() => {
    const prev = prevView.current;
    prevView.current = view;
    if (prev === view) return;
    const motions = reducedMotion() ? [] : motionsOf(prev, view);
    const own = chosen.current;
    chosen.current = false;
    setFx(motions.length > 0 ? { key: ++fxKey.current, motions, moverDone: false, chosen: own } : null);
  }, [view]);

  useLayoutEffect(() => {
    if (!fx) return;
    const net = netRef.current;
    const layout = layoutRef.current;
    const done = () => setFx((cur) => (cur?.key === fx.key ? null : cur));
    if (!net || !layout || !ghostRefs.current.some((el) => el && typeof el.animate === 'function')) {
      done();
      return;
    }
    const box = net.getBoundingClientRect();
    const anims: Animation[] = [];
    const delay = fx.chosen ? 0 : moverMs(fx.motions);
    fx.motions.forEach((m, i) => {
      const el = ghostRefs.current[i];
      if (!el) return;
      if (m.kind === 'remove') {
        const start = fx.chosen ? 0.25 : 1;
        const a = el.animate(
          [
            { opacity: start, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.3)' },
          ],
          { duration: REMOVE_MS, delay, easing: 'ease-in', fill: 'both' },
        );
        a.finished.then(done, () => {});
        anims.push(a);
        return;
      }
      if (fx.chosen) {
        setFx((cur) => (cur?.key === fx.key ? { ...cur, moverDone: true } : cur));
        return;
      }
      const end = {
        x: box.left + POINTS[m.to]!.x * box.width,
        y: box.top + POINTS[m.to]!.y * box.height,
      };
      let start = end;
      let scale = 1;
      if (m.kind === 'place') {
        const hand = layout.querySelector(`.ml-hand[data-seat="${m.seat}"]`);
        const r = (hand?.lastElementChild ?? hand)?.getBoundingClientRect();
        if (r) start = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const full = el.firstElementChild?.getBoundingClientRect().width ?? 0;
        if (r && full > 0) scale = Math.min(1, Math.max(0.3, r.width / full));
      } else {
        start = {
          x: box.left + POINTS[m.from]!.x * box.width,
          y: box.top + POINTS[m.from]!.y * box.height,
        };
      }
      const dx = start.x - end.x;
      const dy = start.y - end.y;
      const keyframes: Keyframe[] =
        m.kind === 'fly'
          ? [
              { transform: `translate(${dx}px, ${dy}px) scale(1)` },
              {
                transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.3)`,
                offset: 0.5,
              },
              { transform: 'translate(0, 0) scale(1)' },
            ]
          : [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: 'translate(0, 0) scale(1)' }];
      const duration = m.kind === 'slide' ? SLIDE_MS : m.kind === 'fly' ? FLY_MS : PLACE_MS;
      const a = el.animate(keyframes, {
        duration,
        easing: m.kind === 'place' ? 'ease-out' : 'ease-in-out',
        fill: 'both',
      });
      a.finished.then(
        () => setFx((cur) => (cur?.key === fx.key ? { ...cur, moverDone: true } : cur)),
        () => {},
      );
      anims.push(a);
    });
    if (anims.length === 0) done();
    return () => anims.forEach((a) => a.cancel());
    // Nur ein neuer Zug startet die Bewegung neu, nicht jede Zustandsänderung von fx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx?.key]);

  const fromOf = (m: MillMove) => (m.type === 'move' ? m.from : null);
  const forFrom = legalMoves.filter((m) => fromOf(m) === sel.from);
  const removing = sel.to !== null;
  const candidates = removing ? forFrom.filter((m) => m.to === sel.to && sel.removed.every((r) => m.remove.includes(r))) : [];

  const selectable = new Set(legalMoves.flatMap((m) => (m.type === 'move' ? [m.from] : [])));
  const targets = new Set(removing ? [] : forFrom.map((m) => m.to));
  const removableNow = new Set(candidates.flatMap((m) => m.remove.filter((r) => !sel.removed.includes(r))));

  const finish = (moves: MillMove[], next: Selection) => {
    const done = moves.find((m) => m.remove.length === next.removed.length);
    if (done && (moves.length === 1 || next.removed.length > 0 || done.remove.length === 0)) {
      // Ist der Stein schon beim Antippen des Ziels gegleitet (dann Schlagsteine), gleitet er nicht noch einmal.
      chosen.current = sel.to !== null;
      onMove(done);
      setSel(EMPTY);
    } else {
      setSel(next);
    }
  };

  const tap = (point: number) => {
    if (removing) {
      if (!removableNow.has(point)) return;
      const next = { ...sel, removed: [...sel.removed, point] };
      finish(
        candidates.filter((m) => m.remove.includes(point)),
        next,
      );
      return;
    }
    if (targets.has(point)) {
      const moves = forFrom.filter((m) => m.to === point);
      const next = { ...sel, to: point };
      if (moves.every((m) => m.remove.length === 0)) finish(moves, next);
      else {
        // Mühle: der Stein gleitet jetzt, danach folgt die Wahl des Schlagsteins.
        const motion = reducedMotion() ? null : motionOfChoice(view, sel.from, point);
        if (motion) setFx({ key: ++fxKey.current, motions: [motion], moverDone: false, chosen: false });
        setSel(next);
      }
      return;
    }
    if (selectable.has(point)) setSel({ ...EMPTY, from: point === sel.from ? null : point });
  };

  const shown = [...view.cells];
  if (sel.from !== null && sel.to !== null) shown[sel.from] = null;
  if (sel.to !== null) shown[sel.to] = view.turn;
  const hintPoints = new Set(hint ? [hint.to, ...(hint.type === 'move' ? [hint.from] : []), ...hint.remove] : []);
  const last = view.lastMove;
  // Solange der Stein noch unterwegs ist, bleibt sein Zielfeld leer; der gleitende Stein liegt darüber.
  const moving = fx && !fx.moverDone && !fx.chosen ? fx.motions.find((m) => m.kind !== 'remove') : undefined;
  const hiddenPoint = moving ? moving.to : -1;
  ghostRefs.current.length = fx?.motions.length ?? 0;

  return (
    <FitBox ratio={1 / 1.12} className="ml-fit">
      <div className="ml-layout" ref={layoutRef}>
        <div className="ml-hands" aria-label="Steine im Vorrat">
          {[0, 1].map((seat) => (
            <span key={seat} className="ml-hand" data-seat={seat}>
              {Array.from({ length: view.inHand[seat as 0 | 1] }, (_, i) => (
                <Stone key={i} seat={seat} className="ml-small" />
              ))}
            </span>
          ))}
        </div>
        <div className="ml-board">
          <div className="ml-net" ref={netRef}>
            <NetBoard
              points={POINTS}
              lines={LINES}
              label="Mühlebrett"
              renderPoint={(point) => {
                const owner = shown[point];
                const removed = sel.removed.includes(point);
                if (owner === null || owner === undefined) return <span className={`ml-dot ${targets.has(point) ? 'ml-target' : ''}`} />;
                return (
                  <Stone
                    seat={owner}
                    className={`${removed ? 'ml-removed' : ''} ${point === sel.from ? 'ml-selected' : ''} ${point === sel.to ? 'ml-pending' : ''} ${point === hiddenPoint ? 'ml-hidden' : ''}`}
                  />
                );
              }}
              isActive={(point) => (removing ? removableNow.has(point) : targets.has(point) || selectable.has(point))}
              onActivate={tap}
              pointClassName={(point) =>
                [
                  removableNow.has(point) ? 'ml-can-remove' : '',
                  hintPoints.has(point) ? 'ml-hint' : '',
                  last && (last.to === point || (last.type === 'move' && last.from === point)) ? 'ml-last' : '',
                ].join(' ')
              }
              pointLabel={(point) => {
                const owner = view.cells[point];
                const where = `${pointName(point)}: ${owner === null || owner === undefined ? 'frei' : LABELS[owner]}`;
                // Ziele und wegnehmbare Steine nennen den Zug (#335).
                if (removableNow.has(point)) return `${where} – wegnehmen`;
                if (!targets.has(point)) return where;
                const moves = forFrom.filter((m) => m.to === point);
                const step = describeStep(view, moves[0]!);
                return `${where} – ${moves.some((m) => m.remove.length > 0) ? `${step}, Mühle` : step}`;
              }}
            />
            {fx && (
              <div className="ml-fx" aria-hidden="true">
                {fx.motions.map((m, i) => {
                  if (m.kind !== 'remove' && (fx.moverDone || fx.chosen)) return null;
                  const at = POINTS[m.kind === 'remove' ? m.point : m.to]!;
                  return (
                    <span key={i} className="ml-ghost" style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }} ref={(el) => void (ghostRefs.current[i] = el)}>
                      <Stone seat={m.seat} />
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <p className="ml-help" aria-live="polite">
          {removing && removableNow.size > 0 ? 'Mühle! Tippe einen gegnerischen Stein an, der weg soll.' : sel.from !== null ? 'Wohin soll der Stein?' : ''}
        </p>
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`ml-symbol ${className}`}>
      <Stone seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<MillState, MillMove> = {
  Board,
  SeatSymbol,
  sounds: {
    placed: 'stein-setzen',
    moved: 'stein-ziehen',
    mill: () => ['muehle', 'ruf-muehle'],
    removed: 'stein-schlagen',
  },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const phase = phaseOf(view, seat);
    const onBoard = stonesOnBoard(view.cells, seat);
    if (phase === 'place') return `${LABELS[seat]} · noch ${view.inHand[seat as 0 | 1]} setzen`;
    return `${LABELS[seat]} · ${onBoard} Steine${phase === 'fly' ? ' · springt' : ''}`;
  },
};
