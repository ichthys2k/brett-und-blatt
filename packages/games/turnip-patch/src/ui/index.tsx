/**
 * Die Oberfläche von Rübenacker: ein Beet mit Schlangenweg zur Riesenrübe, Zaunpfählen,
 * Maulwurfspur und Erdhügel. Karte ziehen, dann einen Hasen antippen (oder sein Ziel).
 */
import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, useLatestEvent, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import {
  FENCE_POSTS,
  MEADOW,
  MOLE_ROUTE,
  TRACK_LENGTH,
  TURNIP,
  hillField,
  remainingCards,
  targetOf,
  type Card,
  type TurnipMove,
  type TurnipState,
} from '../rules';
import './styles.css';

const PLAYERS = [
  { name: 'Rot', fill: '#DC2626', mark: '●' },
  { name: 'Blau', fill: '#2563EB', mark: '▲' },
  { name: 'Grün', fill: '#16A34A', mark: '■' },
  { name: 'Gelb', fill: '#CA8A04', mark: '★' },
  { name: 'Lila', fill: '#9333EA', mark: '◆' },
  { name: 'Türkis', fill: '#0D9488', mark: '✚' },
] as const;

const WIDTH = 600;
const HEIGHT = 860;
const PER_ROW = 6;
const ROW_Y = [690, 535, 380, 225];
const COL_X = [75, 165, 255, 345, 435, 525];
const TURNIP_POS = { x: 300, y: 82 };
const MEADOW_POS = { x: 300, y: 805 };

/** Mitte eines Feldes 1 … 24 auf dem Schlangenweg (Reihe 1 unten, von links nach rechts). */
function fieldPos(field: number): { x: number; y: number } {
  if (field === MEADOW) return MEADOW_POS;
  if (field >= TURNIP) return TURNIP_POS;
  const index = field - 1;
  const row = Math.floor(index / PER_ROW);
  const col = index % PER_ROW;
  return { x: COL_X[row % 2 === 0 ? col : PER_ROW - 1 - col]!, y: ROW_Y[row]! };
}

/** Der Weg als Linie: Wiese, alle Felder, Rübe. */
const PATH_POINTS = [MEADOW, ...Array.from({ length: TRACK_LENGTH }, (_, i) => i + 1), TURNIP].map(fieldPos);

/** Mehrere Hasen auf Wiese oder Rübe nebeneinander. */
function crowdOffset(index: number, count: number, spread: number): { dx: number; dy: number } {
  if (count <= 1) return { dx: 0, dy: 0 };
  const perRow = 6;
  const row = Math.floor(index / perRow);
  const inRow = Math.min(perRow, count - row * perRow);
  const col = index % perRow;
  return { dx: (col - (inRow - 1) / 2) * spread, dy: (row - (Math.ceil(count / perRow) - 1) / 2) * spread * 0.8 };
}

function CardFace({ card }: { card: Card | null }) {
  if (card === null) return <div className="rub-card rub-card-empty" aria-hidden="true" />;
  if (card === 'mole') {
    return (
      <div className="rub-card rub-card-mole" aria-label="Karte: Maulwurf">
        <svg viewBox="-30 -30 60 60" aria-hidden="true">
          <Mole />
        </svg>
        <span>Maulwurf</span>
      </div>
    );
  }
  return (
    <div className="rub-card" aria-label={`Karte: ${card}`}>
      <span className="rub-card-number">{card}</span>
      <span className="rub-card-paws" aria-hidden="true">{'🐾'.repeat(card)}</span>
    </div>
  );
}

/** Gärtner Maulwurf, gezeichnet um den Nullpunkt. */
function Mole() {
  return (
    <g>
      <ellipse cx="0" cy="8" rx="20" ry="16" fill="#4b3b33" />
      <circle cx="0" cy="-6" r="14" fill="#5b4a40" />
      <circle cx="-5" cy="-9" r="2.2" fill="#111" />
      <circle cx="5" cy="-9" r="2.2" fill="#111" />
      <ellipse cx="0" cy="-1" rx="5" ry="3.6" fill="#f9a8d4" />
      <path d="M-14 14 q-6 4 -10 0 M14 14 q6 4 10 0" stroke="#f9a8d4" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Hare({ seat }: { seat: SeatId }) {
  const style = PLAYERS[seat % PLAYERS.length]!;
  return (
    <g>
      <ellipse cx="-7" cy="-26" rx="5" ry="13" fill="#f5f5f4" stroke={style.fill} strokeWidth="3" />
      <ellipse cx="7" cy="-26" rx="5" ry="13" fill="#f5f5f4" stroke={style.fill} strokeWidth="3" />
      <circle r="17" fill="#f5f5f4" stroke={style.fill} strokeWidth="5" />
      <circle cx="-6" cy="-4" r="2.2" fill="#1f2937" />
      <circle cx="6" cy="-4" r="2.2" fill="#1f2937" />
      <ellipse cx="0" cy="3" rx="3" ry="2.2" fill="#f472b6" />
      <text y="14" className="rub-hare-mark" fill={style.fill}>
        {style.mark}
      </text>
    </g>
  );
}

function Board({ view, legalMoves, onMove, events, activeSeat, hint, seatNames }: BoardProps<TurnipState, TurnipMove>) {
  const canDraw = legalMoves.some((m) => m.type === 'draw');
  const hopHares = new Set(legalMoves.flatMap((m) => (m.type === 'hop' ? [m.hare] : [])));
  const mover = hopHares.size > 0 ? (activeSeat ?? view.turn) : null;
  const hill = hillField(view);
  const nextHill = hillField(view, 1);
  const hintHare = hint?.type === 'hop' ? hint.hare : null;
  const moles = remainingCards(view).filter((c) => c === 'mole').length;

  const drawnEvent = useLatestEvent(events, (e) => e.type === 'drawn');
  const lastCard = (drawnEvent.event?.card as Card | undefined) ?? null;
  const moleEvent = useLatestEvent(events, (e) => e.type === 'mole');
  const moleHole = (moleEvent.event?.hole as number | undefined) ?? null;
  const moleFresh = events.some((e) => e.type === 'mole');

  const name = (seat: SeatId) => seatNames[seat] ?? PLAYERS[seat % PLAYERS.length]!.name;
  const status = (() => {
    if (view.winner !== null) return `${name(view.winner)} hat die Riesenrübe erreicht!`;
    if (moleFresh && moleHole !== null) {
      const fell = (moleEvent.event?.fallen as unknown[] | undefined)?.length ?? 0;
      const then = canDraw ? ' Jetzt du: Zieh eine Karte!' : '';
      if (fell > 0) return `Maulwurf! ${fell === 1 ? 'Ein Hase purzelt' : `${fell} Hasen purzeln`} ins Loch.${then}`;
      return `Maulwurf! Zum Glück saß dort kein Hase.${then}`;
    }
    if (canDraw) return 'Zieh eine Karte!';
    if (mover !== null) return `Welcher Hase hüpft ${view.card} ${view.card === 1 ? 'Feld' : 'Felder'}?`;
    return `${name(view.turn)} ist dran.`;
  })();

  // Wohin jeder wählbare Hase springen würde.
  const previews = mover === null || view.card === null
    ? []
    : [...hopHares].map((hare) => {
        const from = view.hares[mover]![hare]!;
        return { hare, to: targetOf(view, from, view.card!) };
      });

  // Hasen nach Feld gruppieren, damit sich Wiese und Rübe teilen lassen.
  const crowds = new Map<number, { seat: SeatId; hare: number }[]>();
  view.hares.forEach((list, seat) =>
    list.forEach((field, hare) => {
      const crowd = crowds.get(field) ?? [];
      crowd.push({ seat, hare });
      crowds.set(field, crowd);
    }),
  );

  return (
    <div className="rub-wrap">
      <div className="rub-board-area">
        <FitBox ratio={WIDTH / HEIGHT}>
          <svg className="rub-board" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Rübenacker">
            <rect className="rub-soil" x="8" y="8" width={WIDTH - 16} height={HEIGHT - 16} rx="36" />
            {/* Furchen im Beet */}
            {ROW_Y.map((y) => (
              <line key={y} className="rub-furrow" x1="30" x2={WIDTH - 30} y1={y + 52} y2={y + 52} />
            ))}
            <polyline className="rub-path" points={PATH_POINTS.map((p) => `${p.x},${p.y}`).join(' ')} />
            <ellipse className="rub-meadow" cx={MEADOW_POS.x} cy={MEADOW_POS.y} rx="250" ry="42" />
            <text className="rub-label" x={MEADOW_POS.x} y={MEADOW_POS.y + 36}>Wiese</text>
            {/* Riesenrübe */}
            <g transform={`translate(${TURNIP_POS.x} ${TURNIP_POS.y})`} className="rub-turnip">
              <path d="M-14 -40 q-18 -26 -6 -38 q8 14 10 30 q4 -22 16 -30 q8 16 -6 38 z" fill="#16a34a" />
              <path d="M-48 -18 q48 -40 96 0 q-8 44 -48 76 q-40 -32 -48 -76 z" fill="#f97316" stroke="#c2410c" strokeWidth="3" />
              <path d="M-20 0 h16 M-10 18 h14 M2 34 h10" stroke="#c2410c" strokeWidth="3" strokeLinecap="round" />
            </g>
            {Array.from({ length: TRACK_LENGTH }, (_, i) => i + 1).map((field) => {
              const p = fieldPos(field);
              const isHole = (MOLE_ROUTE as readonly number[]).includes(field);
              const isFence = (FENCE_POSTS as readonly number[]).includes(field);
              return (
                <g key={field}>
                  {isFence && (
                    <g className="rub-fence" transform={`translate(${p.x + (fieldPos(field).x < WIDTH / 2 ? -44 : 44)} ${p.y - 28})`} aria-label="Zaunpfahl">
                      <rect x="-5" y="-6" width="10" height="38" rx="2" />
                      <path d="M-5 -6 l5 -8 l5 8 z" />
                    </g>
                  )}
                  <circle
                    className={`rub-field${isHole ? ' rub-field-hole' : ''}${field === hill ? ' rub-field-hill' : ''}`}
                    cx={p.x}
                    cy={p.y}
                    r="32"
                  />
                  {field === hill && (
                    <g className="rub-mound" aria-label="Erdhügel: hier taucht der Maulwurf als Nächstes auf">
                      <path d={`M${p.x - 36} ${p.y + 30} q36 -52 72 0 z`} />
                    </g>
                  )}
                  {field === nextHill && (
                    <path className="rub-next-hill" d={`M${p.x - 24} ${p.y + 20} q24 -26 48 0 z`} aria-label="Nächster Erdhügel" />
                  )}
                  <text className="rub-field-number" x={p.x} y={p.y + 6}>
                    {field}
                  </text>
                </g>
              );
            })}
            {/* Maulwurfspur: vom Erdhügel zum nächsten Hügel */}
            <line
              className="rub-tunnel"
              x1={fieldPos(hill).x}
              y1={fieldPos(hill).y}
              x2={fieldPos(nextHill).x}
              y2={fieldPos(nextHill).y}
            />
            {/* Ziel-Vorschau der wählbaren Hasen */}
            {previews.map(({ hare, to }) => {
              const p = fieldPos(to);
              return (
                <circle
                  key={`t${hare}`}
                  className={`rub-preview${to === hill ? ' rub-preview-danger' : ''}${hintHare === hare ? ' rub-preview-hint' : ''}`}
                  cx={p.x}
                  cy={p.y}
                  r={to === TURNIP ? 56 : 30}
                  onClick={() => onMove({ type: 'hop', hare })}
                />
              );
            })}
            {/* Maulwurf taucht auf */}
            {moleFresh && moleHole !== null && (
              <g key={moleEvent.count} className="rub-mole-pop" transform={`translate(${fieldPos(moleHole).x} ${fieldPos(moleHole).y})`}>
                <circle r="30" className="rub-hole" />
                <Mole />
              </g>
            )}
            {[...crowds.entries()].flatMap(([field, crowd]) =>
              crowd.map(({ seat, hare }, index) => {
                const p = fieldPos(field);
                const open = field === MEADOW || field === TURNIP;
                const { dx, dy } = open ? crowdOffset(index, crowd.length, field === MEADOW ? 42 : 30) : crowdOffset(index, crowd.length, 18);
                const movable = seat === mover && hopHares.has(hare);
                return (
                  <g
                    key={`h${seat}-${hare}`}
                    className={`rub-hare${movable ? ' rub-hare-movable' : ''}${movable && hintHare === hare ? ' rub-hare-hint' : ''}`}
                    style={{ transform: `translate(${p.x + dx}px, ${p.y + dy - 6}px)` }}
                    onClick={movable ? () => onMove({ type: 'hop', hare }) : undefined}
                    role={movable ? 'button' : undefined}
                    tabIndex={movable ? 0 : undefined}
                    aria-label={`Hase ${PLAYERS[seat % PLAYERS.length]!.name}${field === MEADOW ? ' auf der Wiese' : field === TURNIP ? ' an der Rübe' : ` auf Feld ${field}`}${movable ? ', hüpfen lassen' : ''}`}
                    onKeyDown={movable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onMove({ type: 'hop', hare })) : undefined}
                  >
                    <Hare seat={seat} />
                  </g>
                );
              }),
            )}
          </svg>
        </FitBox>
      </div>
      <div className="rub-controls">
        <button
          type="button"
          className={`rub-deck${canDraw ? ' rub-deck-active' : ''}`}
          onClick={canDraw ? () => onMove({ type: 'draw' }) : undefined}
          disabled={!canDraw}
          aria-label={`Karte ziehen, ${view.deck.length} im Stapel`}
        >
          <span className="rub-deck-back" aria-hidden="true">🥕</span>
          <span className="rub-deck-count">{view.deck.length}</span>
        </button>
        <div key={drawnEvent.count} className="rub-card-slot">
          <CardFace card={lastCard} />
        </div>
        <div className="rub-info">
          <p className="rub-status" aria-live="polite">{status}</p>
          <p className="rub-moles">Maulwurf-Karten im Stapel: {moles}</p>
        </div>
      </div>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; seats?: number; className?: string }) {
  const style = PLAYERS[Number(seat) % PLAYERS.length]!;
  return (
    <span className={`rub-symbol ${className}`} style={{ background: style.fill }} aria-hidden="true">
      {style.mark}
    </span>
  );
}

export const gameUi: GameUi<TurnipState, TurnipMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => PLAYERS[Number(seat) % PLAYERS.length]!.name,
  seatDetail: (view, seat) => {
    const hares = view.hares[seat] ?? [];
    const best = Math.max(...hares);
    return best >= TURNIP ? 'an der Rübe' : best === MEADOW ? 'auf der Wiese' : `vorne: Feld ${best}`;
  },
  sounds: {
    drawn: 'karte-umdrehen',
    hopped: 'stein-ziehen',
    fell: 'stein-fallen',
    arrived: 'nh-jubel',
    win: 'sieg',
  },
};
