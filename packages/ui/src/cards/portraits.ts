import type { CardId, DeckStyle, Suit } from '@brett-und-blatt/engine';
import { cardRank, cardSuit } from '@brett-und-blatt/engine';
import { useSyncExternalStore } from 'react';

/*
 * Bildkarten: Bube, Dame und König des französischen Blatts sowie Unter, Ober und König des deutschen
 * Blatts mit gemalten Porträts
 * (KI-Bilder im Stil des Narrenhofs, siehe THIRD_PARTY.md). Die Wahl gilt je Gerät:
 * am Desktop standardmäßig an, auf dem Handy aus.
 */

const files = import.meta.glob<string>('./portraits/*.webp', { eager: true, query: '?url', import: 'default' });

const FRENCH_SUITS: Record<Suit, string> = { H: 'herz', D: 'karo', S: 'pik', C: 'kreuz' };
const FRENCH_RANKS: Record<number, string> = { 11: 'bube', 12: 'dame', 13: 'koenig' };
/** Deutsches und bayerisches Blatt: Schellen, Gras und Eichel stehen für Karo, Pik und Kreuz. */
const GERMAN_SUITS: Record<Suit, string> = { H: 'herz', D: 'schellen', S: 'gras', C: 'eichel' };
const GERMAN_RANKS: Record<number, string> = { 11: 'unter', 12: 'ober', 13: 'koenig' };

/** Porträt der Bildkarte (Bube/Dame/König bzw. Unter/Ober/König) oder undefined, wenn es keines gibt. */
export function portraitUrl(card: CardId, deckStyle: DeckStyle): string | undefined {
  const rank = cardRank(card);
  const suit = cardSuit(card);
  if (deckStyle === 'french' || deckStyle === 'four-color') {
    const name = FRENCH_RANKS[rank];
    return name && files[`./portraits/${name}-${FRENCH_SUITS[suit]}.webp`];
  }
  if (deckStyle === 'german' || deckStyle === 'bavarian') {
    const name = GERMAN_RANKS[rank];
    return name && files[`./portraits/de-${name}-${GERMAN_SUITS[suit]}.webp`];
  }
  return undefined;
}

const KEY = 'brett-und-blatt:bildkarten';
const listeners = new Set<() => void>();

function defaultOn(): boolean {
  try {
    return window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

function load(): boolean {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'an') return true;
    if (stored === 'aus') return false;
  } catch {
    // Ohne Speicher gilt die Voreinstellung.
  }
  return defaultOn();
}

let enabled = load();

export function setCardPortraits(next: boolean): void {
  enabled = next;
  try {
    window.localStorage.setItem(KEY, next ? 'an' : 'aus');
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ob Bildkarten auf diesem Gerät angezeigt werden. */
export const useCardPortraits = (): boolean => useSyncExternalStore(subscribe, () => enabled, () => false);
