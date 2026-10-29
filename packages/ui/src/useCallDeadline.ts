import { useEffect, useRef } from 'react';

/**
 * Frist für den „Mau!“-/„Eins!“-Ruf: Für jeden Platz in `dueSeats` läuft ab dem Moment, in dem er
 * auftaucht, eine Uhr von `ms` Millisekunden. Ruft er nicht rechtzeitig, löst `onExpire(seat)` die
 * Strafe aus. Die Uhr läuft weiter, auch wenn sich der Spielstand zwischendurch ändert, und wird
 * gestoppt, sobald der Platz nicht mehr in `dueSeats` steht (gerufen, Karten gezogen, Partie aus).
 */
export function useCallDeadline(dueSeats: number[], onExpire: (seat: number) => void, ms = 3000): void {
  const timers = useRef(new Map<number, number>());
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const key = dueSeats.join(',');

  useEffect(() => {
    const active = new Set(dueSeats);
    for (const [seat, timer] of timers.current) {
      if (!active.has(seat)) {
        window.clearTimeout(timer);
        timers.current.delete(seat);
      }
    }
    for (const seat of active) {
      if (timers.current.has(seat)) continue;
      timers.current.set(
        seat,
        window.setTimeout(() => {
          timers.current.delete(seat);
          expire.current(seat);
        }, ms),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );
}
