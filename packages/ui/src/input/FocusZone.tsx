import { useEffect, useRef, type ReactNode } from 'react';
import { useInputContext, useInputIntent } from './InputContext';
import { findNextFocusTarget, pickZoneEntryTarget, type FocusCandidate } from './spatialNav';
import { nextOptionIndex, nextRangeValue } from './formControls';
import { topModal } from './ModalFocus';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
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
    // Die Tastenleiste ist Hinweis, kein Ziel: ihr ✕ bleibt für Maus und Finger, das Steuerkreuz überspringt es.
    if (el.closest('.bub-prompt-bar')) continue;
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
      if (e.target instanceof HTMLElement || e.target instanceof SVGElement) {
        ctx.setZoneLastFocused(id, ensureElementId(e.target as HTMLElement));
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

/** Setzt den Wert eines Eingabefelds so, dass React die Änderung bemerkt (wie in VirtualKeyboard.tsx). */
function setNativeValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
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
    // SVG-Elemente mit tabIndex (Bretter aus SVG, z. B. Nicht ärgern!, Sternhalma) zählen wie HTML-Elemente (#621).
    const focused = document.activeElement;
    const active = focused instanceof HTMLElement || focused instanceof SVGElement ? (focused as HTMLElement) : null;

    // Schieberegler und Auswahllisten mit dem Controller bedienen (#613); die Tastatur bedient sie der Browser selbst.
    if (source === 'gamepad' && active instanceof HTMLInputElement && active.type === 'range' && (intent === 'left' || intent === 'right')) {
      const next = nextRangeValue(
        {
          value: Number(active.value),
          min: active.min === '' ? 0 : Number(active.min),
          max: active.max === '' ? 100 : Number(active.max),
          step: active.step === '' || active.step === 'any' ? 1 : Number(active.step),
        },
        intent === 'left' ? -1 : 1,
      );
      setNativeValue(active, String(next));
      ctx.announce(String(next));
      return true;
    }
    if (source === 'gamepad' && active instanceof HTMLSelectElement && intent === 'confirm') {
      const options = [...active.options];
      if (options.length > 1) {
        const index = nextOptionIndex(active.selectedIndex, options.map((o) => o.disabled));
        if (index !== active.selectedIndex) {
          active.selectedIndex = index;
          active.dispatchEvent(new Event('change', { bubbles: true }));
          active.dispatchEvent(new Event('input', { bubbles: true }));
        }
        ctx.announce(active.options[active.selectedIndex]?.text ?? '');
      }
      return true;
    }

    // Zonenwechsel mit Schultertasten (LB/RB)
    if (intent === 'zoneNext' || intent === 'zonePrev') {
      if (trappedZone || topModal() || zones.length === 0) return false;
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

    // B-Taste (Zurück) im Gamepad-Modus navigiert in Unterseiten zurück
    if (intent === 'cancel' && source === 'gamepad' && !trappedZone) {
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#/menu') {
        window.history.back();
        return true;
      }
      return false;
    }

    // Bestätigen per Gamepad A auf dem fokussierten Element
    if (intent === 'confirm' && source === 'gamepad') {
      if (active && active !== document.body) {
        // SVG-Elemente haben kein click(); ein Klick-Ereignis erreicht ihre onClick-Handler genauso.
        if (typeof active.click === 'function') active.click();
        else active.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
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
      // Ein offenes Fenster (`aria-modal`) hält das Steuerkreuz fest wie ein Bereich mit `trap` (#619).
      const scope = trappedZone?.element ?? topModal() ?? document.body;
      const { candidates, byId } = collectFocusableCandidates(scope);
      if (candidates.length === 0) return false;

      if (!active || active === document.body || !scope.contains(active)) {
        // Ohne Fokus beginnt die Navigation im ersten Bereich (kleinste `order`), am Spieltisch also im Spielfeld (#622).
        if (!trappedZone && scope === document.body) {
          for (const zone of zones) {
            const inZone = collectFocusableCandidates(zone.element);
            const entryId = pickZoneEntryTarget(inZone.candidates, zone.lastFocusedId);
            if (entryId) {
              inZone.byId.get(entryId)?.focus({ preventScroll: false });
              return true;
            }
          }
        }
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
      // Im eigenen Bereich bleiben, solange es dort in der Richtung ein Ziel gibt; sonst darf der Fokus hinüberwechseln
      // (#622: vom Ablagebänkchen sprang „runter“ sonst quer ins Spielmenü und „hoch“ von dort an den oberen Rand).
      const ownZone = trappedZone || scope !== document.body ? null : zones.find((z) => z.element.contains(active));
      const inOwnZone = ownZone ? others.filter((c) => ownZone.element.contains(byId.get(c.id) ?? null)) : [];
      // In den Menüs der Konsole sind Zeilen über die volle Breite üblich; dort zählt bei „hoch/runter“ der Abstand (#636).
      const navOptions = active.closest('.kns-frame, .kns-dialog') ? { verticalAlignedWeight: 0.01 } : undefined;
      const nextId =
        (inOwnZone.length > 0 ? findNextFocusTarget(curRect, inOwnZone, intent, navOptions) : null) ?? findNextFocusTarget(curRect, others, intent, navOptions);
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
