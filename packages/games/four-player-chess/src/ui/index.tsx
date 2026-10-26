import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, useElementSize, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useLayoutEffect, useRef, useState } from 'react';
import { COLORS, type Color, type FourChessMove, type FourChessState, type Piece } from '../rules';
import './styles.css';

const NAMES: Record<Color, string> = { r: 'Rot', b: 'Blau', y: 'Gelb', g: 'Grün' };
/** Schachfiguren als Textzeichen; ︎ verhindert, dass Handys sie als bunte Emojis zeigen. */
const GLYPHS: Record<Piece['t'], string> = { K: '♚︎', Q: '♛︎', R: '♜︎', B: '♝︎', N: '♞︎', P: '♟︎' };
const PIECE_NAMES: Record<Piece['t'], string> = { K: 'König', Q: 'Dame', R: 'Turm', B: 'Läufer', N: 'Springer', P: 'Bauer' };
const OUT_REASONS: Record<string, string> = { mate: 'matt', stalemate: 'patt', resign: 'aufgegeben', time: 'Zeit abgelaufen', king: 'König geschlagen' };

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

function squareName(index: number): string {
  return `${String.fromCharCode(97 + (index % 14))}${14 - Math.floor(index / 14)}`;
}

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

function Board({ view, legalMoves, onMove, viewer, activeSeat, hint }: BoardProps<FourChessState, FourChessMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<MoveMove[] | null>(null);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
    setPromotion(null);
  }

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
  const moves = legalMoves.filter((m): m is MoveMove => m.t === 'm');
  const claim = legalMoves.find((m) => m.t === 'claim');
  const movable = new Set(moves.map((m) => m.f));
  const targets = new Set(selected === null ? [] : moves.filter((m) => m.f === selected).map((m) => m.to));
  const hintMove = hint && hint.t === 'm' ? hint : null;

  const tap = (index: number) => {
    if (selected !== null && targets.has(index)) {
      const options = moves.filter((m) => m.f === selected && m.to === index);
      if (options.length > 1) setPromotion(options);
      else if (options[0]) onMove(options[0]);
      return;
    }
    setSelected(movable.has(index) && index !== selected ? index : null);
  };

  return (
    <FitBox ratio={1}>
      <div className="fc-wrap" ref={sizeRef}>
        <div className={`fc-scroll ${zoomed ? 'fc-zoomed' : ''}`} ref={scrollRef}>
          <div className="fc-zoom">
            <GridBoard
              cols={14}
              rows={14}
              label="Vierer-Schachbrett"
              className="fc-board"
              renderCell={(dc, dr) => {
                const index = toBoard(dc, dr, perspective);
                const piece = view.board[index];
                if (!onBoard(Math.floor(index / 14), index % 14)) return null;
                return piece ? <span className={`fc-piece fc-${piece.d ? 'dead' : piece.c}`}>{GLYPHS[piece.t]}</span> : targets.has(index) ? <span className="fc-dot" /> : null;
              }}
              isActive={(dc, dr) => {
                const index = toBoard(dc, dr, perspective);
                return movable.has(index) || targets.has(index);
              }}
              onActivate={(dc, dr) => tap(toBoard(dc, dr, perspective))}
              cellClassName={(dc, dr) => {
                const index = toBoard(dc, dr, perspective);
                const row = Math.floor(index / 14);
                const col = index % 14;
                if (!onBoard(row, col)) return 'fc-off';
                const classes = [(row + col) % 2 === 0 ? 'fc-light' : 'fc-dark'];
                if (index === selected) classes.push('fc-selected');
                if (targets.has(index) && view.board[index]) classes.push('fc-capture');
                if (view.lastMove && (view.lastMove.from === index || view.lastMove.to === index)) classes.push('fc-last');
                if (hintMove && (hintMove.f === index || hintMove.to === index)) classes.push('fc-hint');
                return classes.join(' ');
              }}
              cellLabel={(dc, dr) => {
                const index = toBoard(dc, dr, perspective);
                const piece = view.board[index];
                return `${squareName(index)}: ${piece ? `${piece.d ? 'tote Figur' : NAMES[piece.c]} ${PIECE_NAMES[piece.t]}` : 'frei'}`;
              }}
            />
          </div>
        </div>
        {(zoomed || (cellSize > 0 && cellSize < ZOOM_BELOW)) && (
          <button type="button" className="fc-lens" aria-pressed={zoomed} aria-label={zoomed ? 'Brett verkleinern' : 'Brett vergrößern'} title={zoomed ? 'Brett verkleinern' : 'Brett vergrößern'} onClick={() => toggleZoom(!zoomed)}>
            {zoomed ? '⊖' : '🔍'}
          </button>
        )}
        {claim && (
          <button type="button" className="fc-claim" onClick={() => onMove(claim)}>
            🏆 Sieg beanspruchen
          </button>
        )}
        {promotion && (
          <div className="fc-promotion" role="dialog" aria-label="Umwandlung wählen">
            {promotion.map((m) => (
              <button key={m.pr} type="button" className={`fc-piece fc-${m.p}`} onClick={() => onMove(m)} aria-label={PIECE_NAMES[m.pr ?? 'Q']}>
                {GLYPHS[m.pr ?? 'Q']}
              </button>
            ))}
          </div>
        )}
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  const color = COLORS[seat] ?? 'r';
  return <span className={`fc-symbol fc-symbol-${color} ${className}`}>{GLYPHS.K}</span>;
}

export const gameUi: GameUi<FourChessState, FourChessMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => NAMES[COLORS[seat] ?? 'r'],
  seatDetail: (view, seat) => {
    const color = COLORS[seat] ?? 'r';
    const out = view.out[color];
    const status = out ? ` · ${OUT_REASONS[out] ?? 'ausgeschieden'}` : '';
    if (view.mode === 'teams') return `${NAMES[color]} · Team ${color === 'r' || color === 'y' ? 'Rot-Gelb' : 'Blau-Grün'}${status}`;
    return `${NAMES[color]} · ${view.scores[color]} Punkte${status}`;
  },
};
