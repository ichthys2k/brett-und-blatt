import type { SeatId } from '@brett-und-blatt/engine';
import { type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useId, useState } from 'react';
import {
  HEX_DIRECTIONS,
  hexKey,
  parseHexKey,
  type GrafschaftMove,
  type GrafschaftState,
  type Landscape,
  type PlacedTile,
  type QuestDef,
  type Tile,
} from '../rules';
import { landImage, questImage } from './bilder';
import './styles.css';

const PLAYER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea'];
const PLAYER_NAMES = ['Kornblumenblau', 'Purpurrot', 'Smaragdgrün', 'Bernsteingelb', 'Amethystviolett'];

const LANDSCAPE_NAMES: Record<Landscape, string> = {
  wald: 'Wald',
  wiese: 'Wiese',
  feld: 'Feld',
  teich: 'Teich',
  dorf: 'Dorf',
  berg: 'Berg',
};

const LANDSCAPE_SYMBOLS: Record<Landscape, string> = {
  wald: '🌲',
  wiese: '🐑',
  feld: '🌾',
  teich: '🌊',
  dorf: '🏠',
  berg: '⛰️',
};

const HEX_RADIUS = 38;
const SQRT_3 = Math.sqrt(3);

function hexToPixel(q: number, r: number, radius = HEX_RADIUS): { cx: number; cy: number } {
  const cx = radius * (SQRT_3 * q + (SQRT_3 / 2) * r);
  const cy = radius * (1.5 * r);
  return { cx, cy };
}

function hexPolygonPoints(cx: number, cy: number, radius = HEX_RADIUS): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (30 + i * 60);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Gemalte Landschaft im Sechseck (nur Taverne-Aussehen, CSS in styles.css); Rahmen und Merkmale bleiben Vektor. */
function HexArt({ type, cx, cy, radius, clipId }: { type: Landscape; cx: number; cy: number; radius: number; clipId: string }) {
  const url = landImage(type);
  if (!url) return null;
  return (
    <>
      <clipPath id={clipId}>
        <polygon points={hexPolygonPoints(cx, cy, radius)} />
      </clipPath>
      <image className="gs-hex-art" href={url} x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
    </>
  );
}

function TileHexSvg({ tile, cx = 30, cy = 30, radius = 26 }: { tile: Tile; cx?: number; cy?: number; radius?: number }) {
  const points = hexPolygonPoints(cx, cy, radius);
  const clipId = `gs-clip-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox={`0 0 ${cx * 2} ${cy * 2}`} className="gs-tile-preview-svg" aria-hidden="true">
      <HexArt type={tile.type} cx={cx} cy={cy} radius={radius} clipId={clipId} />
      <polygon points={points} className={`gs-hex gs-hex--${tile.type}`} />
      {tile.river && <path d={`M ${cx - radius * 0.7} ${cy - radius * 0.3} Q ${cx} ${cy + radius * 0.5} ${cx + radius * 0.7} ${cy - radius * 0.2}`} className="gs-feature-river" />}
      {tile.road && <path d={`M ${cx - radius * 0.7} ${cy + radius * 0.3} Q ${cx} ${cy - radius * 0.4} ${cx + radius * 0.7} ${cy + radius * 0.4}`} className="gs-feature-road" />}
      {tile.mill && (
        <circle cx={cx} cy={cy} r={radius * 0.28} className="gs-feature-mill" />
      )}
      <text x={cx} y={cy} className="gs-hex-symbol">
        {LANDSCAPE_SYMBOLS[tile.type]}
      </text>
    </svg>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames }: BoardProps<GrafschaftState, GrafschaftMove>) {
  const [selectedMarketIndex, setSelectedMarketIndex] = useState<number>(0);

  const mySeat = viewer === 'spectator' ? null : viewer;
  const isMyTurn = mySeat !== null && view.turn === mySeat && legalMoves.length > 0;

  // Freie Nachbarfelder (Ghost-Placements)
  const ghostCoords: { q: number; r: number }[] = [];
  const occupiedKeys = new Set(Object.keys(view.board));
  const ghostKeys = new Set<string>();

  for (const key of occupiedKeys) {
    const { q, r } = parseHexKey(key);
    for (const [dq, dr] of HEX_DIRECTIONS) {
      const nq = q + dq;
      const nr = r + dr;
      const nKey = hexKey(nq, nr);
      if (!occupiedKeys.has(nKey) && !ghostKeys.has(nKey)) {
        ghostKeys.add(nKey);
        ghostCoords.push({ q: nq, r: nr });
      }
    }
  }

  // Bounding Box für SVG berechnen
  const allCoords = [
    ...Object.values(view.board).map((t) => ({ q: t.q, r: t.r })),
    ...ghostCoords,
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const { q, r } of allCoords) {
    const { cx, cy } = hexToPixel(q, r);
    minX = Math.min(minX, cx - HEX_RADIUS);
    maxX = Math.max(maxX, cx + HEX_RADIUS);
    minY = Math.min(minY, cy - HEX_RADIUS);
    maxY = Math.max(maxY, cy + HEX_RADIUS);
  }

  const padding = 28;
  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = Math.max(200, maxX - minX + padding * 2);
  const vbH = Math.max(200, maxY - minY + padding * 2);

  const handleGhostClick = (q: number, r: number) => {
    if (!isMyTurn) return;
    const effectiveIndex = Math.min(selectedMarketIndex, Math.max(0, view.market.length - 1));
    const isAvailable = legalMoves.some((m) => m.marketIndex === effectiveIndex && m.q === q && m.r === r);
    if (isAvailable) {
      onMove({ type: 'place', marketIndex: effectiveIndex, q, r });
    }
  };

  const activeQuests: QuestDef[] =
    mySeat !== null && view.playerQuests[mySeat]
      ? view.playerQuests[mySeat]!.filter((q) => q.id !== 'hidden')
      : [];

  const completedList =
    mySeat !== null && view.completedQuests[mySeat]
      ? view.completedQuests[mySeat]!
      : [];

  return (
    <div className="gs-root">
      {/* Header mit Spielstand und Spielern */}
      <header className="gs-header">
        <div className="gs-turn-indicator">
          {view.winner !== null ? (
            <span>
              🏆 Sieger: <strong style={{ color: PLAYER_COLORS[view.winner] }}>{PLAYER_NAMES[view.winner] ?? `Spieler ${view.winner + 1}`}</strong>
            </span>
          ) : (
            <span>
              Am Zug:{' '}
              <span
                className="gs-turn-badge"
                style={{
                  backgroundColor: `${PLAYER_COLORS[view.turn]}20`,
                  color: PLAYER_COLORS[view.turn],
                  border: `1px solid ${PLAYER_COLORS[view.turn]}40`,
                }}
              >
                {PLAYER_NAMES[view.turn] ?? `Spieler ${view.turn + 1}`}
              </span>
            </span>
          )}
        </div>

        <div className="gs-scores">
          {Array.from({ length: view.seats }, (_, s) => {
            const isActive = view.turn === s;
            const score = view.scores[s] ?? 0;
            const completedCount = view.completedQuests[s]?.length ?? 0;
            return (
              <div
                key={s}
                className={`gs-player-chip ${isActive ? 'gs-player-chip--active' : ''}`}
                style={{ borderLeft: `4px solid ${PLAYER_COLORS[s]}` }}
              >
                <span className="gs-player-dot" style={{ backgroundColor: PLAYER_COLORS[s] }} />
                <span>{s === mySeat ? 'Du' : `P${s + 1}`}</span>
                <strong>{score} Pkt.</strong>
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({completedCount} 📜)</span>
              </div>
            );
          })}
        </div>

        <div className="gs-deck-info">
          Stapel: <strong>{view.deck.length}</strong> Plättchen
        </div>
      </header>

      {/* Jahrmarkt (Plättchenauslage) */}
      <section className="gs-market-section" aria-label="Jahrmarkt Plättchenauslage">
        <div className="gs-market-title">
          <span>🎪 Jahrmarkt (Auslage)</span>
          {isMyTurn && <span style={{ color: 'var(--accent, #d97706)' }}>Wähle ein Plättchen und lege es auf ein freies Feld</span>}
        </div>
        <div className="gs-market-tiles">
          {view.market.map((tile, idx) => {
            const isSelected = isMyTurn && selectedMarketIndex === idx;
            return (
              <button
                key={tile.id}
                type="button"
                className={`gs-market-tile ${isSelected ? 'gs-market-tile--selected' : ''}`}
                disabled={!isMyTurn}
                onClick={() => setSelectedMarketIndex(idx)}
                aria-label={`${LANDSCAPE_NAMES[tile.type]}${tile.river ? ', mit Fluss' : ''}${tile.road ? ', mit Weg' : ''}${tile.mill ? ', mit Mühle' : ''}`}
              >
                <TileHexSvg tile={tile} />
                <span className="gs-tile-label">{LANDSCAPE_NAMES[tile.type]}</span>
                <div className="gs-tile-features">
                  {tile.river && <span title="Flusslauf">🌊</span>}
                  {tile.road && <span title="Weg">🛤️</span>}
                  {tile.mill && <span title="Mühle">⚙️</span>}
                </div>
              </button>
            );
          })}
          {view.market.length === 0 && <div style={{ padding: 12, fontStyle: 'italic' }}>Der Jahrmarkt ist leer!</div>}
        </div>
      </section>

      {/* Spielfeld (Hex-Board) */}
      <div className="gs-board-wrapper">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="gs-board-svg"
          aria-label="Grafschaft Spielfeld"
        >
          {/* Liegende Plättchen */}
          {Object.entries(view.board).map(([key, tile]) => {
            const { cx, cy } = hexToPixel(tile.q, tile.r);
            const isLast = view.lastPlaced?.q === tile.q && view.lastPlaced?.r === tile.r;
            const points = hexPolygonPoints(cx, cy);

            return (
              <g key={key} className="gs-hex-group">
                <HexArt type={tile.type} cx={cx} cy={cy} radius={HEX_RADIUS} clipId={`gs-clip-${tile.q}_${tile.r}`.replace(/-/g, 'm')} />
                <polygon
                  points={points}
                  className={`gs-hex gs-hex--${tile.type} ${isLast ? 'gs-hex--last' : ''}`}
                />
                {tile.river && (
                  <path
                    d={`M ${cx - HEX_RADIUS * 0.7} ${cy - HEX_RADIUS * 0.3} Q ${cx} ${cy + HEX_RADIUS * 0.5} ${cx + HEX_RADIUS * 0.7} ${cy - HEX_RADIUS * 0.2}`}
                    className="gs-feature-river"
                  />
                )}
                {tile.road && (
                  <path
                    d={`M ${cx - HEX_RADIUS * 0.7} ${cy + HEX_RADIUS * 0.3} Q ${cx} ${cy - HEX_RADIUS * 0.4} ${cx + HEX_RADIUS * 0.7} ${cy + HEX_RADIUS * 0.4}`}
                    className="gs-feature-road"
                  />
                )}
                {tile.mill && (
                  <circle cx={cx} cy={cy} r={HEX_RADIUS * 0.26} className="gs-feature-mill" />
                )}
                <text x={cx} y={cy} className="gs-hex-symbol">
                  {LANDSCAPE_SYMBOLS[tile.type]}
                </text>
              </g>
            );
          })}

          {/* Anlegbare Felder (Geister-Sechsecke) */}
          {isMyTurn &&
            ghostCoords.map(({ q, r }) => {
              const { cx, cy } = hexToPixel(q, r);
              const points = hexPolygonPoints(cx, cy);
              return (
                <g key={`ghost-${q}-${r}`} onClick={() => handleGhostClick(q, r)} style={{ cursor: 'pointer' }}>
                  <polygon
                    points={points}
                    className="gs-hex gs-hex--ghost"
                    role="button"
                    tabIndex={0}
                    aria-label={`Plättchen hier anlegen bei (${q}, ${r})`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleGhostClick(q, r);
                      }
                    }}
                  />
                  <circle cx={cx} cy={cy} r={3} fill="var(--accent, #d97706)" opacity={0.6} pointerEvents="none" />
                </g>
              );
            })}
        </svg>
      </div>

      {/* Hofaufträge (Quests) */}
      {activeQuests.length > 0 && (
        <section className="gs-quests-section" aria-label="Eigene Hofaufträge">
          <div className="gs-quests-title">
            <span>📜 Deine Hofaufträge</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
              Erfülle die Bedingung, um sofort Punkte und einen neuen Auftrag zu erhalten
            </span>
          </div>
          <div className="gs-quests-grid">
            {activeQuests.map((quest) => (
              <div key={quest.id} className="gs-quest-card">
                <div className="gs-quest-card-header">
                  {questImage(quest.id) && <img className="gs-quest-img" src={questImage(quest.id)} alt="" draggable={false} />}
                  <span className="gs-quest-name">{quest.name}</span>
                  <span className="gs-quest-badge">+{quest.points} Punkte</span>
                </div>
                <div className="gs-quest-text">{quest.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Vollendete Aufträge */}
      {completedList.length > 0 && (
        <div className="gs-completed-quests">
          <span>Erledigte Aufträge:</span>
          {completedList.map((item, idx) => (
            <span key={`${item.quest.id}-${idx}`} className="gs-completed-tag">
              ✓ {item.quest.name} (+{item.quest.points})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        borderRadius: '50%',
        backgroundColor: PLAYER_COLORS[seat] ?? '#888',
        verticalAlign: 'middle',
      }}
    />
  );
}

export const gameUi: GameUi<GrafschaftState, GrafschaftMove> = {
  Board,
  SeatSymbol,
  sounds: {
    placed: 'plaettchen-setzen',
    villageScored: 'stein-setzen',
    questCompleted: 'paar',
  },
  seatLabel: (seat) => PLAYER_NAMES[seat] ?? `Spieler ${seat + 1}`,
};
