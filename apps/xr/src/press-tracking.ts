/**
 * Merkt sich, wann in der Brille ein Druck (Pinch, Abzug, Griff) begann, und meldet sein Ende
 * (#382). Beim Greifen verlässt man sich nicht allein auf das `pointerup` des Zeiger-Pakets: Das
 * sendet nichts, wenn der Zeiger beim Loslassen kein Objekt trifft (Hand weit über dem Brett, Strahl
 * daneben). Das Ende des Drückens kommt dagegen immer an.
 */
const starts = new Map<unknown, number>();
const listeners = new Set<(startedAt: number | undefined) => void>();

const KINDS = ['select', 'squeeze'] as const;

/** Meldet sich an einer XR-Sitzung an; liefert die Abmeldung. */
export function bindPressSession(session: XRSession): () => void {
  const cleanup: Array<() => void> = [];
  for (const kind of KINDS) {
    const onStart = (event: Event) => {
      starts.set(`${kind}:${(event as XRInputSourceEvent).inputSource.handedness}`, performance.now());
    };
    const onEnd = (event: Event) => {
      const key = `${kind}:${(event as XRInputSourceEvent).inputSource.handedness}`;
      const startedAt = starts.get(key);
      starts.delete(key);
      listeners.forEach((fn) => fn(startedAt));
    };
    session.addEventListener(`${kind}start`, onStart);
    session.addEventListener(`${kind}end`, onEnd);
    cleanup.push(() => {
      session.removeEventListener(`${kind}start`, onStart);
      session.removeEventListener(`${kind}end`, onEnd);
    });
  }
  return () => {
    cleanup.forEach((fn) => fn());
    starts.clear();
  };
}

/** Wird bei jedem Ende eines Drückens gerufen, mit dem Zeitpunkt seines Beginns (falls bekannt). */
export function onPressEnd(fn: (startedAt: number | undefined) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
