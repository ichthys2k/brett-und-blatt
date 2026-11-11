import type { CrestSpec } from '@brett-und-blatt/engine';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CardBackId } from './CardBack';

export interface CardCosmetics {
  cardBack: CardBackId;
  crest?: CrestSpec;
  customImageUrl?: string;
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
 * Globaler Provider für Kartengestaltung (Kartenrücken, Spielerpass-Wappen, Bild-Assets).
 * Wird von apps/web um die App gelegt, um Einstellungen aus dem Spielerpass einzuspeisen.
 */
export function CardCosmeticsProvider({ children, value }: CardCosmeticsProviderProps) {
  const merged = useMemo<CardCosmetics>(
    () => ({
      cardBack: value?.cardBack ?? DEFAULT_CARD_COSMETICS.cardBack,
      crest: value?.crest ?? DEFAULT_CARD_COSMETICS.crest,
      customImageUrl: value?.customImageUrl ?? DEFAULT_CARD_COSMETICS.customImageUrl,
    }),
    [value?.cardBack, value?.crest, value?.customImageUrl],
  );

  return <CardCosmeticsContext.Provider value={merged}>{children}</CardCosmeticsContext.Provider>;
}

/**
 * Liest die aktuell gewählte Kartengestaltung aus dem Context.
 */
export function useCardCosmetics(): CardCosmetics {
  return useContext(CardCosmeticsContext);
}
