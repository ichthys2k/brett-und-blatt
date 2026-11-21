import { useEffect, type RefObject } from 'react';
import { pickInitialFocus } from './consoleFocus';

const KEY_PREFIX = 'bub.konsole.fokus.';

function remembered(key: string): string | null {
  try {
    return sessionStorage.getItem(KEY_PREFIX + key);
  } catch {
    return null;
  }
}

function remember(key: string, id: string): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + key, id);
  } catch {
    // Ohne Speicher beginnt der Bildschirm beim nächsten Mal wieder vorn.
  }
}

/** Sichtbare Elemente mit `data-kns-id` oder `data-kns-autofocus`, in DOM-Reihenfolge. */
function candidates(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-kns-id], [data-kns-autofocus]')].filter((el) => {
    if ((el as HTMLButtonElement).disabled) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/**
 * Setzt beim Einhängen den Fokus in `ref` (#607, K3b): auf das zuletzt fokussierte Element dieses Bildschirms
 * (`data-kns-id`, gemerkt in sessionStorage `bub.konsole.fokus.<key>`), sonst auf `[data-kns-autofocus]`, sonst auf
 * das erste fokussierbare Element. Merkt jede Fokusänderung auf ein Element mit `data-kns-id`.
 */
export function useInitialFocus(ref: RefObject<HTMLElement | null>, key: string, ready = true, preferAutofocus = false): void {
  useEffect(() => {
    const root = ref.current;
    if (!root || !ready) return undefined;
    const frame = requestAnimationFrame(() => {
      if (root.contains(document.activeElement) && document.activeElement !== root) return;
      const list = candidates(root);
      const ids = list.map((el) => el.dataset.knsId ?? '__autofocus');
      const autofocus = list.find((el) => el.hasAttribute('data-kns-autofocus'));
      const target = pickInitialFocus(ids, remembered(key), autofocus ? (autofocus.dataset.knsId ?? '__autofocus') : null, preferAutofocus);
      let el = target ? list[ids.indexOf(target)] : undefined;
      if (!el) {
        el = root.querySelector<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]') ?? undefined;
      }
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const onFocus = (event: FocusEvent) => {
      const id = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-kns-id]')?.dataset.knsId;
      if (id) remember(key, id);
    };
    root.addEventListener('focusin', onFocus);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('focusin', onFocus);
    };
  }, [ref, key, ready, preferAutofocus]);
}
