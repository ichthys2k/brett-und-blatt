import type { AnkiNote, CrestSpec } from '@brett-und-blatt/engine';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CardBackId } from './CardBack';

export interface CardCosmetics {
  cardBack: CardBackId;
  crest?: CrestSpec;
  customImageUrl?: string;
  ankiOverrides?: Record<string, AnkiNote>;
  mediaUrlMap?: Record<string, string>;
}

export const DEFAULT_CARD_COSMETICS: CardCosmetics = {
  cardBack: 'classic-red',
};

const CardCosmeticsContext = createContext<CardCosmetics>(DEFAULT_CARD_COSMETICS);

export interface CardCosmeticsProviderProps {
  children: ReactNode;
  value?: Partial<CardCosmetics>;
}

/**
 * Globaler Provider für Kartengestaltung (Kartenrücken, Spielerpass-Wappen, Bild-Assets, Anki-Overrides).
 * Wird von apps/web um die App gelegt, um Einstellungen aus dem Spielerpass einzuspeisen.
 */
export function CardCosmeticsProvider({ children, value }: CardCosmeticsProviderProps) {
  const merged = useMemo<CardCosmetics>(
    () => ({
      cardBack: value?.cardBack ?? DEFAULT_CARD_COSMETICS.cardBack,
      crest: value?.crest ?? DEFAULT_CARD_COSMETICS.crest,
      customImageUrl: value?.customImageUrl ?? DEFAULT_CARD_COSMETICS.customImageUrl,
      ankiOverrides: value?.ankiOverrides,
      mediaUrlMap: value?.mediaUrlMap,
    }),
    [value?.cardBack, value?.crest, value?.customImageUrl, value?.ankiOverrides, value?.mediaUrlMap],
  );

  return <CardCosmeticsContext.Provider value={merged}>{children}</CardCosmeticsContext.Provider>;
}

/**
 * Liest die aktuell gewählte Kartengestaltung aus dem Context.
 */
export function useCardCosmetics(): CardCosmetics {
  return useContext(CardCosmeticsContext);
}

/**
 * Holt ein Feld aus einer Anki-Notiz, unabhängig davon ob `fields` oder `flds` vorliegt.
 */
export function getNoteField(note: AnkiNote | undefined, idx: number): string | undefined {
  if (!note) return undefined;
  return (note.fields ?? (note as unknown as { flds?: string[] }).flds)?.[idx];
}

/**
 * Holt eine eventuelle Anki-Notiz-Übersteuerung für eine Karte anhand ihrer Kennung oder GUID.
 */
export function useCardOverride(idOrGuid: string): AnkiNote | undefined {
  const { ankiOverrides } = useCardCosmetics();
  if (!ankiOverrides) return undefined;
  return (
    ankiOverrides[idOrGuid] ??
    ankiOverrides[`bub-combat-${idOrGuid}`] ??
    ankiOverrides[`bub-court-${idOrGuid}`] ??
    ankiOverrides[`bub-quartett-${idOrGuid}`] ??
    ankiOverrides[`bub-role-${idOrGuid}`]
  );
}
