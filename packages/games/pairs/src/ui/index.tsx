import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { ContentCard, FitBox, GridBoard, PackPicker, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState } from 'react';
import { faceImageOf, faceOf, PAIR_SETS } from '../content';
import { learningReport, type PairsMove, type PairsState } from '../rules';
import './styles.css';
import { albumSpec } from './album';
import { resolvePairImage, setPairImageResolver } from './imageResolver';

export { setPairImageResolver };

const SEAT_COLORS = ['#d6336c', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599'];

function Board({ view, legalMoves, onMove, hint, events }: BoardProps<PairsState, PairsMove>) {
  const playable = new Set(legalMoves.map((m) => m.card));
  const [mismatched, setMismatched] = useState<number[]>([]);
  const seenEventsRef = useRef<GameEvent[] | null>(null);

  useEffect(() => {
    if (seenEventsRef.current === events) return;
    seenEventsRef.current = events;
    const mismatch = events?.find((e) => e.type === 'mismatch') as { cards: number[] } | undefined;
    if (mismatch) {
      setMismatched(mismatch.cards);
      const timer = window.setTimeout(() => setMismatched([]), 450);
      return () => window.clearTimeout(timer);
    }
  }, [events]);

  return (
    <FitBox ratio={view.cols / view.rows}>
      <GridBoard
        cols={view.cols}
        rows={view.rows}
        label="Karten"
        className="pf-board"
        renderCell={(col, row) => {
          const card = row * view.cols + col;
          const face = view.faces[card];
          const status = view.status[card];
          const taken = typeof status === 'object' ? status.takenBy : null;
          const isMismatched = mismatched.includes(card);
          const text = face ? faceOf(view.set, face.pair, face.side, view.custom) : null;
          const image = face ? resolvePairImage(faceImageOf(view.set, face.pair, view.custom)) : undefined;
          return (
            <span className="pf-slot" style={taken !== null ? { outlineColor: SEAT_COLORS[taken % SEAT_COLORS.length] } : undefined}>
              <ContentCard
                key={face ? 'offen' : 'verdeckt'}
                content={text}
                image={image}
                caption={image && view.set !== 'tiere' && text ? text : undefined}
                dimmed={taken !== null}
                highlight={hint?.card === card ? 'hint' : null}
                anim={isMismatched ? 'shake' : null}
              />
            </span>
          );
        }}
        isActive={(col, row) => playable.has(row * view.cols + col)}
        onActivate={(col, row) => onMove({ type: 'flip', card: row * view.cols + col })}
        cellClassName={(col, row) => (typeof view.status[row * view.cols + col] === 'object' ? 'pf-taken' : '')}
        cellLabel={(col, row) => {
          const card = row * view.cols + col;
          const face = view.faces[card];
          return `Karte ${card + 1}: ${face ? faceOf(view.set, face.pair, face.side, view.custom) : 'verdeckt'}`;
        }}
      />
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`pf-symbol ${className}`} style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
      {seat + 1}
    </span>
  );
}

const SET_GROUPS = ['Tiere', 'Quartett', 'Drachenspiel', 'Spielewelt', 'Lernen'] as const;

function PairsSetup({ options, setOption }: { options: Record<string, string>; setOption: (id: string, value: string) => void }) {
  const activeSet = options.set ?? 'tiere';
  const hasPack = Boolean(options.pack);
  const allSets = Object.values(PAIR_SETS);
  return (
    <div className="pf-setup">
      <section className="pf-sets-section" aria-label="Kartenset">
        <h3 className="pf-sets-heading">Kartenset</h3>
        {SET_GROUPS.map((group) => {
          const sets = allSets.filter((s) => (s.group ?? 'Lernen') === group);
          if (sets.length === 0) return null;
          return (
            <div key={group} className="pf-set-group">
              <p className="pf-set-group-title">{group}</p>
              <div className="pf-set-grid">
                {sets.map((set) => {
                  const sample = set.pairs[0];
                  const image = sample ? resolvePairImage(sample.image) : undefined;
                  const selected = !hasPack && activeSet === set.id;
                  return (
                    <button
                      key={set.id}
                      type="button"
                      className={`pf-set-btn ${selected ? 'pf-set-btn-active' : ''} ${image ? '' : 'pf-set-btn-text'}`}
                      aria-pressed={selected}
                      onClick={() => {
                        if (hasPack) setOption('pack', '');
                        setOption('set', set.id);
                      }}
                    >
                      <ContentCard
                        content={sample?.a ?? '?'}
                        image={image}
                        caption={set.name}
                        highlight={selected ? 'target' : null}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
      <PackPicker options={options} setOption={setOption} />
    </div>
  );
}

export const gameUi: GameUi<PairsState, PairsMove> = {
  Board,
  SetupExtra: PairsSetup,
  album: albumSpec,
  learning: { report: learningReport },
  SeatSymbol,
  sounds: { flipped: 'karte-umdrehen', pair: 'paar', mismatch: 'kein-paar' },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    if (view.scores.length === 1) return `${view.turns} Züge · ${view.scores[0]} Paare`;
    const score = view.scores[seat] ?? 0;
    return `${score} ${score === 1 ? 'Paar' : 'Paare'}`;
  },
};
