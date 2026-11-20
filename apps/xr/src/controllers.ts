/**
 * Controller-Gruppen vorab anlegen (#586).
 *
 * three weist Eingabequellen nur Controller-Gruppen zu, die beim `inputsourceschange` schon
 * existieren (`WebXRManager.getController` legt sie sonst erst beim ersten Aufruf an – bei uns im
 * ersten Bild nach dem Sitzungsstart, also zu spät). Danach blieben `visible=false` und Position 0,
 * bis ein Controller getrennt und neu verbunden wurde. Deshalb legen wir die Gruppen schon vor dem
 * Sitzungsstart an; `getController`/`getControllerGrip` sind idempotent.
 */

/** Anzahl der Eingabequellen, die wir bedienen (zwei Controller plus zwei Hände als Reserve). */
export const CONTROLLER_SLOTS = 4;

/** Das Stück von `renderer.xr`, das wir brauchen (für Tests ohne Brille nachbildbar). */
export interface ControllerHost {
  getController(index: number): unknown;
  getControllerGrip(index: number): unknown;
}

/** Legt die Gruppen für Zeiger und Griff an; liefert, wie viele es sind. */
export function ensureControllers(xr: ControllerHost, slots = CONTROLLER_SLOTS): number {
  for (let i = 0; i < slots; i++) {
    xr.getController(i);
    xr.getControllerGrip(i);
  }
  return slots;
}
