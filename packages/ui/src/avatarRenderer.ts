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
