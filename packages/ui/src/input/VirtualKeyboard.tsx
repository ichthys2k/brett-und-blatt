import { useEffect, useState } from 'react';
import { FocusZone } from './FocusZone';
import { useInputContext, useInputIntent } from './InputContext';

const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö', 'Ä'],
  ['Y', 'X', 'C', 'V', 'B', 'N', 'M', 'ß', '-', '⌫', '✓'],
];

/**
 * Controller-bedienbare Bildschirmtastatur (C7).
 * Öffnet sich automatisch, wenn im Gamepad-Modus ein Text-/Zahlenfeld bestätigt wird.
 */
export function VirtualKeyboard() {
  const ctx = useInputContext();
  const [targetInput, setTargetInput] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState('');

  // Wenn im Gamepad-Modus ein Input bestätigt wird, Bildschirmtastatur öffnen
  useInputIntent((intent, source) => {
    if (source !== 'gamepad') return false;
    if (targetInput) {
      if (intent === 'cancel') {
        const el = targetInput;
        setTargetInput(null);
        el.focus();
        return true;
      }
      return false;
    }
    const active = document.activeElement;
    if (
      intent === 'confirm' &&
      (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
      active.type !== 'checkbox' &&
      active.type !== 'radio' &&
      active.type !== 'range'
    ) {
      setPreview(active.value);
      setTargetInput(active);
      return true;
    }
    return false;
  }, 25);

  useEffect(() => {
    if (!targetInput) return;
    // Ersten Tastaturknopf fokussieren
    const first = document.querySelector<HTMLButtonElement>('.bub-vkb-key');
    first?.focus();
  }, [targetInput]);

  if (!targetInput || ctx?.inputSource !== 'gamepad') return null;

  const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, nextVal: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, nextVal);
    } else {
      el.value = nextVal;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setPreview(nextVal);
  };

  const pressKey = (k: string) => {
    if (!targetInput) return;
    if (k === '⌫') {
      setNativeValue(targetInput, targetInput.value.slice(0, -1));
      return;
    }
    if (k === '✓') {
      const el = targetInput;
      setTargetInput(null);
      el.focus();
      el.form?.requestSubmit();
      return;
    }
    if (k === '␣') {
      setNativeValue(targetInput, `${targetInput.value} `);
      return;
    }
    setNativeValue(targetInput, `${targetInput.value}${k}`);
  };

  return (
    <div className="bub-vkb-backdrop" role="dialog" aria-label="Bildschirmtastatur">
      <FocusZone id="bub-vkb" order={999} trap label="Bildschirmtastatur" className="bub-vkb-panel">
        <div className="bub-vkb-preview" aria-live="polite">
          {preview || <span className="bub-vkb-placeholder">Eingabe…</span>}
        </div>
        <div className="bub-vkb-grid">
          {ROWS.map((row, rIdx) => (
            <div key={rIdx} className="bub-vkb-row">
              {row.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`bub-vkb-key ${key === '✓' ? 'bub-vkb-confirm' : ''}`}
                  onClick={() => pressKey(key)}
                  aria-label={key === '⌫' ? 'Löschen' : key === '✓' ? 'Übernehmen' : key}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
          <div className="bub-vkb-row">
            <button type="button" className="bub-vkb-key bub-vkb-space" onClick={() => pressKey('␣')}>
              Leerzeichen
            </button>
            <button
              type="button"
              className="bub-vkb-key"
              onClick={() => {
                const el = targetInput;
                setTargetInput(null);
                el.focus();
              }}
            >
              Schließen (B)
            </button>
          </div>
        </div>
      </FocusZone>
    </div>
  );
}
