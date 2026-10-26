import type { ReactNode } from 'react';

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
  const cells: ReactNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const active = isActive?.(col, row) ?? false;
      const extra = cellProps?.(col, row);
      cells.push(
        <button
          key={`${col}-${row}`}
          type="button"
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
