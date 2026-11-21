import type { Shell } from './shellCore';

/** Routen, auf denen der einmalige Hinweis auf die neue Oberfläche erscheinen darf (nie mitten in einer Partie). */
const NOTICE_ROUTES = new Set(['menu', 'home', 'sound']);

/** Soll der einmalige Hinweis „Neue Oberfläche“ erscheinen? (#639) */
export function shouldShowShellNotice(input: { alreadySeen: boolean; shell: Shell; routeName: string }): boolean {
  return !input.alreadySeen && input.shell === 'console' && NOTICE_ROUTES.has(input.routeName);
}
