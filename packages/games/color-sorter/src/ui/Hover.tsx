import { CardInspectProvider, useInspectProps, type InspectContent, type InspectExtraProps } from '@brett-und-blatt/ui';
import type { ReactNode } from 'react';

/** Inhalt der Großansicht einer Karte oder Kachel (#422, früher eine reine Text-Sprechblase). */
export interface Tip {
  emoji?: string;
  title: string;
  lines: string[];
  /** Porträt oder Medaillon; ohne Bild bleibt das Emoji. */
  image?: string;
  /** Medaillon (rund, quadratisch) statt Porträt (4:5). */
  round?: boolean;
}

/** Aus einem Beschreibungstext (Teile durch „ · “ getrennt) werden einzelne Zeilen. */
export function tipFrom(d: { emoji?: string; title: string; text: string }, extra: string[] = []): Tip {
  return { emoji: d.emoji, title: d.title, lines: [...d.text.split(' · ').filter(Boolean), ...extra] };
}

/** Großansicht aus dem Baukasten (`CardInspect`, #418): Bild, Titel und Zeilen. */
export function tipContent(tip: Tip): InspectContent {
  return {
    title: tip.title,
    emoji: tip.emoji,
    lines: tip.lines,
    image: tip.image ? { src: tip.image, aspect: tip.round ? 1 : 4 / 5, round: tip.round } : undefined,
  };
}

/** Eine Großansicht für das ganze Brett (die Web-App legt schon eine um die Spielseite; diese gilt auch im Tisch-Bildschirm). */
export function HoverProvider({ children }: { children: ReactNode }) {
  return <CardInspectProvider>{children}</CardInspectProvider>;
}

export type ExtraProps = InspectExtraProps;

/**
 * Eigenschaften, die ein Element für die Großansicht braucht, verbunden mit weiteren (z. B. Ziehen).
 * Maus: schwebt beim Überfahren, Rechtsklick öffnet das Fenster; Finger: lange drücken (ohne zu ziehen).
 */
export function useTipProps(tip: Tip | undefined, extra: ExtraProps = {}): ExtraProps {
  return useInspectProps(tip ? () => tipContent(tip) : undefined, extra);
}
