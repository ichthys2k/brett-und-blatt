import type { ReactElement } from 'react';
import type { Route } from '../lib/router';

/** Konsolen-Bildschirm für eine Route oder `null`, wenn die klassische Seite gilt (#607). */
export function consoleScreen(_route: Route): ReactElement | null {
  return null;
}
