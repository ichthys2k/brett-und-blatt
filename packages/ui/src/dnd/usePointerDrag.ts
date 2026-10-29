import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { DragState, Point, PointerDragControls, UsePointerDragOptions } from './types';

const INITIAL_STATE = {
  isDragging: false,
  item: null,
  startPoint: { x: 0, y: 0 },
  currentPoint: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
  targetId: null,
  snapping: false,
};

/**
 * Universeller Hook für Drag & Drop via Pointer Events (Touch, Maus, Stift).
 * Unterscheidet automatisch zwischen Klick/Tap (Bewegung < Schwelle) und Drag.
 */
export function usePointerDrag<T>({
  threshold = 6,
  targetAttribute = 'data-drop-target',
  onDragStart,
  onDragMove,
  onDrop,
  onClick,
  disabled = false,
}: UsePointerDragOptions<T> = {}): PointerDragControls<T> {
  const [dragState, setDragState] = useState<DragState<T>>(INITIAL_STATE as DragState<T>);
  const snapTimeoutRef = useRef<number | null>(null);

  const callbacksRef = useRef({ onDragStart, onDragMove, onDrop, onClick });
  callbacksRef.current = { onDragStart, onDragMove, onDrop, onClick };

  const activeRef = useRef<{
    item: T;
    startX: number;
    startY: number;
    hasStarted: boolean;
    targetId: string | null;
  } | null>(null);

  const cancelDrag = useCallback(() => {
    if (snapTimeoutRef.current !== null) {
      window.clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = null;
    }
    activeRef.current = null;
    setDragState(INITIAL_STATE as DragState<T>);
  }, []);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, item: T) => {
      if (disabled || e.button !== 0) return;

      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }

      const startX = e.clientX;
      const startY = e.clientY;
      // Nur dieser Finger zählt: Am geteilten Bildschirm ziehen mehrere Spieler gleichzeitig.
      const pointerId = e.pointerId;
      const mine = (ev: PointerEvent) => ev.pointerId === pointerId;

      activeRef.current = {
        item,
        startX,
        startY,
        hasStarted: false,
        targetId: null,
      };

      const findDropTarget = (clientX: number, clientY: number): string | null => {
        if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
        const elements = document.elementsFromPoint(clientX, clientY);
        for (const el of elements) {
          if (el.classList.contains('bub-dragging')) continue;
          const target = el.closest(`[${targetAttribute}]`);
          if (target) {
            return target.getAttribute(targetAttribute);
          }
        }
        return null;
      };

      const onWindowPointerMove = (moveEv: PointerEvent) => {
        if (!mine(moveEv)) return;
        const active = activeRef.current;
        if (!active) return;

        const deltaX = moveEv.clientX - active.startX;
        const deltaY = moveEv.clientY - active.startY;
        const dist = Math.hypot(deltaX, deltaY);

        if (!active.hasStarted) {
          if (dist >= threshold) {
            active.hasStarted = true;
            callbacksRef.current.onDragStart?.(active.item, { x: active.startX, y: active.startY });
          } else {
            return;
          }
        }

        const targetId = findDropTarget(moveEv.clientX, moveEv.clientY);
        active.targetId = targetId;

        const currentPoint: Point = { x: moveEv.clientX, y: moveEv.clientY };
        const delta: Point = { x: deltaX, y: deltaY };

        setDragState({
          isDragging: true,
          item: active.item,
          startPoint: { x: active.startX, y: active.startY },
          currentPoint,
          delta,
          targetId,
          snapping: false,
        });

        callbacksRef.current.onDragMove?.(active.item, delta, currentPoint, targetId);
      };

      const cleanupWindowListeners = () => {
        window.removeEventListener('pointermove', onWindowPointerMove);
        window.removeEventListener('pointerup', onWindowPointerUp);
        window.removeEventListener('pointercancel', onWindowPointerCancel);
      };

      const onWindowPointerUp = (upEv: PointerEvent) => {
        if (!mine(upEv)) return;
        cleanupWindowListeners();
        const active = activeRef.current;
        if (!active) return;

        if (active.hasStarted) {
          // Klick-Ereignis für diesen Drag unterdrücken, damit kein versehentlicher Klick ausgelöst wird
          const suppressClick = (clickEv: MouseEvent) => {
            clickEv.stopPropagation();
            clickEv.preventDefault();
            window.removeEventListener('click', suppressClick, true);
          };
          window.addEventListener('click', suppressClick, true);
          window.setTimeout(() => window.removeEventListener('click', suppressClick, true), 50);

          const targetId = findDropTarget(upEv.clientX, upEv.clientY);
          const dropAccepted = callbacksRef.current.onDrop?.(active.item, targetId, {
            x: upEv.clientX,
            y: upEv.clientY,
          });

          if (dropAccepted === false) {
            // Ungültiger Drop -> Zurückfedern
            setDragState((prev) => ({
              ...prev,
              snapping: true,
              delta: { x: 0, y: 0 },
            }));
            snapTimeoutRef.current = window.setTimeout(() => {
              cancelDrag();
            }, 180);
          } else {
            cancelDrag();
          }
        } else {
          // Klick / Tap ohne wesentliche Verschiebung
          cancelDrag();
          callbacksRef.current.onClick?.(active.item);
        }
      };

      const onWindowPointerCancel = (cancelEv: PointerEvent) => {
        if (!mine(cancelEv)) return;
        cleanupWindowListeners();
        cancelDrag();
      };

      window.addEventListener('pointermove', onWindowPointerMove);
      window.addEventListener('pointerup', onWindowPointerUp);
      window.addEventListener('pointercancel', onWindowPointerCancel);
    },
    [disabled, threshold, targetAttribute, cancelDrag],
  );

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }
    };
  }, []);

  const bindDrag = useCallback(
    (item: T) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => handlePointerDown(e, item),
      style: { touchAction: 'none' as const },
    }),
    [handlePointerDown],
  );

  return {
    dragState,
    bindDrag,
    cancelDrag,
  };
}
