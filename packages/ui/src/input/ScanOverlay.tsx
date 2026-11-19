import { useEffect, useRef, useState } from 'react';
import { collectFocusableCandidates } from './FocusZone';
import { useInputContext, useInputIntent, type RegisteredZone } from './InputContext';
import {
  INITIAL_SCAN_STATE,
  stepScanAdvance,
  stepScanBack,
  stepScanSelect,
  type ScanState,
} from './scanEngine';

/**
 * Switch-Access-Scanner (C6) für 1-Taster- (scanAuto) und 2-Taster-Bedienung (scanStep).
 * Hebt aktuell gescannte Zone bzw. aktuell gescanntes Element per CSS-Klasse hervor.
 */
export function ScanOverlay() {
  const ctx = useInputContext();
  const mode = ctx?.settings.mode;
  const intervalMs = ctx?.settings.scanIntervalMs ?? 1200;
  const isScan = mode === 'scanAuto' || mode === 'scanStep';

  const [scan, setScan] = useState<ScanState>(INITIAL_SCAN_STATE);
  const scanRef = useRef(scan);
  scanRef.current = scan;

  const lastHighlightedRef = useRef<HTMLElement | null>(null);

  // Vorherige Hervorhebung aufräumen
  const clearHighlight = () => {
    if (lastHighlightedRef.current) {
      lastHighlightedRef.current.classList.remove('bub-scan-active');
      lastHighlightedRef.current = null;
    }
  };

  useEffect(() => {
    if (!isScan) {
      clearHighlight();
      setScan(INITIAL_SCAN_STATE);
    }
    return clearHighlight;
  }, [isScan]);

  const getActiveZonesAndItems = () => {
    if (!ctx) return { zones: [] as RegisteredZone[], items: [] as HTMLElement[] };
    const allZones = ctx.getZones().filter((z) => collectFocusableCandidates(z.element).candidates.length > 0);
    const trapped = [...allZones].reverse().find((z) => z.trap);
    const zones = trapped ? [trapped] : allZones;
    const z = zones[scanRef.current.zoneIndex % Math.max(1, zones.length)];
    const items = z ? [...collectFocusableCandidates(z.element).byId.values()] : [];
    return { zones, items };
  };

  // Visuelle Markierung nachziehen
  useEffect(() => {
    if (!isScan || !ctx) return;
    clearHighlight();
    const { zones, items } = getActiveZonesAndItems();
    if (zones.length === 0) return;

    const targetZone = zones[scan.zoneIndex % zones.length];
    if (scan.phase === 'zone') {
      targetZone.element.classList.add('bub-scan-active');
      lastHighlightedRef.current = targetZone.element;
      if (targetZone.label) ctx.announce(targetZone.label);
    } else if (items.length > 0) {
      const targetEl = items[scan.itemIndex % items.length];
      targetEl.classList.add('bub-scan-active');
      targetEl.focus({ preventScroll: false });
      lastHighlightedRef.current = targetEl;
    }
  }, [isScan, scan, ctx]);

  // Auto-Scan-Takt
  useEffect(() => {
    if (mode !== 'scanAuto') return;
    const timer = window.setInterval(() => {
      const { zones, items } = getActiveZonesAndItems();
      setScan((prev) => stepScanAdvance(prev, zones.length, items.length));
    }, Math.max(400, intervalMs));
    return () => window.clearInterval(timer);
  }, [mode, intervalMs]);

  // Eingabe-Intents für Scan
  useInputIntent((intent) => {
    if (!isScan || !ctx) return false;
    const { zones, items } = getActiveZonesAndItems();
    if (zones.length === 0) return false;

    if (intent === 'confirm') {
      const targetZone = zones[scanRef.current.zoneIndex % zones.length];
      const zoneItems = [...collectFocusableCandidates(targetZone.element).byId.values()];
      const res = stepScanSelect(scanRef.current, zones.length, zoneItems.length);
      setScan(res.nextState);
      if (res.triggerItemIndex !== undefined && zoneItems[res.triggerItemIndex]) {
        zoneItems[res.triggerItemIndex].click();
      }
      return true;
    }

    if (mode === 'scanStep' && (intent === 'right' || intent === 'down' || intent === 'zoneNext')) {
      setScan((prev) => stepScanAdvance(prev, zones.length, items.length));
      return true;
    }

    if (intent === 'cancel') {
      setScan((prev) => stepScanBack(prev));
      return true;
    }

    return false;
  }, 20);

  // Leertaste im Scan-Modus als Ein-Taster-Auslöser unterstützen
  useEffect(() => {
    if (!isScan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        const { zones } = getActiveZonesAndItems();
        if (zones.length === 0) return;
        const targetZone = zones[scanRef.current.zoneIndex % zones.length];
        const zoneItems = [...collectFocusableCandidates(targetZone.element).byId.values()];
        const res = stepScanSelect(scanRef.current, zones.length, zoneItems.length);
        setScan(res.nextState);
        if (res.triggerItemIndex !== undefined && zoneItems[res.triggerItemIndex]) {
          zoneItems[res.triggerItemIndex].click();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isScan]);

  return null;
}
