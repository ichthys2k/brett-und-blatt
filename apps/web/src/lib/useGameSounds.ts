import type { GameSession, Result, SeatId } from '@brett-und-blatt/engine';
import { soundCatalog, soundDuration, soundsForEvents, type SoundMap, type SoundName } from '@brett-und-blatt/ui';
import { useEffect, useRef } from 'react';
import { sound } from './sound';

/** Ab hier warnt die Uhr – aber nur, wenn der Zug mit mehr Zeit begonnen hat. */
const TIME_WARNING_MS = 10_000;
/** Züge der Gegner klingen etwas leiser als die eigenen. */
const OTHERS_VOLUME = 0.6;

/**
 * Vertont eine Partie: Klänge zu den Ereignissen jedes Zugs (aus der Zuordnung des
 * Spiels), dazu Sieg, Niederlage, Zeitwarnung und online „Du bist dran“.
 * Beim Fortsetzen einer gespeicherten Partie spielt nichts nach.
 */
export function useGameSounds(session: GameSession, sounds: SoundMap | undefined, yourSeat: SeatId | null | undefined) {
  const online = yourSeat !== undefined;
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;

  useEffect(() => {
    sound.preload(Object.keys(soundCatalog) as SoundName[]);
    const seats = session.config.seats;
    /** Plätze, die an diesem Gerät gespielt werden. */
    const local: SeatId[] = online ? (yourSeat === null ? [] : [yourSeat]) : seats.flatMap((seat, i) => (seat.kind === 'human' ? [i] : []));
    let before = { current: session.currentSeats(), result: session.result };

    return session.subscribe(({ events, entry }) => {
      const now = { current: session.currentSeats(), result: session.result };
      const previous = before;
      before = now;
      if (events.some((event) => event.type === 'undo')) return;

      const movers = entry && typeof entry.actor === 'number' ? [entry.actor] : previous.current;
      const volume = movers.some((seat) => local.includes(seat)) || local.length === 0 ? 1 : OTHERS_VOLUME;
      const names = soundsForEvents(events, soundsRef.current);
      if (events.some((event) => event.type === 'forfeit' && event.reason === 'time')) names.push('zeit-um');

      let delay = 0;
      for (const name of names) {
        sound.play(name, { volume, delay });
        delay += Math.min(soundDuration(name) * 0.7, 0.8);
      }
      if (!previous.result && now.result) sound.play(resultSound(now.result, local), { delay: delay + 0.15 });
      else if (online && yourSeat !== null && !now.result && now.current.includes(yourSeat) && !previous.current.includes(yourSeat)) {
        sound.play('dein-zug', { volume: 0.8, delay: delay + 0.1 });
      }
    });
  }, [session, online, yourSeat]);

  // Zeitwarnung für die Plätze an diesem Gerät.
  useEffect(() => {
    if (!session.timed) return;
    const seats = session.config.seats;
    const local: SeatId[] = online ? (yourSeat === null ? [] : [yourSeat]) : seats.flatMap((seat, i) => (seat.kind === 'human' ? [i] : []));
    const lastLeft = new Map<SeatId, number>();
    const id = window.setInterval(() => {
      if (session.result) return;
      for (const seat of local) {
        const clock = session.clock(seat);
        if (!clock.running || clock.leftMs === null) {
          lastLeft.delete(seat);
          continue;
        }
        const last = lastLeft.get(seat);
        if (last !== undefined && last > TIME_WARNING_MS && clock.leftMs <= TIME_WARNING_MS) sound.play('zeit-knapp');
        lastLeft.set(seat, clock.leftMs);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [session, online, yourSeat]);
}

/** Aus Sicht der Menschen an diesem Gerät; ohne Menschen (nur Bots) klingt jeder Sieg fröhlich. */
function resultSound(result: Result, local: SeatId[]): SoundName {
  if (result.kind === 'draw') return 'unentschieden';
  if (result.kind === 'loss') return 'niederlage';
  return local.length === 0 || result.winners.some((seat) => local.includes(seat)) ? 'sieg' : 'niederlage';
}
