/**
 * Schaltet das Kontextmenü von Browser und System in der ganzen App ab (Rechtsklick, langes Drücken am Handy):
 * Es ging mitten im Spiel auf und störte (Cornelius, 15.11.2026). Die eigene Großansicht (#418, Rechtsklick
 * bzw. langes Drücken auf Karten) bleibt; sie reagiert vorher selbst auf das Ereignis.
 *
 * Ausnahme: Eingabefelder und bearbeitbare Bereiche (Kopieren, Einfügen, Rechtschreibung) sowie alles, was
 * `data-allow-contextmenu` trägt. Das CSS dazu (`-webkit-touch-callout`, keine Textauswahl am Spieltisch)
 * steht in `styles.css`.
 */
const ALLOWED = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-allow-contextmenu]';

export function allowsContextMenu(target: EventTarget | null): boolean {
  const el = target as Element | null;
  return typeof el?.closest === 'function' && el.closest(ALLOWED) !== null;
}

export function disableContextMenu(target: EventTarget = document): () => void {
  const onContextMenu = (event: Event): void => {
    if (!allowsContextMenu(event.target)) event.preventDefault();
  };
  target.addEventListener('contextmenu', onContextMenu);
  return () => target.removeEventListener('contextmenu', onContextMenu);
}
