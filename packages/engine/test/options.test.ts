import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../src';
import { nim } from './nim';

describe('resolveOptions', () => {
  const module = {
    ...nim,
    options: [
      { id: 'size', label: 'Größe', choices: [{ value: 's', label: 'klein' }, { value: 'l', label: 'groß' }], default: 's' },
      { id: 'code', label: 'Code', choices: [{ value: '', label: 'keiner' }], default: '', hidden: true, pattern: '[0-9a-f]{0,8}' },
    ],
  };

  it('nimmt Auswahlen und passende freie Werte, sonst den Standard', () => {
    expect(resolveOptions(module, { size: 'l', code: 'ab12' })).toEqual({ size: 'l', code: 'ab12' });
    expect(resolveOptions(module, { size: 'x', code: 'xyz' })).toEqual({ size: 's', code: '' });
    expect(resolveOptions(module, { code: 'ab12ab12ab' })).toEqual({ size: 's', code: '' });
  });
});
