/**
 * Nachgebauter Controller für Browser-Proben (#608): ersetzt `navigator.getGamepads()` durch ein
 * Standard-Gamepad, dessen Tasten `pressPad` drückt. Tasten-Indizes (W3C „standard“):
 * A 0, B 1, X 2, Y 3, LB 4, RB 5, LT 6, RT 7, Select 8, Start 9, L3 10, R3 11,
 * hoch 12, runter 13, links 14, rechts 15.
 */

/** Vor dem ersten `goto` aufrufen: legt `window.__virtPad` an und meldet es beim Laden als verbunden. */
export async function installVirtualPad(page) {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = {
      id: 'Virtual Test Controller (STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      timestamp: 0,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons,
    };
    window.__virtPad = pad;
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => [pad, null, null, null],
      configurable: true,
    });
    window.addEventListener('load', () => {
      window.dispatchEvent(new CustomEvent('gamepadconnected', { detail: { gamepad: pad } }));
    });
  });
}

/** Drückt eine Taste `holdMs` lang und wartet danach `pauseMs`. */
export async function pressPad(page, index, holdMs = 90, pauseMs = 70) {
  await page.evaluate((idx) => {
    window.__virtPad.buttons[idx] = { pressed: true, touched: true, value: 1 };
  }, index);
  await page.waitForTimeout(holdMs);
  await page.evaluate((idx) => {
    window.__virtPad.buttons[idx] = { pressed: false, touched: false, value: 0 };
  }, index);
  await page.waitForTimeout(pauseMs);
}
