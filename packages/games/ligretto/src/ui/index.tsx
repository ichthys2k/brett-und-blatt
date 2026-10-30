import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { totals, type Card, type CardSource, type LigrettoMove, type LigrettoView, type PlayerView } from '../rules';
import { CardBack, CardFace, SUIT_INFO, cardLabel } from './LigrettoCard';
import './styles.css';

type PlayMove = Extract<LigrettoMove, { type: 'play' }>;

interface Flight {
  key: string;
  card: Card;
  pile: number;
  from: DOMRect;
  to: DOMRect;
}

const FLIGHT_MS = 300;

function sourceKey(source: CardSource): string {
  return source.from === 'row' ? `row-${source.slot}` : source.from;
}

function cardAt(player: PlayerView, source: CardSource): Card | null {
  if (source.from === 'ligretto') return player.ligrettoTop;
  if (source.from === 'talon') return player.talonTop;
  return player.row[source.slot] ?? null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface ZoneProps {
  seat: SeatId;
  player: PlayerView;
  legalMoves: LigrettoMove[];
  onMove: (move: LigrettoMove) => void;
  /** Name über dem Bereich – nur am geteilten Bildschirm nötig. */
  name: string | null;
  /** Für die Spieler gegenüber am Tablet um 180° gedreht. */
  rotated: boolean;
  phase: LigrettoView['phase'];
  stuckNames: string[];
  /** Wo eine gezogene Karte losgelassen wurde – von dort fliegt sie in die Mitte. */
  onDropAt: (cardId: string, point: { x: number; y: number }) => void;
  /** Über welchem Stapel die gezogene Karte gerade schwebt (zum Hervorheben), sonst null. */
  onDragTarget: (seat: SeatId, target: string | null) => void;
}

/** Der eigene Bereich eines Spielers: Blitzstapel, Reihe, Hand und „Festgefahren“. */
function PlayerZone({ seat, player, legalMoves, onMove, name, rotated, phase, stuckNames, onDropAt, onDragTarget }: ZoneProps) {
  const plays = useMemo(() => legalMoves.filter((m): m is PlayMove => m.type === 'play'), [legalMoves]);
  const canFlip = legalMoves.some((m) => m.type === 'flip');
  const canStuck = legalMoves.some((m) => m.type === 'stuck');
  const [shake, setShake] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);

  const movesFor = useCallback((source: CardSource) => plays.filter((m) => sourceKey(m.source) === sourceKey(source)), [plays]);

  const tryPlay = useCallback(
    (source: CardSource, target?: string | null) => {
      const options = movesFor(source);
      let move: PlayMove | undefined;
      if (target === undefined) move = options[0];
      else if (target === 'new') move = options.find((m) => m.pile === null);
      else if (target?.startsWith('pile-')) move = options.find((m) => m.pile === Number(target.slice(5)));
      if (!move) {
        setShake(sourceKey(source));
        timer.current = window.setTimeout(() => setShake(null), 350);
        return false;
      }
      onMove(move);
      return true;
    },
    [movesFor, onMove],
  );

  const { dragState, bindDrag } = usePointerDrag<CardSource>({
    threshold: 6,
    disabled: plays.length === 0,
    onDrop: (source, targetId, point) => {
      const card = cardAt(player, source);
      if (card) onDropAt(card.id, point);
      return tryPlay(source, targetId ?? 'none');
    },
    onClick: (source) => tryPlay(source),
  });

  const target = dragState.isDragging ? dragState.targetId : null;
  useEffect(() => onDragTarget(seat, target), [onDragTarget, seat, target]);

  const playable = (source: CardSource) => movesFor(source).length > 0;
  const dragging = dragState.isDragging ? dragState.item : null;
  // Im gedrehten Bereich läuft die Verschiebung gegen die Bildschirmrichtung.
  const sign = rotated ? -1 : 1;
  const dragStyle = (source: CardSource): CSSProperties | undefined =>
    dragging && sourceKey(dragging) === sourceKey(source)
      ? {
          transform: `translate(${sign * dragState.delta.x}px, ${sign * dragState.delta.y}px) scale(1.06)`,
          zIndex: 40,
          transition: dragState.snapping ? 'transform 180ms ease' : 'none',
        }
      : undefined;

  const handCard = (source: CardSource, card: Card | null, extra?: { count?: number; label?: string }) => {
    const key = sourceKey(source);
    if (!card) return <span className="lg-slot" aria-label={extra?.label ? `${extra.label}: leer` : 'leer'} />;
    const can = playable(source);
    return (
      <button
        type="button"
        data-card-id={card.id}
        className={`lg-card${can ? ' lg-playable' : ''}${shake === key ? ' lg-shake' : ''}`}
        aria-label={`${extra?.label ? `${extra.label}: ` : ''}${cardLabel(card)}${can ? ', kann gelegt werden' : ''}`}
        disabled={legalMoves.length === 0}
        {...bindDrag(source)}
        style={{ ...bindDrag(source).style, ...dragStyle(source) }}
      >
        <CardFace card={card} />
        {extra?.count !== undefined && <span className="lg-count">{extra.count}</span>}
      </button>
    );
  };

  return (
    <div className={`lg-mine${rotated ? ' lg-rotated' : ''}`} data-seat={seat}>
      <div className="lg-status" role="status">
        {name && <strong className="lg-zone-name">{name}</strong>}
        {phase === 'play' && player.stuck && 'Du kommst nicht weiter – sobald sich in der Mitte etwas tut, geht’s weiter.'}
        {phase === 'play' && !player.stuck && stuckNames.length > 0 && `Kommt nicht weiter: ${stuckNames.join(', ')}`}
      </div>
      <div className="lg-zone">
        <div className="lg-group">
          <span className="lg-label">Blitz</span>
          {handCard({ from: 'ligretto' }, player.ligrettoTop, { count: player.ligrettoCount, label: 'Blitzstapel' })}
        </div>
        <div className="lg-group lg-row-group">
          <span className="lg-label">Reihe</span>
          <div className="lg-row">
            {player.row.map((card, slot) => (
              <span key={slot}>{handCard({ from: 'row', slot }, card, { label: `Reihe ${slot + 1}` })}</span>
            ))}
          </div>
        </div>
        <div className="lg-group">
          <span className="lg-label">Hand</span>
          <div className="lg-hand">
            <button
              type="button"
              className={`lg-card lg-deck${canFlip ? ' lg-flippable' : ''}`}
              onClick={() => canFlip && onMove({ type: 'flip' })}
              disabled={!canFlip}
              aria-label={player.handCount > 0 ? `Handkarten umblättern (${player.handCount} übrig)` : 'Talon umdrehen'}
            >
              {player.handCount > 0 ? <CardBack /> : <span className="lg-slot lg-turn">↻</span>}
              {player.handCount > 0 && <span className="lg-count">{player.handCount}</span>}
            </button>
            {handCard({ from: 'talon' }, player.talonTop, { label: 'Talon' })}
          </div>
        </div>
        <div className="lg-actions">
          <button type="button" className="lg-button" onClick={() => onMove({ type: 'stuck' })} disabled={!canStuck}>
            ✋ Festgefahren
          </button>
        </div>
      </div>
    </div>
  );
}

function Board({ view, legalMoves, onMove, events, viewer, seatNames, humanSeats }: BoardProps<LigrettoView, LigrettoMove>) {
  const me = typeof viewer === 'number' ? viewer : null;
  // Geteilter Bildschirm: mehrere Menschen an einem Gerät, jeder mit eigenem Bereich.
  const split = humanSeats !== undefined && humanSeats.length > 1;
  const zones: { seat: SeatId; legalMoves: LigrettoMove[]; onMove: (move: LigrettoMove) => void }[] = split
    ? humanSeats!.map((h) => ({ seat: h.seat, legalMoves: h.legalMoves as LigrettoMove[], onMove: h.onMove as (move: LigrettoMove) => void }))
    : me !== null
      ? [{ seat: me, legalMoves, onMove }]
      : [];
  const zoneSeats = new Set(zones.map((z) => z.seat));
  // Die erste Hälfte sitzt gegenüber (oben, gedreht), die anderen unten.
  const topCount = split ? Math.floor(zones.length / 2) : 0;

  const tableRef = useRef<HTMLDivElement | null>(null);
  const pileRefs = useRef(new Map<number, HTMLElement>());
  const seatRefs = useRef(new Map<number, HTMLElement>());
  const cardRects = useRef(new Map<string, DOMRect>());
  const centerRef = useRef<HTMLDivElement | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [dragTargets, setDragTargets] = useState<Record<number, string | null>>({});
  const onDragTarget = useCallback(
    (seat: SeatId, target: string | null) => setDragTargets((t) => (t[seat] === target ? t : { ...t, [seat]: target })),
    [],
  );
  const hovered = new Set(Object.values(dragTargets).filter((t): t is string => t !== null));
  const dropPoint = useRef<{ id: string; x: number; y: number } | null>(null);
  const handled = useRef<GameEvent[] | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  // Lage der eigenen Karten und Mitspieler merken: Von dort fliegen gelegte Karten los.
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    cardRects.current.clear();
    table.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => cardRects.current.set(el.dataset.cardId!, el.getBoundingClientRect()));
  });

  useLayoutEffect(() => {
    if (!events || events === handled.current) return;
    handled.current = events;
    const table = tableRef.current;
    if (!table) return;
    const reduced = prefersReducedMotion();
    const next: Flight[] = [];
    for (const event of events) {
      if (event.type === 'pileCleared') {
        setFlash(event.pile as number);
        later(() => setFlash(null), 600);
      }
      if (event.type !== 'played' || reduced) continue;
      const card = event.card as Card;
      const pile = event.pile as number;
      const target = pileRefs.current.get(pile) ?? centerRef.current;
      if (!target) continue;
      let from: DOMRect | undefined;
      const dropped = dropPoint.current;
      if (dropped && dropped.id === card.id) {
        const size = cardRects.current.get(card.id);
        from = new DOMRect(dropped.x - (size?.width ?? 40) / 2, dropped.y - (size?.height ?? 58) / 2, size?.width ?? 40, size?.height ?? 58);
        dropPoint.current = null;
      } else {
        from = cardRects.current.get(card.id) ?? seatRefs.current.get(event.seat as number)?.getBoundingClientRect();
      }
      if (!from) continue;
      next.push({ key: `${card.id}-${Math.random()}`, card, pile, from, to: target.getBoundingClientRect() });
    }
    if (next.length > 0) {
      setFlights((f) => [...f, ...next]);
      later(() => setFlights((f) => f.filter((x) => !next.includes(x))), FLIGHT_MS + 40);
    }
  }, [events]);

  const landing = useMemo(() => new Set(flights.map((f) => f.pile)), [flights]);
  const tableRect = tableRef.current?.getBoundingClientRect();
  const name = (seat: SeatId) => seatNames[seat] ?? `Spieler ${seat + 1}`;
  const others = view.players.map((p, seat) => ({ p, seat })).filter(({ seat }) => !zoneSeats.has(seat));
  const stuckOthers = (seat: SeatId) =>
    view.players.flatMap((p, s) => (s !== seat && p.stuck ? [name(s)] : []));

  const zone = (z: (typeof zones)[number], rotated: boolean) => {
    const player = view.players[z.seat];
    if (!player) return null;
    return (
      <PlayerZone
        key={z.seat}
        seat={z.seat}
        player={player}
        legalMoves={z.legalMoves}
        onMove={z.onMove}
        name={split ? name(z.seat) : null}
        rotated={rotated}
        phase={view.phase}
        stuckNames={stuckOthers(z.seat)}
        onDropAt={(id, point) => {
          dropPoint.current = { id, ...point };
        }}
        onDragTarget={onDragTarget}
      />
    );
  };

  const readyActions = zones
    .filter((z) => z.legalMoves.some((m) => m.type === 'ready'))
    .map((z) => ({ seat: z.seat, name: name(z.seat), onReady: () => z.onMove({ type: 'ready' }) }));

  return (
    <div ref={tableRef} className={`lg-table${split ? ` lg-split lg-split-${Math.min(zones.length, 4)}` : ''}`}>
      {split && <div className="lg-zones lg-zones-top">{zones.slice(0, topCount).map((z) => zone(z, true))}</div>}

      {others.length > 0 && (
        <div className="lg-others">
          {others.map(({ p, seat }) => (
            <div
              key={seat}
              ref={(el) => {
                if (el) seatRefs.current.set(seat, el);
              }}
              className={`lg-other${p.stuck ? ' lg-other-stuck' : ''}`}
            >
              <span className="lg-other-name">{name(seat)}</span>
              <span className="lg-other-cards">
                {p.ligrettoTop ? <CardFace card={p.ligrettoTop} small /> : <CardBack small />}
                <span className="lg-other-count" title="Karten im Blitzstapel">
                  {p.ligrettoCount}
                </span>
              </span>
              {p.stuck && (
                <span className="lg-other-flag" title="Kommt nicht weiter">
                  ✋
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div ref={centerRef} className="lg-center" aria-label="Mitte">
        {view.center.map((pile) => {
          const shown = landing.has(pile.id) ? pile.cards[pile.cards.length - 2] : pile.cards[pile.cards.length - 1];
          const over = hovered.has(`pile-${pile.id}`);
          return (
            <div
              key={pile.id}
              ref={(el) => {
                if (el) pileRefs.current.set(pile.id, el);
                else pileRefs.current.delete(pile.id);
              }}
              data-drop-target={`pile-${pile.id}`}
              className={`lg-pile${over ? ' lg-over' : ''}${flash === pile.id ? ' lg-flash' : ''}`}
              aria-label={`Stapel ${SUIT_INFO[pile.suit].name} bis ${pile.cards.length}`}
            >
              {shown ? <CardFace card={shown} /> : <span className="lg-slot" />}
              <span className="lg-pile-depth" style={{ '--depth': Math.min(pile.cards.length, 6) } as CSSProperties} />
            </div>
          );
        })}
        <div data-drop-target="new" className={`lg-pile lg-new${hovered.has('new') ? ' lg-over' : ''}`} aria-label="Neuer Stapel – nur mit einer 1">
          <span className="lg-slot lg-new-slot">1</span>
        </div>
      </div>

      {split ? <div className="lg-zones lg-zones-bottom">{zones.slice(topCount).map((z) => zone(z, false))}</div> : zones[0] && zone(zones[0], false)}

      {view.phase !== 'play' && <RoundOverlay view={view} seatNames={seatNames} mine={zoneSeats} readyActions={readyActions} />}

      {tableRect &&
        flights.map((f) => (
          <span
            key={f.key}
            className="lg-flight"
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
            <CardFace card={f.card} />
          </span>
        ))}
    </div>
  );
}

function RoundOverlay({
  view,
  seatNames,
  mine,
  readyActions,
}: {
  view: LigrettoView;
  seatNames: string[];
  /** Plätze der Menschen an diesem Gerät (hervorgehoben). */
  mine: Set<SeatId>;
  /** Wer an diesem Gerät noch „Nächste Runde“ drücken kann. */
  readyActions: { seat: SeatId; name: string; onReady: () => void }[];
}) {
  const last = view.lastRound;
  const sums = totals(view.scores);
  const order = view.players.map((_, seat) => seat).sort((a, b) => sums[b]! - sums[a]!);
  const name = (seat: SeatId) => seatNames[seat] ?? `Spieler ${seat + 1}`;
  const waiting = view.players.flatMap((p, seat) => (p.ready ? [] : [seat]));
  return (
    <div className="lg-overlay">
      <div className="lg-overlay-box">
        <p className="lg-overlay-title">
          {last?.endedBy !== null && last?.endedBy !== undefined ? `Blitz! ${name(last.endedBy)} ist fertig.` : 'Runde vorbei'}
        </p>
        <table className="lg-scores">
          <thead>
            <tr>
              <th />
              <th title="Karten in der Mitte">+</th>
              <th title="Karten im Blitzstapel (×2)">−</th>
              <th>Runde {last?.round}</th>
              <th>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {order.map((seat) => (
              <tr key={seat} className={mine.has(seat) ? 'lg-me' : undefined}>
                <td>{name(seat)}</td>
                <td>{last?.played[seat]}</td>
                <td>{last ? last.left[seat]! * 2 : ''}</td>
                <td>{last?.points[seat]}</td>
                <td className="lg-total">{sums[seat]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {view.phase === 'roundEnd' && (
          <>
            {readyActions.map((r) => (
              <button key={r.seat} type="button" className="lg-button lg-button-main" onClick={r.onReady}>
                {readyActions.length > 1 || mine.size > 1 ? `${r.name}: Nächste Runde` : 'Nächste Runde'}
              </button>
            ))}
            {readyActions.length === 0 && <p className="lg-wait">Warte auf {waiting.map(name).join(', ')} …</p>}
          </>
        )}
      </div>
    </div>
  );
}

export const gameUi: GameUi<LigrettoView, LigrettoMove> = {
  Board,
  SeatSymbol: ({ className }) => <span className={className}>⚡</span>,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return null;
    const sum = totals(view.scores)[seat] ?? 0;
    return `${p.ligrettoCount} im Stapel · ${sum} Pkt.`;
  },
  sounds: {
    played: 'karten-klatsch',
    flipped: 'karte-ziehen',
    turnedOver: 'mischen',
    pileCleared: 'stapel-fertig',
    stuck: 'festgefahren',
    unjammed: 'mischen',
    ligretto: 'ruf-kartenblitz',
    roundStarted: 'mischen',
  },
};

export const ui = gameUi;
