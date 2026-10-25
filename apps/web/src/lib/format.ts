import type { BotLevel, TimeControl } from '@brett-und-blatt/engine';
import { t } from '../i18n';

export function describeTime(control: TimeControl): string {
  switch (control.kind) {
    case 'none':
      return t('time.none');
    case 'perMove':
      return control.bankMs
        ? t('time.perMoveBank', { s: control.moveMs / 1000, bank: control.bankMs / 1000 })
        : t('time.perMove', { s: control.moveMs / 1000 });
    case 'chessClock':
      return t('time.chessClock', { min: control.baseMs / 60_000, inc: control.incrementMs / 1000 });
  }
}

export function levelLabel(level: BotLevel): string {
  return t(`level.${level}`);
}
