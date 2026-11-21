import { resolveShell, type Shell } from './shellCore';

/** Routen, auf denen der einmalige Hinweis auf die Konsole erscheinen darf (nie mitten in einer Partie, #624). */
const OFFER_ROUTES = new Set(['menu', 'home', 'setup', 'sound']);

/** Soll der einmalige Hinweis auf die Konsolen-Oberfläche erscheinen? (#607, K10) */
export function shouldOfferConsole(input: {
  chosen: Shell;
  param: Shell | null;
  alreadyAsked: boolean;
  source: 'pointer' | 'keyboard' | 'gamepad';
  width: number;
  height: number;
  routeName: string;
}): boolean {
  return (
    input.chosen === 'classic' &&
    input.param === null &&
    !input.alreadyAsked &&
    input.source === 'gamepad' &&
    resolveShell({ chosen: 'console', param: null, width: input.width, height: input.height }) === 'console' &&
    OFFER_ROUTES.has(input.routeName)
  );
}
