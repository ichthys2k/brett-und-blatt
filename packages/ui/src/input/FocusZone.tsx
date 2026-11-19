import { useEffect, useRef, type ReactNode } from 'react';
import { useInputContext, useInputIntent } from './InputContext';
import { findNextFocusTarget, pickZoneEntryTarget, type FocusCandidate } from './spatialNav';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
  '[role="button"]:not([aria-disabled="true"])',
].join(',');

let autoFocusIdCounter = 0;

function ensureElementId(el: HTMLElement): string {
  if (!el.dataset.bubFocusId) {
    autoFocusIdCounter += 1;
    el.dataset.bubFocusId = `bub-f-${autoFocusIdCounter}`;
  }
  return el.dataset.bubFocusId;
}

export function collectFocusableCandidates(root: HTMLElement): {
  candidates: FocusCandidate[];
  byId: Map<string, HTMLElement>;
} {
  const elements = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const candidates: FocusCandidate[] = [];
  const byId = new Map<string, HTMLElement>();

  for (const el of elements) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const id = ensureElementId(el);
    byId.set(id, el);
    candidates.push({
      id,
      rect: {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      },
    });
  }

  return { candidates, byId };
}

export interface FocusZoneProps {
  id: string;
  order?: number;
  label?: string;
  trap?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Markiert einen logischen Navigationsbereich (z. B. Brett, Hand, Aktionen, Menü).
 * Schultertasten (zoneNext/zonePrev) springen zwischen sichtbaren Zonen.
 */
export function FocusZone({ id, order = 0, label, trap = false, className = '', children }: FocusZoneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useInputContext();

  useEffect(() => {
    if (!ctx || !ref.current) return;
    return ctx.registerZone({
      id,
      order,
      label,
      trap,
      element: ref.current,
      lastFocusedId: null,
    });
  }, [ctx, id, order, label, trap]);

  useEffect(() => {
    const el = ref.current;
    if (!ctx || !el) return;
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) {
        ctx.setZoneLastFocused(id, ensureElementId(e.target));
      }
    };
    el.addEventListener('focusin', onFocusIn);
    return () => el.removeEventListener('focusin', onFocusIn);
  }, [ctx, id]);

  return (
    <div ref={ref} className={className} data-focus-zone={id} aria-label={label}>
      {children}
    </div>
  );
}

/**
 * Globaler Spatial-Navigation-Handler für Controller & Pfeiltasten (Fallback für alle Ansichten).
 * Wird nur aktiv, wenn keine spezifischere Spielkomponente (z. B. GridBoard) den Intent abfängt.
 */
export function GlobalSpatialNavigator() {
  const ctx = useInputContext();

  useInputIntent((intent, source) => {
    if (!ctx || typeof document === 'undefined') return false;
    if (ctx.settings.mode === 'scanAuto' || ctx.settings.mode === 'scanStep') return false;

    const zones = ctx.getZones();
    const trappedZone = [...zones].reverse().find((z) => z.trap);
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Zonenwechsel mit Schultertasten (LB/RB)
    if (intent === 'zoneNext' || intent === 'zonePrev') {
      if (trappedZone || zones.length === 0) return false;
      const nonEmptyZones = zones.filter((z) => collectFocusableCandidates(z.element).candidates.length > 0);
      if (nonEmptyZones.length === 0) return false;

      const curZoneIdx = active
        ? nonEmptyZones.findIndex((z) => z.element.contains(active))
        : -1;
      const delta = intent === 'zoneNext' ? 1 : -1;
      const nextIdx =
        curZoneIdx === -1
          ? delta > 0
            ? 0
            : nonEmptyZones.length - 1
          : (curZoneIdx + delta + nonEmptyZones.length) % nonEmptyZones.length;
      const nextZone = nonEmptyZones[nextIdx];
      const { candidates, byId } = collectFocusableCandidates(nextZone.element);
      const targetId = pickZoneEntryTarget(candidates, nextZone.lastFocusedId);
      if (targetId) {
        byId.get(targetId)?.focus({ preventScroll: false });
        if (nextZone.label) ctx.announce(nextZone.label);
        return true;
      }
      return false;
    }

    // Bestätigen per Gamepad A auf dem fokussierten Element
    if (intent === 'confirm' && source === 'gamepad') {
      if (active && active !== document.body) {
        active.click();
        return true;
      }
      return false;
    }

    // Scrollen per rechtem Stick / LT / RT
    if (intent === 'scrollUp' || intent === 'scrollDown') {
      const delta = intent === 'scrollUp' ? -240 : 240;
      const scrollTarget =
        (active?.closest('[data-scroll-container]') as HTMLElement | null) ?? document.scrollingElement;
      if (scrollTarget) {
        scrollTarget.scrollBy({ top: delta, behavior: 'smooth' });
        return true;
      }
      return false;
    }

    // Räumliche 2D-Navigation
    if (intent === 'up' || intent === 'down' || intent === 'left' || intent === 'right') {
      const scope = trappedZone?.element ?? document.body;
      const { candidates, byId } = collectFocusableCandidates(scope);
      if (candidates.length === 0) return false;

      if (!active || active === document.body || !scope.contains(active)) {
        const firstId = pickZoneEntryTarget(candidates, trappedZone?.lastFocusedId);
        if (firstId) {
          byId.get(firstId)?.focus({ preventScroll: false });
          return true;
        }
        return false;
      }

      const activeId = ensureElementId(active);
      const curRectRaw = active.getBoundingClientRect();
      const curRect = {
        left: curRectRaw.left,
        top: curRectRaw.top,
        right: curRectRaw.right,
        bottom: curRectRaw.bottom,
        width: curRectRaw.width,
        height: curRectRaw.height,
      };
      const others = candidates.filter((c) => c.id !== activeId);
      const nextId = findNextFocusTarget(curRect, others, intent);
      if (nextId) {
        const targetEl = byId.get(nextId);
        targetEl?.focus({ preventScroll: false });
        targetEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return true;
      }
    }

    return false;
  }, -10);

  return null;
}
