import { cleanEntry, MAX_ENTRY_LENGTH } from '@brett-und-blatt/engine';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';

export interface WordInputProps {
  /** Wird mit der bereinigten Eingabe aufgerufen (Enter oder Knopf). */
  onSubmit: (text: string) => void;
  /** Zusätzliche Prüfung vor dem Absenden: Fehlermeldung oder null. */
  check?: (text: string) => string | null;
  /** Wird bei jeder Änderung aufgerufen, z. B. um Entwürfe zu merken. */
  onChange?: (text: string) => void;
  label: string;
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
  /** Feld nach dem Absenden leeren (Standard) oder den Text stehen lassen. */
  clearOnSubmit?: boolean;
  /** Startwert, etwa eine schon abgegebene Antwort. */
  initial?: string;
  maxLength?: number;
  autoFocus?: boolean;
  /** Knopf ausblenden – dann nur mit Enter oder beim Verlassen des Felds (`submitOnBlur`). */
  hideButton?: boolean;
  submitOnBlur?: boolean;
  className?: string;
}

/**
 * Eingabefeld für Wortspiele: kurz (höchstens 30 Zeichen), ohne Rechtschreibhilfe und
 * Vorschläge des Browsers, mit derselben Bereinigung und demselben Filter wie die Regeln
 * (`cleanEntry`). Unpassendes wird gar nicht erst abgeschickt.
 */
export function WordInput({
  onSubmit,
  check,
  onChange,
  label,
  placeholder,
  submitLabel = 'OK',
  disabled = false,
  clearOnSubmit = true,
  initial = '',
  maxLength = MAX_ENTRY_LENGTH,
  autoFocus = false,
  hideButton = false,
  submitOnBlur = false,
  className = '',
}: WordInputProps) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(initial);
  }, [initial]);

  const submit = (fromBlur = false) => {
    if (disabled) return;
    if (fromBlur && text.trim() === initial.trim()) return;
    if (text.trim().length === 0) {
      if (!fromBlur) setError('Bitte etwas eingeben.');
      return;
    }
    const cleaned = cleanEntry(text, maxLength);
    if (!cleaned) {
      setError('Das geht so nicht – bitte ein anderes Wort.');
      return;
    }
    const problem = check?.(cleaned) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSubmit(cleaned);
    if (clearOnSubmit) setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={`bub-word ${className}`}>
      <div className="bub-word-row">
        <input
          id={id}
          className="bub-word-input"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder={placeholder}
          value={text}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
            onChange?.(event.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={submitOnBlur ? () => submit(true) : undefined}
        />
        {!hideButton && (
          <button type="button" className="bub-word-button" disabled={disabled} onClick={() => submit()}>
            {submitLabel}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="bub-word-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
