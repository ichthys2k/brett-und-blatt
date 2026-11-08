/** Die Bildfläche, auf der Spiele für den Fernseher gerechnet werden: groß genug für das normale Layout. */
export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;
export const STAGE_MAX_SCALE = 2.5;

/** Faktor, mit dem eine Bildfläche der Größe `width` × `height` auf die Bühne passt (nie kleiner als 1). */
export function stageScale(width: number, height: number): number {
  return Math.min(STAGE_MAX_SCALE, Math.max(1, Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT)));
}
