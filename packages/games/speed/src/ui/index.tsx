/**
 * Die Oberfläche von Speed: Mitte mit Seiten- und Ablagestapeln, darunter (und am geteilten
 * Bildschirm darüber, gedreht) der Bereich eines Spielers mit Hand und Nachziehstapel.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { cardName, type CardId, type GameEvent, type SeatId } from '@brett-und-blatt/engine';
import { PlayingCard, usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { topOf, winsNeeded, type PlayerView, type SpeedMove, type SpeedView } from '../rules';
import './styles.css';

type PlayMove = Extract<SpeedMove, { type: 'play' }>;

interface Flight {
  key: string;
  card: CardId;
  pile: number;
  from: DOMRect;
  to: DOMRect;
}

const FLIGHT_MS = 280;
/** Wer nichts mehr legen kann, meldet sich nach dieser Pause von selbst als festgefahren. */
const AUTO_STUCK_MS = 1_500;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface ZoneProps {
  seat: SeatId;
  player: PlayerView;
  deckStyle: SpeedView['deckStyle'];
  legalMoves: SpeedMove[];
  onMove: (move: SpeedMove) => void;
  /** Name über dem Bereich – nur am geteilten Bildschirm nötig. */
  name: string | null;
  /** Für den Spieler gegenüber am Tablet um 180° gedreht. */
  rotated: boolean;
  phase: SpeedView['phase'];
  otherStuck: string | null;
  onDropAt: (card: CardId, point: { x: number; y: number }) => void;
  onDragTarget: (seat: SeatId, target: string | null) => void;
}

/** Der Bereich eines Spielers: fünf Handkarten, Nachziehstapel und „Festgefahren“. */
function PlayerZone({ seat, player, deckStyle, legalMoves, onMove, name, rotated, phase, otherStuck, onDropAt, onDragTarget }: ZoneProps) {
  const plays = useMemo(() => legalMoves.filter((m): m is PlayMove => m.type === 'play'), [legalMoves]);
  const canStuck = legalMoves.some((m) => m.type === 'stuck');
  const [shake, setShake] = useState<CardId | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);

  // Nichts mehr zu legen: nach kurzer Pause von selbst „Festgefahren“ melden.
  // `onMove` ist bei jedem Neuzeichnen eine neue Funktion – sonst begänne die Pause ständig von vorn.
  const autoStuck = canStuck && plays.length === 0 && phase === 'play';
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  useEffect(() => {
    if (!autoStuck) return;
    const t = window.setTimeout(() => onMoveRef.current({ type: 'stuck' }), AUTO_STUCK_MS);
    return () => window.clearTimeout(t);
  }, [autoStuck]);

  const tryPlay = useCallback(
    (card: CardId, target?: string | null) => {
      const options = plays.filter((m) => m.card === card);
      const wanted = target?.startsWith('pile-') ? Number(target.slice(5)) : null;
      const move = wanted === null ? (target === undefined ? options[0] : undefined) : options.find((m) => m.pile === wanted);
      if (!move) {
        setShake(card);
        timer.current = window.setTimeout(() => setShake(null), 350);
        return false;
      }
      onMove(move);
      return true;
    },
    [plays, onMove],
  );

  const { dragState, bindDrag } = usePointerDrag<CardId>({
    threshold: 6,
    disabled: plays.length === 0,
    onDrop: (card, targetId, point) => {
      onDropAt(card, point);
      return tryPlay(card, targetId ?? 'none');
    },
    onClick: (card) => tryPlay(card),
  });

  const target = dragState.isDragging ? dragState.targetId : null;
  useEffect(() => onDragTarget(seat, target), [onDragTarget, seat, target]);

  const dragging = dragState.isDragging ? dragState.item : null;
  // Im gedrehten Bereich läuft die Verschiebung gegen die Bildschirmrichtung.
  const sign = rotated ? -1 : 1;

  let status: string | null = null;
  if (phase === 'play') {
    if (player.stuck) status = 'Festgefahren – wartet auf den anderen …';
    else if (autoStuck) status = 'Keine passende Karte.';
    else if (otherStuck) status = `${otherStuck} kommt nicht weiter.`;
  }

  return (
    <div className={`spd-zone${rotated ? ' spd-rotated' : ''}`} data-seat={seat}>
      <div className="spd-status" role="status">
        {name && <strong className="spd-zone-name">{name}</strong>}
        {status}
      </div>
      <div className="spd-zone-row">
        <div className="spd-draw" aria-label={`Nachziehstapel: ${player.drawCount} Karten`}>
          {player.drawCount > 0 ? <PlayingCard card={null} className="spd-card" /> : <span className="spd-slot" />}
          <span className="spd-count">{player.drawCount}</span>
        </div>
        <div className="spd-hand">
          {player.hand.map((card) => {
            const can = plays.some((m) => m.card === card);
            const drag = dragging === card;
            const bind = bindDrag(card);
            return (
              <button
                key={card}
                type="button"
                data-card-id={card}
                className={`spd-hand-card${can ? ' spd-playable' : ''}${shake === card ? ' spd-shake' : ''}`}
                aria-label={`${cardName(card)}${can ? ', passt' : ''}`}
                disabled={legalMoves.length === 0}
                {...bind}
                style={{
                  ...bind.style,
                  ...(drag
                    ? {
                        transform: `translate(${sign * dragState.delta.x}px, ${sign * dragState.delta.y}px) scale(1.06)`,
                        zIndex: 40,
                        transition: dragState.snapping ? 'transform 180ms ease' : 'none',
                      }
                    : undefined),
                }}
              >
                <PlayingCard card={card} deckStyle={deckStyle} className="spd-card" />
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, 5 - player.hand.length) }, (_, i) => (
            <span key={`empty-${i}`} className="spd-slot" />
          ))}
        </div>
        <button type="button" className="spd-button" onClick={() => onMove({ type: 'stuck' })} disabled={!canStuck}>
          ✋<span className="spd-button-text"> Festgefahren</span>
        </button>
      </div>
    </div>
  );
}

function Board({ view, legalMoves, onMove, events, viewer, seatNames, humanSeats }: BoardProps<SpeedView, SpeedMove>) {
  const me = typeof viewer === 'number' ? viewer : null;
  // Geteilter Bildschirm: zwei Menschen an einem Gerät, jeder mit eigener Hälfte.
  const split = humanSeats !== undefined && humanSeats.length > 1;
  const zones: { seat: SeatId; legalMoves: SpeedMove[]; onMove: (move: SpeedMove) => void }[] = split
    ? humanSeats!.map((h) => ({ seat: h.seat, legalMoves: h.legalMoves as SpeedMove[], onMove: h.onMove as (move: SpeedMove) => void }))
    : [{ seat: me ?? 0, legalMoves: me === null ? [] : legalMoves, onMove }];
  const bottom = zones[zones.length - 1]!;
  const top = split ? zones[0]! : null;
  const opponent: SeatId = bottom.seat === 0 ? 1 : 0;

  const tableRef = useRef<HTMLDivElement | null>(null);
  const pileRefs = useRef<(HTMLElement | null)[]>([null, null]);
  const opponentRef = useRef<HTMLDivElement | null>(null);
  const cardRects = useRef(new Map<string, DOMRect>());
  const [flights, setFlights] = useState<Flight[]>([]);
  const [dragTargets, setDragTargets] = useState<Record<number, string | null>>({});
  const onDragTarget = useCallback(
    (seat: SeatId, target: string | null) => setDragTargets((t) => (t[seat] === target ? t : { ...t, [seat]: target })),
    [],
  );
  const hovered = new Set(Object.values(dragTargets).filter((t): t is string => t !== null));
  const dropPoint = useRef<{ card: CardId; x: number; y: number } | null>(null);
  const handled = useRef<GameEvent[] | null>(null);
  const timers = useRef<number[]>([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  // Lage der Handkarten merken: Von dort fliegen gelegte Karten los.
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    cardRects.current.clear();
    table.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => cardRects.current.set(el.dataset.cardId!, el.getBoundingClientRect()));
  });

  useLayoutEffect(() => {
    if (!events || events === handled.current) return;
    handled.current = events;
    if (events.some((e) => e.type === 'flipped')) {
      setFlash(true);
      later(() => setFlash(false), 500);
    }
    if (prefersReducedMotion()) return;
    const next: Flight[] = [];
    for (const event of events) {
      if (event.type !== 'played') continue;
      const card = event.card as CardId;
      const pile = event.pile as number;
      const target = pileRefs.current[pile];
      if (!target) continue;
      let from: DOMRect | undefined;
      const size = cardRects.current.get(card);
      const dropped = dropPoint.current;
      if (dropped && dropped.card === card) {
        const w = size?.width ?? 50;
        const h = size?.height ?? 70;
        from = new DOMRect(dropped.x - w / 2, dropped.y - h / 2, w, h);
        dropPoint.current = null;
      } else {
        from = size ?? opponentRef.current?.getBoundingClientRect();
      }
      if (!from) continue;
      next.push({ key: `${card}-${Math.random()}`, card, pile, from, to: target.getBoundingClientRect() });
    }
    if (next.length > 0) {
      setFlights((f) => [...f, ...next]);
      later(() => setFlights((f) => f.filter((x) => !next.includes(x))), FLIGHT_MS + 40);
    }
  }, [events]);

  const landing = useMemo(() => new Set(flights.map((f) => f.pile)), [flights]);
  const tableRect = tableRef.current?.getBoundingClientRect();
  const name = (seat: SeatId) => seatNames[seat] ?? `Spieler ${seat + 1}`;
  const stuckName = (seat: SeatId) => {
    const other = seat === 0 ? 1 : 0;
    return view.players[other]?.stuck ? name(other) : null;
  };

  const zone = (z: (typeof zones)[number], rotated: boolean) => (
    <PlayerZone
      key={z.seat}
      seat={z.seat}
      player={view.players[z.seat]!}
      deckStyle={view.deckStyle}
      legalMoves={z.legalMoves}
      onMove={z.onMove}
      name={split ? name(z.seat) : null}
      rotated={rotated}
      phase={view.phase}
      otherStuck={stuckName(z.seat)}
      onDropAt={(card, point) => {
        dropPoint.current = { card, ...point };
      }}
      onDragTarget={onDragTarget}
    />
  );

  const other = view.players[opponent]!;
  const sideStack = (i: 0 | 1) => (
    <div className="spd-side" aria-label={`Seitenstapel: ${view.sideCounts[i]} Karten`}>
      {view.sideCounts[i] > 0 ? <PlayingCard card={null} className="spd-card" /> : <span className="spd-slot" />}
      <span className="spd-count">{view.sideCounts[i]}</span>
    </div>
  );

  const readyActions = zones
    .filter((z) => z.legalMoves.some((m) => m.type === 'ready'))
    .map((z) => ({ seat: z.seat, name: name(z.seat), onReady: () => z.onMove({ type: 'ready' }) }));

  return (
    <div ref={tableRef} className={`spd-table${split ? ' spd-split' : ''}`}>
      {top ? (
        zone(top, true)
      ) : (
        <div ref={opponentRef} className={`spd-opponent${other.stuck ? ' spd-opponent-stuck' : ''}`}>
          <span className="spd-opponent-name">{name(opponent)}</span>
          <span className="spd-opponent-hand" aria-label={`${other.hand.length} Handkarten`}>
            {other.hand.map((card) => (
              <PlayingCard key={card} card={card} deckStyle={view.deckStyle} className="spd-card spd-mini" />
            ))}
          </span>
          <span className="spd-opponent-draw" title="Karten im Nachziehstapel">
            🂠 {other.drawCount}
          </span>
          {other.stuck && <span title="Kommt nicht weiter">✋</span>}
        </div>
      )}

      <div className={`spd-center${flash ? ' spd-flash' : ''}`} aria-label="Mitte">
        {sideStack(0)}
        {[0, 1].map((i) => {
          const pile = view.piles[i]!;
          const shown = landing.has(i) ? pile[pile.length - 2] : topOf(pile);
          return (
            <div
              key={i}
              ref={(el) => {
                pileRefs.current[i] = el;
              }}
              data-drop-target={`pile-${i}`}
              className={`spd-pile${hovered.has(`pile-${i}`) ? ' spd-over' : ''}`}
              aria-label={`Ablagestapel ${i + 1}: ${shown ? cardName(shown) : 'leer'}`}
            >
              {shown ? <PlayingCard card={shown} deckStyle={view.deckStyle} className="spd-card" /> : <span className="spd-slot" />}
            </div>
          );
        })}
        {sideStack(1)}
      </div>

      {zone(bottom, false)}

      {view.phase !== 'play' && <RoundOverlay view={view} name={name} readyActions={readyActions} />}

      {tableRect &&
        flights.map((f) => (
          <span
            key={f.key}
            className="spd-flight"
            style={
              {
                left: f.from.left - tableRect.left,
                top: f.from.top - tableRect.top,
                width: f.from.width,
                height: f.from.height,
                '--dx': `${f.to.left + f.to.width / 2 - (f.from.left + f.from.width / 2)}px`,
                '--dy': `${f.to.top + f.to.height / 2 - (f.from.top + f.from.height / 2)}px`,
                '--scale': f.to.width / f.from.width || 1,
                animationDuration: `${FLIGHT_MS}ms`,
              } as CSSProperties
            }
          >
            <PlayingCard card={f.card} deckStyle={view.deckStyle} className="spd-card" />
          </span>
        ))}
    </div>
  );
}

function RoundOverlay({
  view,
  name,
  readyActions,
}: {
  view: SpeedView;
  name: (seat: SeatId) => string;
  /** Wer an diesem Gerät noch „Nächste Runde“ drücken kann. */
  readyActions: { seat: SeatId; name: string; onReady: () => void }[];
}) {
  const last = view.lastRound;
  const waiting = view.players.flatMap((p, seat) => (p.ready ? [] : [seat]));
  return (
    <div className="spd-overlay">
      <div className="spd-overlay-box">
        <p className="spd-overlay-title">{last ? `Speed! ${name(last.winner)} gewinnt Runde ${last.round}.` : 'Runde vorbei'}</p>
        <table className="spd-scores">
          <thead>
            <tr>
              <th />
              <th title="Karten, die noch übrig waren">Rest</th>
              <th>Siege</th>
            </tr>
          </thead>
          <tbody>
            {view.players.map((p, seat) => (
              <tr key={seat} className={last?.winner === seat ? 'spd-winner' : undefined}>
                <td>{name(seat)}</td>
                <td>{last?.left[seat]}</td>
                <td className="spd-total">
                  {p.wins} / {winsNeeded(view.goal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {view.phase === 'roundEnd' && (
          <>
            {readyActions.map((r) => (
              <button key={r.seat} type="button" className="spd-button spd-button-main" onClick={r.onReady}>
                {readyActions.length > 1 ? `${r.name}: Nächste Runde` : 'Nächste Runde'}
              </button>
            ))}
            {readyActions.length === 0 && <p className="spd-wait">Warte auf {waiting.map(name).join(', ')} …</p>}
          </>
        )}
      </div>
    </div>
  );
}

export const gameUi: GameUi<SpeedView, SpeedMove> = {
  Board,
  SeatSymbol: ({ className }) => <span className={className}>🏎️</span>,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return null;
    return `${p.hand.length + p.drawCount} Karten · ${p.wins} ${p.wins === 1 ? 'Sieg' : 'Siege'}`;
  },
  sounds: {
    played: 'karten-klatsch',
    flipped: 'karte-ziehen',
    stuck: 'festgefahren',
    reshuffled: 'mischen',
    speed: 'ruf-speed',
    roundStarted: 'mischen',
  },
};

export const ui = gameUi;
