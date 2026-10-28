import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, useElementSize, useGridMoveAnimation, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { legalMoves as engineLegalMoves, type LogEntry } from '../legacy/engine';
import { COLORS, type Color, type FourChessMove, type FourChessState, type Piece } from '../rules';
import { getCheckWarning, type CheckWarning } from './checkWarning';
import { checks, replayStates, trophies, type CheckInfo } from './history';
import './styles.css';

const NAMES: Record<Color, string> = { r: 'Rot', b: 'Blau', y: 'Gelb', g: 'Grün' };
/** Schachfiguren als Textzeichen; ︎ verhindert, dass Handys sie als bunte Emojis zeigen. */
const GLYPHS: Record<Piece['t'], string> = { K: '♚︎', Q: '♛︎', R: '♜︎', B: '♝︎', N: '♞︎', P: '♟︎' };
const PIECE_NAMES: Record<Piece['t'], string> = { K: 'König', Q: 'Dame', R: 'Turm', B: 'Läufer', N: 'Springer', P: 'Bauer' };
/** Dativ für „von der Dame …“, „vom Turm …“. */
const PIECE_DATIVE: Record<Piece['t'], string> = { K: 'vom König', Q: 'von der Dame', R: 'vom Turm', B: 'vom Läufer', N: 'vom Springer', P: 'vom Bauern' };
const OUT_REASONS: Record<string, string> = { mate: 'matt', stalemate: 'patt', resign: 'aufgegeben', time: 'Zeit abgelaufen', king: 'König geschlagen' };
const TROPHY_ORDER: Piece['t'][] = ['K', 'Q', 'R', 'B', 'N', 'P'];

function onBoard(row: number, col: number): boolean {
  return !((row < 3 || row > 10) && (col < 3 || col > 10));
}

/** Bildschirmfeld → Brettfeld, so gedreht, dass die eigene Farbe unten sitzt. */
function toBoard(dc: number, dr: number, perspective: Color): number {
  switch (perspective) {
    case 'r':
      return dr * 14 + dc;
    case 'y':
      return (13 - dr) * 14 + (13 - dc);
    case 'b':
      return dc * 14 + (13 - dr);
    case 'g':
      return (13 - dc) * 14 + dr;
  }
}

/** Brettfeld → Bildschirmfeld (Umkehrung von toBoard). */
function toDisplay(index: number, perspective: Color): { col: number; row: number } {
  const row = Math.floor(index / 14);
  const col = index % 14;
  switch (perspective) {
    case 'r':
      return { col, row };
    case 'y':
      return { col: 13 - col, row: 13 - row };
    case 'b':
      return { col: row, row: 13 - col };
    case 'g':
      return { col: 13 - row, row: col };
  }
}

function squareName(index: number): string {
  return `${String.fromCharCode(97 + (index % 14))}${14 - Math.floor(index / 14)}`;
}

/** Die Farben unten, links, oben, rechts – im Uhrzeigersinn wie die Zugfolge. */
function sides(perspective: Color): Color[] {
  const start = COLORS.indexOf(perspective);
  return [0, 1, 2, 3].map((k) => COLORS[(start + k) % 4] as Color);
}

/** Jede Farbe hat eine Trophäenecke: unten links, oben links, oben rechts, unten rechts. */
const CORNERS = ['bl', 'tl', 'tr', 'br'] as const;
const CORNER_CENTER: Record<(typeof CORNERS)[number], { x: number; y: number }> = {
  bl: { x: 1.5, y: 12.5 },
  tl: { x: 1.5, y: 1.5 },
  tr: { x: 12.5, y: 1.5 },
  br: { x: 12.5, y: 12.5 },
};

type MoveMove = Extract<FourChessMove, { t: 'm' }>;

/** Unter dieser Feldgröße (in Pixeln) wird die Lupe angeboten. */
const ZOOM_BELOW = 36;
const ZOOM_KEY = 'bub-four-player-chess-zoom';

function readZoom(): boolean {
  try {
    return localStorage.getItem(ZOOM_KEY) === '1';
  } catch {
    return false;
  }
}

function Glyph({ c, t, dead }: { c: Color; t: Piece['t']; dead?: boolean }) {
  return <span className={`fc-glyph fc-${dead ? 'dead' : c}`}>{GLYPHS[t]}</span>;
}

/** Ein Logeintrag in Worten und Zeichen – für Chronik und die Leiste unter dem Brett. */
function describe(entry: LogEntry, mode: FourChessState['mode']): ReactNode {
  if (entry.type !== 'move' || !entry.color) return <span className="fc-log-event">{entry.text}</span>;
  const action = entry.action?.t === 'm' ? entry.action : null;
  if (!action || !entry.piece) return <span>{entry.text}</span>;
  const check = entry.text.endsWith('+');
  const castle = entry.text.startsWith('O-O');
  return (
    <span className="fc-log-move">
      <Glyph c={entry.color} t={entry.piece} />
      <span className="fc-log-squares">{castle ? (entry.text.startsWith('O-O-O') ? 'lange Rochade' : 'kurze Rochade') : `${squareName(action.f)}–${squareName(action.to)}`}</span>
      {entry.captured && (
        <span className="fc-log-capture">
          schlägt <Glyph c={entry.captured.c} t={entry.captured.t} dead={entry.captured.dead} />
          <span className="fc-log-victim">
            {PIECE_NAMES[entry.captured.t]} {entry.captured.dead ? '(tot)' : NAMES[entry.captured.c]}
          </span>
        </span>
      )}
      {check && <span className="fc-log-check">Schach</span>}
      {mode === 'ffa' && (entry.points ?? 0) > 0 && <span className="fc-log-points">+{entry.points}</span>}
    </span>
  );
}

/** Schachansage in Worten: wer wird von welcher Figur angegriffen? */
function checkText(info: CheckInfo, own: boolean): string {
  const by = info.attackers.map((a) => `${PIECE_DATIVE[a.t]} von ${NAMES[a.c]}`).join(' und ');
  return own ? `Schach! Dein König wird ${by} angegriffen.` : `Schach gegen ${NAMES[info.color]} – ${by}.`;
}

interface Fly {
  key: number;
  c: Color;
  t: Piece['t'];
  dead?: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function Board({ view, legalMoves, onMove, viewer, activeSeat, hint }: BoardProps<FourChessState, FourChessMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<MoveMove[] | null>(null);
  const [warning, setWarning] = useState<CheckWarning | null>(null);
  /** Vorgezogener Zug: wird ausgeführt, sobald man am Zug ist. */
  const [premove, setPremove] = useState<{ f: number; to: number } | null>(null);
  const [showLog, setShowLog] = useState(false);
  /** Rückblick: Index im Log, dessen Stellung gezeigt wird – oder null für die laufende Partie. */
  const [review, setReview] = useState<number | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
    setPromotion(null);
    setWarning(null);
  }

  useEffect(() => {
    if (!warning) return;
    const id = window.setTimeout(() => setWarning(null), 6000);
    return () => window.clearTimeout(id);
  }, [warning]);

  // Lupe: Auf kleinen Bildschirmen sind die Felder nur gut 25 px groß. Vergrößert lässt sich das Brett mit dem Finger verschieben.
  const [zoomed, setZoomed] = useState(readZoom);
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const cellSize = size.width / 14;
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
    // Die eigene Seite liegt unten: dort in der Mitte anfangen.
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, [zoomed]);

  const seat = typeof viewer === 'number' ? viewer : activeSeat;
  const perspective: Color = seat !== null && seat !== undefined ? (COLORS[seat] ?? 'r') : 'r';
  const myColor: Color | null = typeof viewer === 'number' ? (COLORS[viewer] ?? null) : null;

  // Rückblick: alle Stellungen der Partie nachspielen (nur bei Bedarf).
  const history = useMemo(() => (review !== null || showLog ? replayStates(view) : null), [view, review !== null, showLog]);
  const reviewState = review !== null ? (history?.[review] ?? null) : null;
  const reviewing = reviewState !== null;
  const shown = reviewState ?? view;
  const moveIndices = useMemo(() => view.log.map((e, i) => (e.action ? i : -1)).filter((i) => i >= 0), [view.log]);
  const reviewPos = review !== null ? moveIndices.indexOf(review) : -1;

  const moves = reviewing ? [] : legalMoves.filter((m): m is MoveMove => m.t === 'm');
  const claim = reviewing ? undefined : legalMoves.find((m) => m.t === 'claim');
  const movable = new Set(moves.map((m) => m.f));

  // Vorziehen: Wer nicht am Zug ist, darf eine eigene Figur und ein Ziel vormerken.
  const canPremove = !reviewing && myColor !== null && !view.result && view.active[myColor] === true && view.turn !== myColor && moves.length === 0;
  const preMoves = useMemo(() => (canPremove && myColor ? engineLegalMoves(view, myColor) : []), [canPremove, myColor, view]);
  const preMovable = new Set(preMoves.map((m) => m.from));

  const targets = new Set(
    selected === null ? [] : canPremove ? preMoves.filter((m) => m.from === selected).map((m) => m.to) : moves.filter((m) => m.f === selected).map((m) => m.to),
  );
  const hintMove = !reviewing && hint && hint.t === 'm' ? hint : null;

  // Sobald man am Zug ist: vorgemerkten Zug ausführen – oder verwerfen, wenn er nicht mehr geht.
  useEffect(() => {
    if (!premove || moves.length === 0) return;
    const options = moves.filter((m) => m.f === premove.f && m.to === premove.to);
    setPremove(null);
    const move = options.find((m) => m.pr === 'Q') ?? options[0];
    if (move) onMove(move);
    else setWarning({ text: 'Dein vorgezogener Zug ist nicht mehr möglich – zieh bitte neu.' });
  });
  // Scheidet man aus oder endet die Partie, verfällt der vorgemerkte Zug.
  if (premove && (view.result || (myColor && !view.active[myColor]))) setPremove(null);

  const toDisplayCoord = (pos: number | string) => {
    const index = Number(pos);
    if (index < 0 || index >= 196) return null;
    return toDisplay(index, perspective);
  };

  const lastMoveObj = shown.lastMove ? { from: shown.lastMove.from, to: shown.lastMove.to } : null;
  const lastLogMove = [...shown.log].reverse().find((e) => e.type === 'move');
  const castleMove = (lastLogMove?.action?.t === 'm' ? engineCastle(lastLogMove) : undefined) ?? undefined;

  const { getSlideProps } = useGridMoveAnimation({
    lastMove: lastMoveObj,
    extraMoves: castleMove ? [castleMove] : undefined,
    toDisplayCoord,
    moveKey: `${reviewing ? 'r' : 'p'}${shown.ply ?? shown.log.length}`,
  });

  // Schlagen: Die geschlagene Figur fliegt in die Trophäenecke des Schlagenden.
  const sideColors = sides(perspective);
  const cornerOf = (color: Color) => CORNERS[sideColors.indexOf(color)] ?? 'bl';
  const lastPly = useRef(view.ply);
  useEffect(() => {
    const before = lastPly.current;
    lastPly.current = view.ply;
    if (view.ply !== before + 1) return;
    const entry = [...view.log].reverse().find((e) => e.type === 'move');
    if (!entry?.color || !entry.captured || entry.action?.t !== 'm') return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const from = toDisplay(entry.action.to, perspective);
    const to = CORNER_CENTER[cornerOf(entry.color)];
    setFly({ key: view.ply, c: entry.captured.c, t: entry.captured.t, dead: entry.captured.dead, from: { x: from.col + 0.5, y: from.row + 0.5 }, to });
  }, [view.ply]); // eslint-disable-line react-hooks/exhaustive-deps

  // Schachanzeige: angegriffene Könige, Angreifer und Pfeile.
  const checkList = checks(shown);
  const kingSquares = new Set(checkList.map((c) => c.king));
  const checkerSquares = new Set(checkList.flatMap((c) => c.attackers.map((a) => a.sq)));
  const focusColor = myColor ?? shown.turn;
  const ownCheck = checkList.find((c) => c.color === focusColor) ?? checkList.find((c) => c.color === shown.turn);

  const won = trophies(shown.log);

  // Pfeiltasten im Rückblick.
  useEffect(() => {
    if (!reviewing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'Escape') setReview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const step = (delta: number) => {
    const next = moveIndices[reviewPos + delta];
    if (next === undefined) {
      if (delta > 0) setReview(null);
      return;
    }
    setReview(next);
  };

  const tapPremove = (index: number) => {
    if (selected !== null && targets.has(index)) {
      setPremove({ f: selected, to: index });
      setSelected(null);
      return;
    }
    if (preMovable.has(index) && index !== selected) {
      setSelected(index);
      return;
    }
    setSelected(null);
    setPremove(null);
  };

  const tap = (index: number) => {
    if (reviewing) return;
    if (canPremove) {
      tapPremove(index);
      return;
    }
    // 1. Zielfeld für bereits ausgewählte Figur angetippt
    if (selected !== null && targets.has(index)) {
      setWarning(null);
      const options = moves.filter((m) => m.f === selected && m.to === index);
      if (options.length > 1) {
        setPromotion(options);
      } else if (options[0]) {
        setPromotion(null);
        onMove(options[0]);
      }
      return;
    }

    setPromotion(null);

    // 2. Ungültiges Zielfeld für bereits ausgewählte Figur angetippt?
    if (selected !== null && index !== selected) {
      const piece = view.board[index];
      const ownPiece = piece && !piece.d && piece.c === view.turn;
      if (ownPiece && movable.has(index)) {
        setWarning(null);
        setSelected(index);
        return;
      }
      const warn = getCheckWarning(view, selected, index, legalMoves);
      if (warn) {
        setWarning(warn);
        return;
      }
      if (ownPiece) {
        const pieceWarn = getCheckWarning(view, index, null, legalMoves);
        if (pieceWarn) {
          setWarning(pieceWarn);
          setSelected(null);
          return;
        }
      }
      setWarning(null);
      setSelected(null);
      return;
    }

    // 3. Wenn dieselbe Figur erneut angetippt wird: abwählen
    if (index === selected) {
      setSelected(null);
      setWarning(null);
      return;
    }

    // 4. Neue eigene Figur angetippt
    if (movable.has(index)) {
      setWarning(null);
      setSelected(index);
      return;
    }

    // 5. Eigene Figur angetippt, die sich nicht bewegen darf: Erklärung ermitteln
    const piece = view.board[index];
    if (piece && !piece.d && piece.c === view.turn) {
      const warn = getCheckWarning(view, index, null, legalMoves);
      if (warn) {
        setWarning(warn);
        setSelected(null);
        return;
      }
    }

    setSelected(null);
    setWarning(null);
  };

  const showLens = zoomed || (cellSize > 0 && cellSize < ZOOM_BELOW);
  const hasLog = view.log.length > 0;

  let barText: ReactNode = null;
  // Ein Hinweis liegt über dieser Leiste – dann bleibt sie leer, damit sich nichts überdeckt.
  if (reviewing || warning) barText = null;
  else if (ownCheck) barText = <span className="fc-bar-check">⚠️ {checkText(ownCheck, ownCheck.color === myColor)}</span>;
  else if (premove) barText = <span className="fc-bar-premove">⏳ Vorgemerkt: {squareName(premove.f)}–{squareName(premove.to)} · antippen zum Ändern</span>;
  else if (lastLogMove) barText = describe(lastLogMove, view.mode);

  return (
    <FitBox ratio={14 / 15}>
      <div className="fc-wrap">
        <div className="fc-area" ref={sizeRef}>
          <div className={`fc-scroll ${zoomed ? 'fc-zoomed' : ''}`} ref={scrollRef}>
            <div className="fc-zoom">
              <GridBoard
                cols={14}
                rows={14}
                label="Vierer-Schachbrett"
                className={`fc-board ${reviewing ? 'fc-reviewing' : ''}`}
                renderCell={(dc, dr) => {
                  const index = toBoard(dc, dr, perspective);
                  const piece = shown.board[index];
                  if (!onBoard(Math.floor(index / 14), index % 14)) return null;
                  const slide = getSlideProps(index);
                  return piece ? (
                    <span
                      key={slide.isSliding ? `slide-${index}` : undefined}
                      className={`fc-piece fc-${piece.d ? 'dead' : piece.c} ${slide.pieceClassName ?? ''}`}
                      style={slide.style}
                      onAnimationEnd={slide.onAnimationEnd}
                    >
                      {GLYPHS[piece.t]}
                    </span>
                  ) : targets.has(index) ? (
                    <span className={canPremove ? 'fc-dot fc-dot-pre' : 'fc-dot'} />
                  ) : null;
                }}
                isActive={(dc, dr) => {
                  if (reviewing) return false;
                  const index = toBoard(dc, dr, perspective);
                  if (!onBoard(Math.floor(index / 14), index % 14)) return false;
                  if (canPremove) return preMovable.has(index) || targets.has(index) || selected !== null || premove !== null;
                  const piece = view.board[index];
                  const isOwnPiece = piece && !piece.d && piece.c === view.turn;
                  return movable.has(index) || targets.has(index) || Boolean(isOwnPiece) || selected !== null;
                }}
                onActivate={(dc, dr) => tap(toBoard(dc, dr, perspective))}
                cellClassName={(dc, dr) => {
                  const index = toBoard(dc, dr, perspective);
                  const row = Math.floor(index / 14);
                  const col = index % 14;
                  if (!onBoard(row, col)) return 'fc-off';
                  const slide = getSlideProps(index);
                  const classes = [(row + col) % 2 === 0 ? 'fc-light' : 'fc-dark'];
                  if (slide.cellClassName) classes.push(slide.cellClassName);
                  if (shown.lastMove && (shown.lastMove.from === index || shown.lastMove.to === index)) classes.push('fc-last');
                  if (kingSquares.has(index)) classes.push('fc-check');
                  if (checkerSquares.has(index)) classes.push('fc-checker');
                  if (index === selected) classes.push(canPremove ? 'fc-selected-pre' : 'fc-selected');
                  if (targets.has(index) && view.board[index]) classes.push(canPremove ? 'fc-capture-pre' : 'fc-capture');
                  if (premove && (premove.f === index || premove.to === index)) classes.push('fc-premove');
                  if (hintMove && (hintMove.f === index || hintMove.to === index)) classes.push('fc-hint');
                  if (warning?.pinnedSquare === index) classes.push('fc-pinned');
                  if (warning?.kingSquare === index) classes.push('fc-warn-king');
                  if (warning?.attackerSquares?.includes(index)) classes.push('fc-warn-attacker');
                  return classes.join(' ');
                }}
                cellLabel={(dc, dr) => {
                  const index = toBoard(dc, dr, perspective);
                  const piece = shown.board[index];
                  return `${squareName(index)}: ${piece ? `${piece.d ? 'tote Figur' : NAMES[piece.c]} ${PIECE_NAMES[piece.t]}` : 'frei'}${kingSquares.has(index) ? ' – steht im Schach' : ''}`;
                }}
              />
              {checkList.length > 0 && (
                <svg className="fc-arrows" viewBox="0 0 14 14" aria-hidden="true">
                  <defs>
                    <marker id="fc-arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" className="fc-arrowhead" />
                    </marker>
                  </defs>
                  {checkList.flatMap((info) =>
                    info.attackers.map((a) => {
                      const from = toDisplay(a.sq, perspective);
                      const to = toDisplay(info.king, perspective);
                      const x1 = from.col + 0.5;
                      const y1 = from.row + 0.5;
                      const x2 = to.col + 0.5;
                      const y2 = to.row + 0.5;
                      // Pfeil endet kurz vor der Mitte des Königsfelds.
                      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
                      const shorten = 0.32;
                      return (
                        <line
                          key={`${a.sq}-${info.king}`}
                          className={`fc-arrow ${info.color === focusColor ? 'fc-arrow-own' : ''}`}
                          x1={x1}
                          y1={y1}
                          x2={x2 - ((x2 - x1) / len) * shorten}
                          y2={y2 - ((y2 - y1) / len) * shorten}
                          markerEnd="url(#fc-arrowhead)"
                        />
                      );
                    }),
                  )}
                </svg>
              )}
              {sideColors.map((color, k) => {
                const corner = CORNERS[k] ?? 'bl';
                const list = [...won[color]].sort((a, b) => Number(Boolean(a.dead)) - Number(Boolean(b.dead)) || TROPHY_ORDER.indexOf(a.t) - TROPHY_ORDER.indexOf(b.t));
                const out = shown.out[color];
                return (
                  <div
                    key={color}
                    className={`fc-corner fc-corner-${corner} ${shown.turn === color && !shown.result ? 'fc-corner-turn' : ''} ${out ? 'fc-corner-out' : ''}`}
                    aria-label={`${NAMES[color]}${view.mode === 'ffa' ? `, ${shown.scores[color]} Punkte` : ''}, hat geschlagen: ${list.length ? list.map((t) => PIECE_NAMES[t.t]).join(', ') : 'nichts'}`}
                  >
                    <div className="fc-corner-head">
                      <span className={`fc-glyph fc-${color}`}>{GLYPHS.K}</span>
                      {view.mode === 'ffa' && <span className="fc-corner-score">{shown.scores[color]}</span>}
                    </div>
                    <div className="fc-corner-trophies" aria-hidden="true">
                      {list.map((t, i) => (
                        <span key={i} className={`fc-glyph fc-${t.dead ? 'dead' : t.c}`}>
                          {GLYPHS[t.t]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {fly && !zoomed && (
                <span
                  key={fly.key}
                  className={`fc-fly fc-${fly.dead ? 'dead' : fly.c}`}
                  style={
                    {
                      '--x0': `${(fly.from.x / 14) * 100}%`,
                      '--y0': `${(fly.from.y / 14) * 100}%`,
                      '--x1': `${(fly.to.x / 14) * 100}%`,
                      '--y1': `${(fly.to.y / 14) * 100}%`,
                    } as CSSProperties
                  }
                  onAnimationEnd={() => setFly(null)}
                  aria-hidden="true"
                >
                  {GLYPHS[fly.t]}
                </span>
              )}
            </div>
          </div>
          {claim && (
            <button type="button" className="fc-claim" onClick={() => onMove(claim)}>
              🏆 Sieg beanspruchen
            </button>
          )}
          {promotion && (
            <div className="fc-promotion-backdrop" onClick={() => setPromotion(null)}>
              <div className="fc-promotion" role="dialog" aria-label="Umwandlung wählen" onClick={(e) => e.stopPropagation()}>
                <div className="fc-promotion-choices">
                  {promotion.map((m) => (
                    <button
                      key={m.pr}
                      type="button"
                      className={`fc-piece fc-${m.p}`}
                      onClick={() => {
                        setPromotion(null);
                        onMove(m);
                      }}
                      aria-label={PIECE_NAMES[m.pr ?? 'Q']}
                    >
                      {GLYPHS[m.pr ?? 'Q']}
                    </button>
                  ))}
                </div>
                <button type="button" className="fc-promotion-cancel" onClick={() => setPromotion(null)} aria-label="Abbrechen" title="Abbrechen">
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {warning && (
          <div className="fc-warning-banner" role="alert" aria-live="polite">
            <span className="fc-warning-icon">⚠️</span>
            <span className="fc-warning-text">{warning.text}</span>
            <button type="button" className="fc-warning-close" onClick={() => setWarning(null)} aria-label="Hinweis schließen" title="Schließen">
              ✕
            </button>
          </div>
        )}
        <div className={`fc-bar ${reviewing ? 'fc-bar-review' : ''}`}>
          {reviewing ? (
            <>
              <button type="button" className="fc-tool" onClick={() => step(-1)} disabled={reviewPos <= 0} aria-label="Zug zurück" title="Zug zurück (←)">
                ◀
              </button>
              <span className="fc-bar-text">
                Rückblick · Zug {reviewPos + 1} von {moveIndices.length}
              </span>
              <button type="button" className="fc-tool" onClick={() => step(1)} aria-label="Zug vor" title="Zug vor (→)">
                ▶
              </button>
              <button type="button" className="fc-tool fc-tool-wide" onClick={() => setReview(null)} title="Zurück zur Partie (Esc)">
                Zur Partie
              </button>
            </>
          ) : (
            <>
              <span className="fc-bar-text" aria-live="polite">
                {barText}
              </span>
              {showLens && (
                <button type="button" className="fc-tool" aria-pressed={zoomed} aria-label={zoomed ? 'Brett verkleinern' : 'Brett vergrößern'} title={zoomed ? 'Brett verkleinern' : 'Brett vergrößern'} onClick={() => toggleZoom(!zoomed)}>
                  {zoomed ? '⊖' : '🔍'}
                </button>
              )}
              {hasLog && (
                <button type="button" className="fc-tool" onClick={() => setShowLog(true)} aria-label="Chronik anzeigen" title="Chronik">
                  📜
                </button>
              )}
            </>
          )}
        </div>

        {showLog && (
          <Chronicle
            view={view}
            canReview={history !== null}
            onPick={(index) => {
              setShowLog(false);
              setReview(index);
            }}
            onClose={() => setShowLog(false)}
          />
        )}
      </div>
    </FitBox>
  );
}

/** Die Rochade-Turmbewegung zum letzten Zug – für die Gleit-Animation. */
function engineCastle(entry: LogEntry): { from: number; to: number } | undefined {
  if (!entry.text.startsWith('O-O') || entry.action?.t !== 'm') return undefined;
  const { f, to } = entry.action;
  // Der Turm landet auf dem Feld zwischen Start- und Zielfeld des Königs und kommt von der Ecke dahinter.
  const step = Math.sign(to - f) * (Math.abs(to - f) >= 14 ? 14 : 1);
  const long = entry.text.startsWith('O-O-O');
  return { from: to + step * (long ? 2 : 1), to: to - step };
}

function Chronicle({ view, canReview, onPick, onClose }: { view: FourChessState; canReview: boolean; onPick: (index: number) => void; onClose: () => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  let moveNo = 0;
  return (
    <div className="fc-log" role="dialog" aria-label="Chronik">
      <div className="fc-log-head">
        <strong>📜 Chronik</strong>
        <span className="fc-log-tip">{canReview ? 'Zug antippen, um die Stellung zu sehen' : 'Rückblick erst in neuen Partien möglich'}</span>
      </div>
      <ol ref={listRef}>
        {view.log.map((entry, i) => {
          const isMove = entry.type === 'move';
          if (isMove) moveNo++;
          const content = (
            <>
              <span className="fc-log-no">{isMove ? moveNo : ''}</span>
              {entry.color && <span className={`fc-log-dot fc-dot-${entry.color}`} title={NAMES[entry.color]} />}
              {describe(entry, view.mode)}
            </>
          );
          return (
            <li key={i} className={entry.captured && !entry.captured.dead ? 'fc-log-hit' : undefined}>
              {canReview && entry.action ? (
                <button type="button" onClick={() => onPick(i)}>
                  {content}
                </button>
              ) : (
                <div>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className="fc-log-close" onClick={onClose}>
        Schließen
      </button>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  const color = COLORS[seat] ?? 'r';
  return <span className={`fc-symbol fc-symbol-${color} ${className}`}>{GLYPHS.K}</span>;
}

export const gameUi: GameUi<FourChessState, FourChessMove> = {
  Board,
  SeatSymbol,
  sounds: { moved: (event) => (event.captured ? 'stein-schlagen' : 'stein-ziehen') },
  seatLabel: (seat) => NAMES[COLORS[seat] ?? 'r'],
  seatScore: (view, seat) => (view.mode === 'ffa' ? view.scores[COLORS[seat] ?? 'r'] : null),
  seatDetail: (view, seat) => {
    const color = COLORS[seat] ?? 'r';
    const out = view.out[color];
    if (out) return `${NAMES[color]} · ${OUT_REASONS[out] ?? 'ausgeschieden'}`;
    if (checks(view).some((c) => c.color === color)) return `${NAMES[color]} · Schach!`;
    if (view.mode === 'teams') return `${NAMES[color]} · Team ${color === 'r' || color === 'y' ? 'Rot-Gelb' : 'Blau-Grün'}`;
    return NAMES[color];
  },
};
