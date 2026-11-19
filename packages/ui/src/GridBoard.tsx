import { useRef, type ReactNode } from 'react';
import { collectFocusableCandidates } from './input/FocusZone';
import { useInputIntent } from './input/InputContext';
import { findNextFocusTarget } from './input/spatialNav';

export interface GridBoardProps {
  cols: number;
  rows: number;
  /** Beschreibung für Screenreader, z. B. „Spielfeld“. */
  label: string;
  /** Inhalt einer Zelle; Reihe 0 ist die oberste Bildschirmreihe. */
  renderCell: (col: number, row: number) => ReactNode;
  /** Ist die Zelle gerade antippbar? */
  isActive?: (col: number, row: number) => boolean;
  onActivate?: (col: number, row: number) => void;
  cellLabel?: (col: number, row: number) => string;
  cellClassName?: (col: number, row: number) => string;
  /** Meldet die Spalte unter dem Mauszeiger (für Vorschau-Steine am Desktop). */
  onHoverColumn?: (col: number | null) => void;
  className?: string;
  /** Zusätzliche Attribute (z. B. data-drop-target oder Pointer-Handler). */
  cellProps?: (col: number, row: number) => Record<string, unknown>;
}

/**
 * Rechteckiges Raster aus Zellen – die Grundlage für Tic-Tac-Toe, Vier in einer
 * Reihe, Reversi, Go, Schiffe versenken und Paare finden. Jede Zelle ist ein Knopf
 * und damit auch per Tastatur bedienbar; nicht antippbare Zellen sind deaktiviert.
 * Die Zellen bleiben immer dieselben Elemente, damit Animationen nicht neu starten.
 */
export function GridBoard({ cols, rows, label, renderCell, isActive, onActivate, cellLabel, cellClassName, onHoverColumn, className = '', cellProps }: GridBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useInputIntent((intent) => {
    if (intent !== 'up' && intent !== 'down' && intent !== 'left' && intent !== 'right') return false;
    const root = rootRef.current;
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    if (!root || !(activeEl instanceof HTMLButtonElement) || !root.contains(activeEl)) return false;

    const curCol = Number(activeEl.dataset.gridCol);
    const curRow = Number(activeEl.dataset.gridRow);
    if (!Number.isFinite(curCol) || !Number.isFinite(curRow)) return false;

    const dc = intent === 'left' ? -1 : intent === 'right' ? 1 : 0;
    const dr = intent === 'up' ? -1 : intent === 'down' ? 1 : 0;

    // Zuerst streng orthogonal in derselben Zeile/Spalte suchen
    let c = curCol + dc;
    let r = curRow + dr;
    while (c >= 0 && c < cols && r >= 0 && r < rows) {
      const btn = root.querySelector<HTMLButtonElement>(`button[data-grid-col="${c}"][data-grid-row="${r}"]:not([disabled])`);
      if (btn) {
        btn.focus({ preventScroll: false });
        return true;
      }
      c += dc;
      r += dr;
    }

    // Fallback: räumlich nächste aktive Zelle im Brett (für schräge/Springer-Ziele in Schach/Dame)
    const { candidates, byId } = collectFocusableCandidates(root);
    const activeRect = activeEl.getBoundingClientRect();
    const curId = activeEl.dataset.bubFocusId;
    const nextId = findNextFocusTarget(
      {
        left: activeRect.left,
        top: activeRect.top,
        right: activeRect.right,
        bottom: activeRect.bottom,
        width: activeRect.width,
        height: activeRect.height,
      },
      candidates.filter((cand) => cand.id !== curId),
      intent,
    );
    if (nextId) {
      byId.get(nextId)?.focus({ preventScroll: false });
      return true;
    }

    return false;
  }, 5);

  const cells: ReactNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const active = isActive?.(col, row) ?? false;
      const extra = cellProps?.(col, row);
      cells.push(
        <button
          key={`${col}-${row}`}
          type="button"
          data-grid-col={col}
          data-grid-row={row}
          disabled={!active}
          aria-label={cellLabel?.(col, row)}
          className={`bub-cell ${cellClassName?.(col, row) ?? ''}`}
          onClick={active ? () => onActivate?.(col, row) : undefined}
          {...extra}
        >
          {renderCell(col, row)}
        </button>,
      );
    }
  }
  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      className={`bub-grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, aspectRatio: `${cols} / ${rows}` }}
      onPointerMove={
        onHoverColumn
          ? (event) => {
              // Über die Position statt über die Zellen: deaktivierte Knöpfe melden keine Mausereignisse.
              const rect = event.currentTarget.getBoundingClientRect();
              const col = Math.floor(((event.clientX - rect.left) / rect.width) * cols);
              onHoverColumn(col >= 0 && col < cols ? col : null);
            }
          : undefined
      }
      onPointerLeave={onHoverColumn ? () => onHoverColumn(null) : undefined}
    >
      {cells}
    </div>
  );
}
