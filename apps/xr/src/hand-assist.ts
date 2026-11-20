/**
 * Hilfen für die Bedienung mit der bloßen Hand (#382, #383, #384, #388): Mit Handtracking sind
 * Zielen und Loslassen ungenauer als mit Controllern. Diese reine Rechnung (ohne three.js, getestet)
 * macht das Greifen verzeihender: größerer Einrast-Umkreis, Einrasten mit Trägheit, geglättete
 * Führung, Loslassen mit der Lage kurz VOR dem Öffnen der Finger (beim Pinch-Ende springt der
 * Strahl) und ein Handgelenk-Menü, das nur mit eindeutiger Geste erscheint.
 */

export interface SnapTarget {
  id: string | number;
  x: number;
  z: number;
}

/** Einrast-Umkreis der Hand im Vergleich zum Controller. */
export const HAND_RADIUS_FACTOR = 1.6;
export const handRadius = (base: number, hand: boolean): number => (hand ? base * HAND_RADIUS_FACTOR : base);

const distance = (target: SnapTarget, point: [number, number]) => Math.hypot(target.x - point[0], target.z - point[1]);

/**
 * Einrasten mit Trägheit: Das bisherige Ziel bleibt gewählt, bis die Figur deutlich über seinen
 * Umkreis hinaus ist (`stickiness` mal Radius) oder ein anderes Ziel klar näher liegt. Verhindert
 * das Flackern zwischen zwei Feldern bei zitternder Hand.
 */
export function stickySnap<T extends SnapTarget>(point: [number, number], targets: T[], radius: number, currentId: string | number | null, stickiness = 1.4): T | null {
  let best: T | null = null;
  let bestDistance = radius;
  for (const target of targets) {
    const d = distance(target, point);
    if (d <= bestDistance) {
      best = target;
      bestDistance = d;
    }
  }
  if (currentId === null) return best;
  const current = targets.find((t) => t.id === currentId);
  if (!current) return best;
  const dCurrent = distance(current, point);
  if (dCurrent > radius * stickiness) return best;
  if (!best || best.id === current.id) return current;
  return bestDistance < dCurrent * 0.7 ? best : current;
}

/** Glättung der geführten Lage (einpoliger Tiefpass); `alpha` 1 = ungeglättet. */
export function smoothPoint(previous: [number, number] | null, next: [number, number], alpha: number): [number, number] {
  if (!previous) return next;
  return [previous[0] + (next[0] - previous[0]) * alpha, previous[1] + (next[1] - previous[1]) * alpha];
}

export interface PoseSample {
  t: number;
  /** Ziel, auf dem die Figur zu diesem Zeitpunkt einrastete. */
  snap: string | number | null;
}

/**
 * Welches Ziel zählt beim Loslassen? Mit der Hand die Lage von `lookbackMs` vor dem Loslassen, weil
 * der Strahl beim Öffnen der Finger springt; der jüngste Eintrag, der mindestens so alt ist. Gibt es
 * keinen so alten (sehr kurzer Zug), zählt der älteste. Controller (`lookbackMs` 0) nehmen den jüngsten.
 */
export function pickReleaseSnap(history: PoseSample[], now: number, lookbackMs: number): string | number | null {
  if (history.length === 0) return null;
  if (lookbackMs <= 0) return history[history.length - 1]!.snap;
  let chosen = history[0]!;
  for (const sample of history) {
    if (sample.t <= now - lookbackMs) chosen = sample;
  }
  return chosen.snap;
}

/** Hält nur die letzten `windowMs` Millisekunden. */
export function pushSample(history: PoseSample[], sample: PoseSample, windowMs = 500): PoseSample[] {
  const next = [...history, sample];
  while (next.length > 1 && next[0]!.t < sample.t - windowMs) next.shift();
  return next;
}

/**
 * Gehört das Ende eines Drückens (Pinch, Abzug, Griff) zu dem Zeiger, der das Greifen begann? Der
 * Druck muss kurz vor dem Greifen begonnen haben (Reihenfolge der Ereignisse ist nicht festgelegt).
 */
export function isOwnerEnd(pressStartedAt: number | undefined, grabBeganAt: number, slackMs = 250): boolean {
  return pressStartedAt !== undefined && pressStartedAt >= grabBeganAt - slackMs;
}

// ---------------------------------------------------------------------------
// Handgelenk-Menü nur mit eindeutiger Geste (#388)

export interface PalmOptions {
  /** So lange muss die Handfläche dem Gesicht zugewandt gehalten werden. */
  holdMs: number;
  /** So lange darf sie beim offenen Menü kurz wegdrehen, ohne dass es schließt. */
  graceMs: number;
  /** Das Menü schließt spätestens nach dieser Zeit und braucht dann eine neue Geste. */
  maxOpenMs: number;
  /** Zum Öffnen: Kosinus zwischen Handflächen-Normale und Blick (strenger als zum Offenhalten). */
  openDot: number;
  keepDot: number;
}

export const PALM: PalmOptions = { holdMs: 700, graceMs: 300, maxOpenMs: 8000, openDot: 0.85, keepDot: 0.6 };

export interface PalmState {
  since: number | null;
  lostAt: number | null;
  openedAt: number | null;
  open: boolean;
  /** Nach dem automatischen Schließen muss die Handfläche erst weggedreht werden. */
  armed: boolean;
}

export const newPalmState = (): PalmState => ({ since: null, lostAt: null, openedAt: null, open: false, armed: true });

/** Ein Schritt je Bild; `dot` = null, wenn die Haltehand nicht verfolgt wird. Liefert, ob das Menü offen ist. */
export function stepPalm(state: PalmState, dot: number | null, now: number, options: PalmOptions = PALM): boolean {
  if (dot === null) {
    Object.assign(state, newPalmState());
    return false;
  }
  if (!state.open) {
    if (dot >= options.openDot) {
      if (!state.armed) return false;
      state.since ??= now;
      if (now - state.since >= options.holdMs) {
        state.open = true;
        state.openedAt = now;
        state.lostAt = null;
      }
    } else {
      state.since = null;
      state.armed = true;
    }
    return state.open;
  }
  if (dot >= options.keepDot) state.lostAt = null;
  else {
    state.lostAt ??= now;
    if (now - state.lostAt >= options.graceMs) {
      Object.assign(state, newPalmState());
      return false;
    }
  }
  if (state.openedAt !== null && now - state.openedAt >= options.maxOpenMs) {
    Object.assign(state, newPalmState(), { armed: false });
    return false;
  }
  return true;
}

/** Ein Druck, der kürzer als dies dauert und sich kaum bewegt, ist ein Antippen, kein Greifen (#585). */
export const TAP_MAX_MS = 500;
export const TAP_MAX_TRAVEL = 0.025;

/**
 * Antippen oder Greifen? Beim Druck auf eine greifbare Figur oder Karte beginnt das Greifen sofort
 * (die Figur verschwindet vom Brett und eine Auffangfläche erscheint); ein `click` auf die Figur kann
 * dann nicht mehr eintreffen. Ein kurzer Druck ohne nennenswerte Bewegung gilt deshalb als Antippen.
 */
export function isTap(elapsedMs: number, travel: number): boolean {
  return elapsedMs <= TAP_MAX_MS && travel <= TAP_MAX_TRAVEL;
}
