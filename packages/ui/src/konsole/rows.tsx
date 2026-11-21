import { useId, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { KnsButton, type KnsButtonVariant } from './KnsButton';
import { KnsDialog } from './KnsDialog';
import { choiceRowMode, stepperValue } from './logic';

/*
 * Zeilen der Konsole (#636): Beschriftung links, Bedienelement rechts. Die ganze Zeile trägt den Fokus, wo sie
 * selbst das Bedienelement ist (Schalter, Verweis, Auswahl im Fenster).
 */

interface RowBase {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
}

function RowText({ label, hint, labelId, htmlFor }: { label: ReactNode; hint?: ReactNode; labelId?: string; htmlFor?: string }) {
  return (
    <span className="kns-row-text">
      {htmlFor ? (
        <label id={labelId} className="kns-row-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span id={labelId} className="kns-row-label">
          {label}
        </span>
      )}
      {hint && <span className="kns-row-hint">{hint}</span>}
    </span>
  );
}

const cls = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

export interface KnsToggleRowProps extends RowBase {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Schalter-Zeile: die ganze Zeile ist ein `<button role="switch">`. */
export function KnsToggleRow({ label, hint, checked, onChange, disabled, className }: KnsToggleRowProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} className={cls('kns-row kns-row-button', className)} onClick={() => onChange(!checked)}>
      <RowText label={label} hint={hint} />
      <span className="kns-row-control">
        <span className="kns-switch" data-on={checked ? '' : undefined} aria-hidden="true">
          <span className="kns-switch-knob" />
        </span>
      </span>
    </button>
  );
}

export interface KnsSliderRowProps extends RowBase {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}

/** Regler-Zeile: `<input type="range">` (Links/Rechts verstellt, auch mit dem Controller), Wert rechts. */
export function KnsSliderRow({ label, hint, value, min, max, step = 1, onChange, format = String, disabled, className }: KnsSliderRowProps) {
  const id = useId();
  return (
    <div className={cls('kns-row kns-row-wide', className)}>
      <RowText label={label} hint={hint} htmlFor={id} />
      <span className="kns-row-control">
        <input
          id={id}
          type="range"
          className="kns-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={format(value)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output className="kns-row-value" htmlFor={id}>
          {format(value)}
        </output>
      </span>
    </div>
  );
}

export interface KnsChoice<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

export interface KnsChoiceRowProps<T extends string> extends RowBase {
  value: T;
  choices: readonly KnsChoice<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Erzwingt Knopfleiste oder Fenster; sonst nach Anzahl (`choiceRowMode`). */
  mode?: 'inline' | 'dialog';
}

/** Auswahl-Zeile: bis vier Möglichkeiten als Knopfleiste, sonst Wert in der Zeile und Liste im Fenster. */
export function KnsChoiceRow<T extends string>({ label, hint, value, choices, onChange, disabled, mode, className }: KnsChoiceRowProps<T>) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = choices.find((choice) => choice.value === value);

  if ((mode ?? choiceRowMode(choices.length)) === 'inline') {
    return (
      <div className={cls('kns-row kns-row-wide', className)} role="group" aria-labelledby={labelId}>
        <RowText label={label} hint={hint} labelId={labelId} />
        <span className="kns-row-control kns-seg-group">
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className="kns-seg"
              aria-pressed={choice.value === value}
              disabled={disabled || choice.disabled}
              onClick={() => onChange(choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </span>
      </div>
    );
  }

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  return (
    <>
      <button ref={triggerRef} type="button" className={cls('kns-row kns-row-button', className)} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
        <RowText label={label} hint={hint} labelId={labelId} />
        <span className="kns-row-control">
          <span className="kns-row-value">{current?.label}</span>
          <span className="kns-row-chevron" aria-hidden="true">
            ›
          </span>
        </span>
      </button>
      {open && (
        <KnsDialog title={label} onClose={close} size="s">
          <div className="kns-choice-list" role="radiogroup" aria-label={typeof label === 'string' ? label : undefined}>
            {choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={choice.value === value}
                className="kns-choice"
                disabled={choice.disabled}
                data-bub-autofocus={choice.value === value ? '' : undefined}
                onClick={() => {
                  onChange(choice.value);
                  close();
                }}
              >
                <span className="kns-choice-mark" aria-hidden="true">
                  {choice.value === value ? '●' : '○'}
                </span>
                <span className="kns-row-text">
                  <span className="kns-row-label">{choice.label}</span>
                  {choice.hint && <span className="kns-row-hint">{choice.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        </KnsDialog>
      )}
    </>
  );
}

export interface KnsActionRowProps extends RowBase {
  /** Text des Knopfs. */
  action: ReactNode;
  onAction: () => void;
  variant?: KnsButtonVariant;
  disabled?: boolean;
}

/** Zeile mit Knopf rechts (z. B. „Nach Update suchen“). */
export function KnsActionRow({ label, hint, action, onAction, variant = 'secondary', disabled, className }: KnsActionRowProps) {
  return (
    <div className={cls('kns-row', className)}>
      <RowText label={label} hint={hint} />
      <span className="kns-row-control">
        <KnsButton variant={variant} disabled={disabled} onClick={onAction}>
          {action}
        </KnsButton>
      </span>
    </div>
  );
}

export interface KnsLinkRowProps extends RowBase, Omit<HTMLAttributes<HTMLAnchorElement>, 'className'> {
  href: string;
  value?: ReactNode;
  /** Öffnet in einem neuen Tab (äußere Seiten). */
  external?: boolean;
}

/** Verweis-Zeile: die ganze Zeile ist ein Link, „›“ rechts. */
export function KnsLinkRow({ label, hint, href, value, external, className, ...rest }: KnsLinkRowProps) {
  return (
    <a href={href} className={cls('kns-row kns-row-button', className)} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...rest}>
      <RowText label={label} hint={hint} />
      <span className="kns-row-control">
        {value !== undefined && <span className="kns-row-value">{value}</span>}
        <span className="kns-row-chevron" aria-hidden="true">
          {external ? '↗' : '›'}
        </span>
      </span>
    </a>
  );
}

export interface KnsInfoRowProps extends RowBase {
  value: ReactNode;
}

/** Nur Anzeige, nicht fokussierbar. */
export function KnsInfoRow({ label, hint, value, className }: KnsInfoRowProps) {
  return (
    <div className={cls('kns-row', className)}>
      <RowText label={label} hint={hint} />
      <span className="kns-row-control">
        <span className="kns-row-value">{value}</span>
      </span>
    </div>
  );
}

export interface KnsTextRowProps extends RowBase {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: 'text' | 'search' | 'number' | 'email' | 'url' | 'password' | 'tel';
  disabled?: boolean;
  autoComplete?: string;
}

/** Eingabe-Zeile: echtes `<input>`; mit dem Controller öffnet A die Bildschirmtastatur. */
export function KnsTextRow({ label, hint, value, onChange, placeholder, maxLength, type = 'text', disabled, autoComplete, className }: KnsTextRowProps) {
  const id = useId();
  return (
    <div className={cls('kns-row kns-row-wide', className)}>
      <RowText label={label} hint={hint} htmlFor={id} />
      <span className="kns-row-control">
        <input
          id={id}
          type={type}
          className="kns-input"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </div>
  );
}

export interface KnsStepperRowProps extends RowBase {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}

/** Zähler-Zeile: − Wert +. */
export function KnsStepperRow({ label, hint, value, min, max, step = 1, onChange, format = String, disabled, className }: KnsStepperRowProps) {
  const labelId = useId();
  return (
    <div className={cls('kns-row', className)} role="group" aria-labelledby={labelId}>
      <RowText label={label} hint={hint} labelId={labelId} />
      <span className="kns-row-control kns-stepper">
        <button type="button" className="kns-seg" aria-label="Weniger" disabled={disabled || value <= min} onClick={() => onChange(stepperValue(value, min, max, -step))}>
          −
        </button>
        <output className="kns-row-value kns-stepper-value" aria-live="polite">
          {format(value)}
        </output>
        <button type="button" className="kns-seg" aria-label="Mehr" disabled={disabled || value >= max} onClick={() => onChange(stepperValue(value, min, max, step))}>
          +
        </button>
      </span>
    </div>
  );
}
