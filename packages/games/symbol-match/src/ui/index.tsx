import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { buildCards, symbolText, type SymbolSet } from '../deck';
import type { SymbolMatchMove, SymbolMatchOptions, SymbolMatchView } from '../rules';
import './styles.css';

interface Placed {
  symbol: number;
  /** Mittelpunkt und Größe als Anteil des Kartendurchmessers. */
  x: number;
  y: number;
  size: number;
  rot: number;
}

/** Zufall, der nur von der Kartennummer abhängt – jede Karte sieht überall gleich aus. */
function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ein Symbol in der Mitte, die anderen im Ring – Größen so gewählt, dass nichts überlappt. */
const GEOMETRY: Record<number, { ring: number; ringSize: number; centerSize: number }> = {
  4: { ring: 0.32, ringSize: 0.3, centerSize: 0.32 },
  6: { ring: 0.34, ringSize: 0.28, centerSize: 0.3 },
  8: { ring: 0.355, ringSize: 0.23, centerSize: 0.26 },
};

function layout(card: number, symbols: number[], calm: boolean): Placed[] {
  const rnd = seeded(card + 1);
  const g = GEOMETRY[symbols.length] ?? GEOMETRY[8]!;
  // Welches Symbol in der Mitte steht und in welcher Reihenfolge der Ring läuft, ist je Karte anders.
  const order = [...symbols].sort(() => rnd() - 0.5);
  const offset = calm ? -Math.PI / 2 : rnd() * Math.PI * 2;
  const jitter = (spread: number) => (calm ? 1 : 1 - spread + rnd() * spread * 2);
  const out: Placed[] = [{ symbol: order[0]!, x: 0.5, y: 0.5, size: g.centerSize * jitter(0.08), rot: calm ? 0 : (rnd() - 0.5) * 70 }];
  const m = order.length - 1;
  for (let i = 0; i < m; i++) {
    const angle = offset + (i / m) * Math.PI * 2;
    out.push({
      symbol: order[i + 1]!,
      x: 0.5 + Math.cos(angle) * g.ring,
      y: 0.5 + Math.sin(angle) * g.ring,
      size: g.ringSize * jitter(0.1),
      rot: calm ? 0 : (rnd() - 0.5) * 70,
    });
  }
  return out;
}

interface CardProps {
  card: number;
  options: SymbolMatchOptions;
  /** Symbol antippen – ohne diese Funktion ist die Karte nur zum Anschauen. */
  onPick?: (symbol: number) => void;
  flash: { symbol: number; kind: 'ok' | 'bad' } | null;
  className?: string;
  label: string;
}

function SymbolCard({ card, options, onPick, flash, className = '', label }: CardProps) {
  const symbols = useMemo(() => buildCards(options.order)[card]!, [options.order, card]);
  const placed = useMemo(() => layout(card, symbols, options.calm), [card, symbols, options.calm]);
  const math = options.symbols === 'math';
  return (
    <div className={`sm-card ${className}`} role="group" aria-label={label} key={card}>
      {placed.map((p) => {
        const text = symbolText(options.symbols as SymbolSet, p.symbol, card);
        const hit = flash?.symbol === p.symbol ? ` sm-flash-${flash.kind}` : '';
        const fs = math ? p.size * (text.length <= 3 ? 30 : text.length <= 5 ? 22 : 18) : p.size * 62;
        const style: CSSProperties = {
          left: `${p.x * 100}%`,
          top: `${p.y * 100}%`,
          width: `${p.size * (math ? 1.45 : 1) * 100}%`,
          height: `${p.size * 100}%`,
          fontSize: `${fs}cqw`,
          transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
        };
        const cls = `sm-symbol${math ? ' sm-math' : ''}${hit}`;
        return onPick ? (
          <button key={p.symbol} type="button" className={cls} style={style} aria-label={text} onClick={() => onPick(p.symbol)}>
            {text}
          </button>
        ) : (
          <span key={p.symbol} className={cls} style={style} aria-hidden="true">
            {text}
          </span>
        );
      })}
    </div>
  );
}

type Zone = { seat: SeatId; legalMoves: SymbolMatchMove[]; onMove: (move: SymbolMatchMove) => void };

function name(names: string[], seat: SeatId): string {
  return names[seat] ?? `Platz ${seat + 1}`;
}

function countLabel(view: SymbolMatchView, seat: SeatId): string {
  const n = view.players[seat]?.count ?? 0;
  if (view.options.mode === 'fountain') return `${n} übrig`;
  return `${n} ${n === 1 ? 'Karte' : 'Karten'}`;
}

function ZoneView({ zone, view, names, rotated, flash }: { zone: Zone; view: SymbolMatchView; names: string[]; rotated: boolean; flash: CardProps['flash'] }) {
  const { options } = view;
  const active = zone.legalMoves.length > 0 && view.phase === 'play';
  const locked = view.locked[zone.seat] && view.phase === 'play';
  const pick = (target: SeatId) => (symbol: number) => {
    const top = view.players[target]?.top;
    if (view.center === null || top === null || top === undefined) return;
    zone.onMove({ type: 'claim', symbol, center: view.center, target, top });
  };
  const targets = options.mode === 'gift' ? view.players.map((_, s) => s).filter((s) => s !== zone.seat) : [zone.seat];
  return (
    <div className={`sm-zone${rotated ? ' sm-rotated' : ''}${locked ? ' sm-locked' : ''}`}>
      <div className="sm-zone-head">
        <b>{name(names, zone.seat)}</b>
        <span>{countLabel(view, zone.seat)}</span>
        {view.mistakes[zone.seat]! > 0 && <span className="sm-miss">✗ {view.mistakes[zone.seat]}</span>}
      </div>
      <div className={`sm-zone-cards${options.mode === 'gift' ? ' sm-zone-gift' : ''}`}>
        {targets.map((t) => {
          const top = view.players[t]?.top;
          return top === null || top === undefined ? null : (
            <div key={t} className="sm-target">
              {options.mode === 'gift' && <span className="sm-target-name">{name(names, t)}</span>}
              <SymbolCard card={top} options={options} onPick={active ? pick(t) : undefined} flash={flash} className="sm-card-zone sm-pop" label={options.mode === 'gift' ? `Karte von ${name(names, t)}` : 'Deine Karte'} />
            </div>
          );
        })}
      </div>
      {locked && <div className="sm-veil">Daneben! Warte auf die nächste Karte.</div>}
    </div>
  );
}

export function SymbolMatchBoard({ view, legalMoves, onMove, viewer, seatNames, humanSeats, events }: BoardProps<SymbolMatchView, SymbolMatchMove>) {
  const { options } = view;
  const zones: Zone[] =
    humanSeats && humanSeats.length > 1
      ? humanSeats.map((h) => ({ seat: h.seat, legalMoves: h.legalMoves, onMove: h.onMove }))
      : typeof viewer === 'number'
        ? [{ seat: viewer, legalMoves, onMove }]
        : [];

  // Gefundenes Symbol kurz hervorheben (grün) – oder das danebengetippte (rot).
  const [flash, setFlash] = useState<CardProps['flash']>(null);
  const lastEvents = useRef<GameEvent[] | null>(null);
  useEffect(() => {
    if (!events?.length || events === lastEvents.current) return;
    lastEvents.current = events;
    const hit = events.find((e) => e.type === 'claimed' || e.type === 'mistake') as { type: string; symbol: number } | undefined;
    if (!hit) return;
    setFlash({ symbol: hit.symbol, kind: hit.type === 'claimed' ? 'ok' : 'bad' });
    const timer = window.setTimeout(() => setFlash(null), hit.type === 'claimed' ? 900 : 600);
    return () => window.clearTimeout(timer);
  }, [events]);

  // Allein am Gerät kann man auch das Symbol auf der Mittelkarte antippen.
  const single = zones.length === 1 ? zones[0]! : null;
  const centerPick =
    single && single.legalMoves.length > 0 && view.phase === 'play' && view.center !== null
      ? (symbol: number) => {
          const cards = buildCards(options.order);
          const candidates = options.mode === 'gift' ? view.players.map((_, s) => s).filter((s) => s !== single.seat) : [single.seat];
          const target = candidates.find((t) => view.players[t]?.top != null && cards[view.players[t]!.top!]!.includes(symbol)) ?? candidates[0]!;
          const top = view.players[target]?.top;
          if (top === null || top === undefined) return;
          single.onMove({ type: 'claim', symbol, center: view.center!, target, top });
        }
      : undefined;

  const split = zones.length > 1;
  const topCount = split ? Math.floor(zones.length / 2) : 0;
  const others = view.players.map((_, s) => s).filter((s) => !zones.some((z) => z.seat === s));

  let status = '';
  if (view.phase === 'play') {
    if (view.last && !view.last.ok) status = `${name(seatNames, view.last.seat)}: daneben!${view.last.burned ? ' Die Karte wird verworfen.' : ''}`;
    else if (view.last) status = `${name(seatNames, view.last.seat)} hat es gefunden!`;
    else status = 'Findet das gleiche Symbol!';
  }

  return (
    <div className="sm-table" data-zones={zones.length} data-mode={options.mode}>
      <div className="sm-bar">
        {view.players.map((_, seat) => (
          <div key={seat} className={`sm-chip${view.locked[seat] ? ' sm-chip-locked' : ''}`}>
            <b>{name(seatNames, seat)}</b>
            <span>{countLabel(view, seat)}</span>
            {view.locked[seat] && view.phase === 'play' && <span title="Gesperrt bis zur nächsten Karte">🔒</span>}
          </div>
        ))}
        {options.mode !== 'fountain' && <div className="sm-chip sm-chip-deck">Stapel: {view.deckCount + (view.center === null ? 0 : 1)}</div>}
      </div>

      {split && (
        <div className="sm-zones sm-zones-top" style={{ gridTemplateColumns: `repeat(${topCount}, 1fr)` }}>
          {zones.slice(0, topCount).map((z) => (
            <ZoneView key={z.seat} zone={z} view={view} names={seatNames} rotated flash={flash} />
          ))}
        </div>
      )}

      <div className="sm-center">
        {view.center !== null ? <SymbolCard card={view.center} options={options} onPick={centerPick} flash={flash} className="sm-card-center sm-pop" label="Mittelkarte" /> : <div className="sm-card sm-card-center sm-empty" />}
      </div>

      <div className="sm-status" aria-live="polite">
        {status}
      </div>

      {!split && zones[0] && <ZoneView zone={zones[0]} view={view} names={seatNames} rotated={false} flash={flash} />}
      {split && (
        <div className="sm-zones" style={{ gridTemplateColumns: `repeat(${zones.length - topCount}, 1fr)` }}>
          {zones.slice(topCount).map((z) => (
            <ZoneView key={z.seat} zone={z} view={view} names={seatNames} rotated={false} flash={flash} />
          ))}
        </div>
      )}
      {zones.length === 0 && others.length > 0 && <div className="sm-note">Du schaust zu.</div>}

      {view.phase === 'gameEnd' && (
        <div className="sm-result">
          <b>Spiel zu Ende</b>
          <table>
            <thead>
              <tr>
                <th />
                <th>{options.mode === 'fountain' ? 'Karten übrig' : 'Karten'}</th>
                <th>Treffer</th>
                <th>✗</th>
              </tr>
            </thead>
            <tbody>
              {view.players.map((p, seat) => (
                <tr key={seat}>
                  <td>{name(seatNames, seat)}</td>
                  <td>{p.count}</td>
                  <td>{view.hits[seat]}</td>
                  <td>{view.mistakes[seat]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<SymbolMatchView, SymbolMatchMove> = {
  Board: SymbolMatchBoard,
  SeatSymbol: ({ className }) => <span className={className}>🔍</span>,
  seatLabel: (seat) => `Platz ${Number(seat) + 1}`,
  seatDetail: (view, seat) => countLabel(view, seat),
  seatScore: (view, seat) => view.hits[seat] ?? 0,
  sounds: {
    claimed: 'paar',
    mistake: 'kein-paar',
    burned: 'karte-ziehen',
  },
};
