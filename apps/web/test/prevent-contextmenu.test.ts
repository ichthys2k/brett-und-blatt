import { describe, expect, it } from 'vitest';
import { allowsContextMenu, disableContextMenu } from '../src/lib/preventContextMenu';

/** Kleines Element-Double: `closest` findet nur Eingabefelder. */
const element = (tag: string) => ({ closest: (selector: string) => (selector.split(', ').some((s) => s === tag) ? {} : null) });

function fire(target: EventTarget, eventTarget: unknown): boolean {
  let prevented = false;
  const event = { target: eventTarget, preventDefault: () => (prevented = true) } as unknown as Event;
  (target as unknown as { fire: (e: Event) => void }).fire(event);
  return prevented;
}

function fakeTarget() {
  const listeners: ((e: Event) => void)[] = [];
  return {
    addEventListener: (_type: string, fn: (e: Event) => void) => listeners.push(fn),
    removeEventListener: (_type: string, fn: (e: Event) => void) => listeners.splice(listeners.indexOf(fn), 1),
    dispatchEvent: () => true,
    fire: (e: Event) => listeners.forEach((fn) => fn(e)),
  } as unknown as EventTarget;
}

describe('Kontextmenü abschalten', () => {
  it('unterdrückt das Menü auf dem Spielfeld, nicht in Eingabefeldern', () => {
    const target = fakeTarget();
    const stop = disableContextMenu(target);
    expect(fire(target, element('div'))).toBe(true);
    expect(fire(target, element('input'))).toBe(false);
    expect(fire(target, element('textarea'))).toBe(false);
    expect(fire(target, null)).toBe(true);
    stop();
    expect(fire(target, element('div'))).toBe(false);
  });

  it('erkennt erlaubte Ziele', () => {
    expect(allowsContextMenu(element('input') as unknown as EventTarget)).toBe(true);
    expect(allowsContextMenu(element('span') as unknown as EventTarget)).toBe(false);
    expect(allowsContextMenu(null)).toBe(false);
  });
});
