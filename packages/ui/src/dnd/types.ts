import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface DragState<T> {
  isDragging: boolean;
  item: T | null;
  startPoint: Point;
  currentPoint: Point;
  delta: Point;
  targetId: string | null;
  snapping: boolean;
}

export interface UsePointerDragOptions<T> {
  threshold?: number;
  targetAttribute?: string;
  onDragStart?: (item: T, start: Point) => void;
  onDragMove?: (item: T, delta: Point, current: Point, targetId: string | null) => void;
  onDrop?: (item: T, targetId: string | null, point: Point) => boolean | void;
  onClick?: (item: T) => void;
  disabled?: boolean;
}

export interface PointerDragControls<T> {
  dragState: DragState<T>;
  bindDrag: (item: T) => {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    style?: CSSProperties;
  };
  cancelDrag: () => void;
}
