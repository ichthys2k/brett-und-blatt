import { Rng, type SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, useElementSize, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BLACK, estimateOwnership, WHITE } from '../board';
import { handicapPoints, scoreOf, toSgf, type GoMove, type GoState } from '../rules';
import { SgfImportModal } from './SgfImport';
import './styles.css';

const LABELS = ['Schwarz', 'Weiß'];
/** Go-Koordinaten: Spalten ohne „I“, Reihen von unten gezählt. */
const COLUMNS = 'ABCDEFGHJKLMNOPQRST';

export function pointName(point: number, size: number): string {
  return `${COLUMNS[point % size]}${size - Math.floor(point / size)}`;
}

/** Unter dieser Punktgröße (in Pixeln) wird erst eine Vorschau gezeigt und dann bestätigt. */
const CONFIRM_BELOW = 30;
/** Unter dieser Punktgröße wird die Lupe angeboten. */
const ZOOM_BELOW = 26;
const ZOOM_KEY = 'bub-go-zoom';

function readZoom(): boolean {
  try {
    return localStorage.getItem(ZOOM_KEY) === '1';
  } catch {
    return false;
  }
}

const formatPoints = (n: number) => String(n).replace('.', ',');

function Stone({ seat, ghost, dead }: { seat: SeatId; ghost?: boolean; dead?: boolean }) {
  return <span className={`go-stone go-${seat === 0 ? 'black' : 'white'} ${ghost ? 'go-ghost' : ''} ${dead ? 'go-dead' : ''}`} />;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-go-sgf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function Board({ view, legalMoves, onMove, hint, activeSeat, seatNames }: BoardProps<GoState, GoMove>) {
  const { size } = view;
  const [preview, setPreview] = useState<number | null>(null);
  const [importingSgf, setImportingSgf] = useState(false);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setPreview(null);
  }

  const [zoomed, setZoomed] = useState(readZoom);
  const [sizeRef, box] = useElementSize<HTMLDivElement>();
  const pointSize = box.width / size;
  const scrollRef = useRef<HTMLDivElement>(null);
  const toggleZoom = (on: boolean) => {
    setZoomed(on);
    try {
      localStorage.setItem(ZOOM_KEY, on ? '1' : '0');
    } catch {
      // Ohne Speicher gilt die Einstellung nur für diese Partie.
    }
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!zoomed || !el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoomed]);

  const playable = new Set(legalMoves.flatMap((m) => (m.type === 'place' ? [m.point] : [])));
  const pass = legalMoves.find((m) => m.type === 'pass');
  const scoring = view.phase === 'scoring';
  const canScore = legalMoves.some((m) => m.type === 'acceptScore');
  const dead = new Set(view.dead);
  const stars = new Set(handicapPoints(size, size >= 13 ? 9 : 5));
  const hintPoint = hint?.type === 'place' ? hint.point : null;
  const confirm = pointSize > 0 && pointSize < CONFIRM_BELOW;

  // Gebiet: in der Auszählung genau gerechnet, während der Partie (Lernhilfe) geschätzt.
  const score = useMemo(() => (scoring || view.phase === 'over' ? scoreOf(view) : null), [view, scoring]);
  const estimate = useMemo(() => {
    if (!view.showTerritory || view.phase !== 'play' || view.variant !== 'go') return null;
    const rng = Rng.fromSeed(view.history[view.history.length - 1] ?? '', 'gebiet');
    return estimateOwnership(view.board, size, view.turn === 0 ? BLACK : WHITE, view.komi, size <= 9 ? 120 : 60, rng);
  }, [view, size]);
  const territory = (point: number): 0 | 1 | 2 => {
    if (score && (view.board[point] === 0 || dead.has(point))) return (score.owner[point] ?? 0) as 0 | 1 | 2;
    if (estimate && view.board[point] === 0) {
      const v = estimate[point] ?? 0;
      return v > 0.5 ? BLACK : v < -0.5 ? WHITE : 0;
    }
    return 0;
  };

  const tap = (point: number) => {
    if (scoring) {
      if (canScore && view.board[point] !== 0) onMove({ type: 'toggleDead', point });
      return;
    }
    if (!playable.has(point)) return;
    if (confirm && preview !== point) {
      setPreview(point);
      return;
    }
    onMove({ type: 'place', point });
  };

  const names = [seatNames[0] ?? LABELS[0], seatNames[1] ?? LABELS[1]];
  const lastPass = view.lastMove === -1 && view.phase === 'play';

  return (
    <FitBox ratio={0.86}>
      <div className="go-layout">
        <div className="go-wrap" ref={sizeRef}>
          <div className={`go-scroll ${zoomed ? 'go-zoomed' : ''}`} ref={scrollRef}>
            <div className="go-zoom">
              <GridBoard
                cols={size}
                rows={size}
                label={`Go-Brett ${size} × ${size}`}
                className="go-board"
                renderCell={(col, row) => {
                  const point = row * size + col;
                  const stone = view.board[point];
                  const own = territory(point);
                  return (
                    <>
                      {stars.has(point) && <span className="go-star" />}
                      {own !== 0 && <span className={`go-area go-area-${own === BLACK ? 'black' : 'white'}`} />}
                      {stone ? <Stone seat={stone - 1} dead={dead.has(point)} /> : null}
                      {!stone && preview === point && activeSeat !== null && <Stone seat={activeSeat} ghost />}
                      {!stone && view.ko === point && view.phase === 'play' && <span className="go-ko" />}
                    </>
                  );
                }}
                isActive={(col, row) => {
                  const point = row * size + col;
                  return scoring ? canScore && view.board[point] !== 0 : playable.has(point);
                }}
                onActivate={(col, row) => tap(row * size + col)}
                cellClassName={(col, row) => {
                  const point = row * size + col;
                  const classes = [];
                  if (col === 0) classes.push('go-l');
                  if (col === size - 1) classes.push('go-r');
                  if (row === 0) classes.push('go-t');
                  if (row === size - 1) classes.push('go-b');
                  if (point === view.lastMove) classes.push('go-last');
                  if (point === hintPoint) classes.push('go-hint');
                  if (point === preview) classes.push('go-preview');
                  if (playable.has(point) && !scoring) classes.push('go-playable');
                  return classes.join(' ');
                }}
                cellLabel={(col, row) => {
                  const point = row * size + col;
                  const stone = view.board[point];
                  const what = stone ? `${LABELS[stone - 1]}${dead.has(point) ? ' (tot)' : ''}` : view.ko === point ? 'frei, Ko' : 'frei';
                  return `${pointName(point, size)}: ${what}`;
                }}
              />
            </div>
          </div>
          {(zoomed || (pointSize > 0 && pointSize < ZOOM_BELOW)) && (
            <button type="button" className="go-lens" aria-pressed={zoomed} aria-label={zoomed ? 'Brett verkleinern' : 'Brett vergrößern'} title={zoomed ? 'Brett verkleinern' : 'Brett vergrößern'} onClick={() => toggleZoom(!zoomed)}>
              {zoomed ? '⊖' : '🔍'}
            </button>
          )}
        </div>

        <div className="go-bar" aria-live="polite">
          {scoring && score ? (
            <>
              <span className="go-score">
                ● {formatPoints(score.black)} · ○ {formatPoints(score.white)} Punkte
                <small>
                  {canScore ? 'Tote Steine antippen, dann bestätigen' : view.accepted.some(Boolean) ? 'Warte auf Zustimmung …' : 'Auszählung'}
                  {view.accepted[0] ? ` · ${names[0]} ✓` : ''}
                  {view.accepted[1] ? ` · ${names[1]} ✓` : ''}
                </small>
              </span>
              {canScore && (
                <>
                  <button type="button" className="go-button" onClick={() => onMove({ type: 'resume' })}>
                    Weiterspielen
                  </button>
                  <button type="button" className="go-button go-primary" onClick={() => onMove({ type: 'acceptScore' })}>
                    Einverstanden
                  </button>
                </>
              )}
            </>
          ) : view.phase === 'over' ? (
            <>
              <span className="go-score">
                {score && view.end?.reason === 'score' ? `● ${formatPoints(score.black)} · ○ ${formatPoints(score.white)} Punkte` : `${view.record.length} Züge`}
              </span>
              <button type="button" className="go-button" onClick={() => download(`go-${size}x${size}.sgf`, toSgf(view, names as [string, string]))}>
                SGF speichern
              </button>
              <button type="button" className="go-button" onClick={() => setImportingSgf(true)}>
                SGF laden
              </button>
            </>
          ) : (
            <>
              <span className="go-score">
                Gefangene: ● {view.captures[0]} · ○ {view.captures[1]}
                <small>{lastPass ? `${LABELS[1 - view.turn]} hat gepasst` : view.variant === 'atari' ? 'Wer zuerst schlägt, gewinnt' : `Komi ${formatPoints(view.komi)}`}</small>
              </span>
              {preview !== null && (
                <button type="button" className="go-button go-primary" onClick={() => onMove({ type: 'place', point: preview })}>
                  Setzen auf {pointName(preview, size)}
                </button>
              )}
              {pass && (
                <button type="button" className={`go-button ${hint?.type === 'pass' ? 'go-hinted' : ''}`} onClick={() => onMove(pass)}>
                  Passen
                </button>
              )}
              <button type="button" className="go-button" onClick={() => setImportingSgf(true)}>
                SGF laden
              </button>
            </>
          )}
        </div>
      </div>
      {importingSgf && (
        <SgfImportModal
          onImport={(_state, sgf) => onMove({ type: 'loadSgf', sgf })}
          onClose={() => setImportingSgf(false)}
        />
      )}
    </FitBox>
  );
}

function SetupExtra({ options }: { options: Record<string, string>; seats: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loadedInfo, setLoadedInfo] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-fg">📥 SGF-Partie fortsetzen</p>
          <p className="text-sm text-muted">
            {loadedInfo ? `Geladen: ${loadedInfo}` : 'Eine bestehende Go-Partie aus einer Datei oder Zwischenablage laden.'}
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-line bg-bg px-3 py-1.5 font-medium text-sm hover:bg-line cursor-pointer flex-none"
          onClick={() => setModalOpen(true)}
        >
          {loadedInfo ? 'Ändern' : 'SGF importieren'}
        </button>
      </div>

      {modalOpen && (
        <SgfImportModal
          onImport={(state, sgf) => {
            options.sgf = sgf;
            options.size = String(state.size);
            options.komi = String(state.komi);
            setLoadedInfo(`${state.size}×${state.size}, ${state.record.length} Züge`);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`go-symbol ${className}`}>
      <Stone seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<GoState, GoMove> = {
  Board,
  SeatSymbol,
  SetupExtra,
  sounds: { placed: (event) => ((event.captured as number[] | undefined)?.length ? 'stein-schlagen' : 'stein-setzen') },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${view.captures[seat]} gefangen`,
};
