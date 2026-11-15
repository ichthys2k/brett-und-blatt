import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardInspectProvider, InspectBody, useInspect, useInspectProps, type InspectContent } from '../src';

// Großansicht (#418): Inhalt und Verhalten ohne Provider.
const content: InspectContent = {
  title: 'Eule',
  subtitle: 'Vögel · selten',
  image: { src: 'eule.webp' },
  emoji: '🦉',
  stats: [
    { label: 'Kosten', value: '3', tone: 'cost' },
    { label: 'Angriff', value: '2', tone: 'attack', change: 'up' },
  ],
  lines: ['Fanfare: Wähle aus drei Kniffen.'],
  keywords: [{ emoji: '🌙', name: 'Verkleidet', text: 'Kann nicht als Ziel gewählt werden.' }],
  quote: 'Uhuuu!',
};

describe('InspectBody', () => {
  it('zeigt Bild, Titel, Werte, Regeltext, Schlüsselwörter und Spruch', () => {
    const html = renderToStaticMarkup(<InspectBody content={content} />);
    expect(html).toContain('src="eule.webp"');
    expect(html).toContain('bub-inspect-has-art');
    expect(html).toContain('Eule');
    expect(html).toContain('Vögel · selten');
    expect(html).toContain('aria-label="Kosten: 3"');
    expect(html).toContain('data-tone="attack"');
    expect(html).toContain('data-change="up"');
    expect(html).toContain('Fanfare: Wähle aus drei Kniffen.');
    expect(html).toContain('Verkleidet');
    expect(html).toContain('„Uhuuu!“');
    expect(html).not.toContain('Schließen');
  });

  it('nimmt ohne Bild das Emoji', () => {
    const html = renderToStaticMarkup(<InspectBody content={{ title: 'Hauskraft', emoji: '🌰' }} />);
    expect(html).toContain('🌰');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('bub-inspect-has-art');
  });

  it('zeigt im Fenster einen Knopf zum Schließen', () => {
    const html = renderToStaticMarkup(<InspectBody content={content} onClose={() => undefined} />);
    expect(html).toContain('Schließen');
  });
});

describe('useInspectProps', () => {
  function Probe({ withContent, onResult }: { withContent: boolean; onResult: (keys: string[]) => void }) {
    const props = useInspectProps(withContent ? content : undefined, { title: 'bleibt' });
    onResult(Object.keys(props).sort());
    return null;
  }

  it('gibt ohne Provider nur die eigenen Eigenschaften zurück', () => {
    let keys: string[] = [];
    renderToStaticMarkup(<Probe withContent onResult={(k) => (keys = k)} />);
    expect(keys).toEqual(['title']);
  });

  it('gibt ohne Inhalt nur die eigenen Eigenschaften zurück, auch mit Provider', () => {
    let keys: string[] = [];
    renderToStaticMarkup(
      <CardInspectProvider>
        <Probe withContent={false} onResult={(k) => (keys = k)} />
      </CardInspectProvider>,
    );
    expect(keys).toEqual(['title']);
  });

  it('hängt mit Provider die Auslöser an (Maus, Finger, Rechtsklick, Tastatur)', () => {
    let keys: string[] = [];
    renderToStaticMarkup(
      <CardInspectProvider>
        <Probe withContent onResult={(k) => (keys = k)} />
      </CardInspectProvider>,
    );
    expect(keys).toEqual(['onBlur', 'onContextMenu', 'onFocus', 'onKeyDown', 'onPointerDown', 'onPointerEnter', 'onPointerLeave', 'title']);
  });

  it('eigene Darstellung (body) ersetzt die Standardansicht, Schließen bleibt', () => {
    const html = renderToStaticMarkup(<InspectBody content={{ ...content, body: <div className="probe-karte">Karte</div> }} onClose={() => undefined} />);
    expect(html).toContain('bub-inspect-custom');
    expect(html).toContain('probe-karte');
    expect(html).not.toContain('bub-inspect-title');
    expect(html).toContain('Schließen');
  });

  it('useInspect ohne Provider tut nichts', () => {
    let ok = false;
    function Open() {
      const api = useInspect();
      api.open(content);
      api.close();
      ok = true;
      return null;
    }
    renderToStaticMarkup(<Open />);
    expect(ok).toBe(true);
  });
});
