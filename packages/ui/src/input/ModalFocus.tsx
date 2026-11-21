import { useEffect, useRef } from 'react';
import { useInputContext, useInputIntent } from './InputContext';
import { collectFocusableCandidates } from './FocusZone';
import { isCloseLabel, pickModalEntry } from './modalFocus';

/** Das oberste sichtbare Fenster (`aria-modal="true"`) oder `null`. */
export function topModal(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const all = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter((el) => el.getClientRects().length > 0);
  return all.length > 0 ? all[all.length - 1]! : null;
}

function focusEntry(modal: HTMLElement): void {
  const { candidates, byId } = collectFocusableCandidates(modal);
  const elements = candidates.map((c) => byId.get(c.id)!);
  const index = pickModalEntry(
    elements.map((el) => ({ autofocus: el.hasAttribute('data-bub-autofocus') || el.hasAttribute('autofocus'), backdrop: /backdrop/.test(el.className.toString()) })),
  );
  if (index >= 0) elements[index]!.focus({ preventScroll: true });
}

/**
 * Fenster und Controller (#619–#622): Erscheint ein Fenster (`aria-modal="true"`), bekommt es bei Controller- oder
 * Tastaturbedienung den Fokus; B löst seinen Schließen-Knopf aus; nach dem Schließen kehrt der Fokus zurück.
 * Das Steuerkreuz bleibt im Fenster (`GlobalSpatialNavigator` benutzt `topModal()` als Bereich).
 */
export function ModalFocusManager() {
  const ctx = useInputContext();
  const sourceRef = useRef(ctx?.inputSource ?? 'pointer');
  sourceRef.current = ctx?.inputSource ?? 'pointer';
  const openRef = useRef<HTMLElement | null>(null);
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
    let frame = 0;
    const check = () => {
      frame = 0;
      const modal = topModal();
      if (modal === openRef.current) return;
      const previous = openRef.current;
      openRef.current = modal;
      if (modal) {
        if (!previous) {
          const active = document.activeElement;
          returnRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
        }
        if (sourceRef.current !== 'pointer' && !modal.contains(document.activeElement)) focusEntry(modal);
      } else {
        const back = returnRef.current;
        returnRef.current = null;
        const active = document.activeElement;
        if (back?.isConnected && (!active || active === document.body)) back.focus({ preventScroll: true });
      }
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(check);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // B schließt das oberste Fenster über seinen Schließen-Knopf (vor der B-Sperre am Spieltisch, Priorität −5).
  useInputIntent((intent, source) => {
    if (intent !== 'cancel' || source !== 'gamepad') return false;
    const modal = topModal();
    if (!modal) return false;
    const closer = [...modal.querySelectorAll<HTMLElement>('button:not([disabled])')].find((b) => b.getClientRects().length > 0 && isCloseLabel(b.getAttribute('aria-label') ?? b.textContent ?? ''));
    if (closer) {
      closer.click();
      return true;
    }
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    return true;
  }, 0);

  return null;
}
