/*
 * Reine Helfer, um Schieberegler und Auswahllisten mit dem Controller zu bedienen (#607, K3c).
 * Die Anbindung an das DOM steht in `GlobalSpatialNavigator` (FocusZone.tsx).
 */

/** Nächster Wert eines Schiebereglers nach einem Schritt; bleibt in [min, max]; `step <= 0` oder ungültig zählt als 1. */
export function nextRangeValue(input: { value: number; min: number; max: number; step: number }, direction: -1 | 1): number {
  const min = Number.isFinite(input.min) ? input.min : 0;
  const max = Number.isFinite(input.max) ? input.max : 100;
  const step = Number.isFinite(input.step) && input.step > 0 ? input.step : 1;
  const value = Number.isFinite(input.value) ? input.value : min;
  // Auf das Raster ab `min` einrasten, dann einen Schritt weiter.
  const steps = Math.round((value - min) / step) + direction;
  const raw = min + steps * step;
  const rounded = Math.round(raw * 1e6) / 1e6;
  return Math.min(max, Math.max(min, rounded));
}

/** Index der nächsten wählbaren Option (mit Umlauf, überspringt gesperrte); bleibt, wenn keine andere wählbar ist. */
export function nextOptionIndex(current: number, disabled: readonly boolean[]): number {
  const n = disabled.length;
  for (let i = 1; i < n; i++) {
    const candidate = (((current + i) % n) + n) % n;
    if (!disabled[candidate]) return candidate;
  }
  return current;
}
