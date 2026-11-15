import type { ReactNode } from 'react';

/**
 * Wie ein Avatar gezeichnet wird: Standard ist der Text (Emoji). Die Web-App meldet hier ihre Darstellung mit
 * gemaltem Bild an (#312), damit der gemeinsame Spielerchip sie nutzt, ohne die Bilder zu kennen.
 */
let renderer: ((avatar: string) => ReactNode) | null = null;

export function setAvatarRenderer(next: ((avatar: string) => ReactNode) | null): void {
  renderer = next;
}

export function renderAvatar(avatar: string): ReactNode {
  return renderer ? renderer(avatar) : avatar;
}

/**
 * Bild zu einem Avatar für die Großansicht des Spielerchips (#422). Die Web-App meldet hier ihre gemalten
 * Avatare an; ohne Bild bleibt der Chip ohne Großansicht.
 */
let imageResolver: ((avatar: string) => string | undefined) | null = null;

export function setAvatarImageResolver(next: ((avatar: string) => string | undefined) | null): void {
  imageResolver = next;
}

export function avatarImageOf(avatar: string): string | undefined {
  return imageResolver ? imageResolver(avatar) : undefined;
}
