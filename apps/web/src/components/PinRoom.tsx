import { SEEK_MOODS, SEEK_SEATS, type SeekMood, type SeekSeats } from '@brett-und-blatt/online';
import { useState } from 'react';
import { postRoomNote } from '../lib/board';
import { storage } from '../lib/storage';
import { Button, Segmented } from './controls';

const MOODS: Record<SeekMood, string> = { relaxed: '😌 Locker', serious: '🎯 Ernst', kids: '🧒 Mit Kindern', learning: '📚 Lernen' };
const SEATS: Record<SeekSeats, string> = { any: 'egal', '2': 'zu zweit', '3-4': '3 bis 4', '5+': '5 oder mehr' };

const ERRORS: Record<string, string> = {
  room: 'Die Runde steht gerade nicht in „Offene Runden“ – sie muss öffentlich sein und freie Plätze haben.',
  rate: 'Bitte einen Moment warten und noch einmal versuchen.',
  name: 'Dein Name passt nicht – bitte ändere ihn in deinem Profil.',
  offline: 'Das Schwarze Brett antwortet gerade nicht.',
};

/**
 * Die eigene offene Runde als Zettel „Mitspieler gesucht“ ans Schwarze Brett hängen (#65, Konzept Punkt 5). Nur die
 * Raumleitung einer öffentlichen Runde sieht es; der Zettel fällt vom Brett, sobald die Runde nicht mehr offen ist.
 */
export function PinRoom({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<SeekMood>('relaxed');
  const [seats, setSeats] = useState<SeekSeats>('any');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle');
  const profile = storage.loadProfile();

  if (state === 'done') return <p className="border-t border-line pt-2 text-sm">📌 Deine Runde hängt am Schwarzen Brett – 30 Minuten oder bis sie voll ist.</p>;
  if (!open) {
    return (
      <div className="border-t border-line pt-2">
        <Button variant="secondary" className="min-h-10 text-sm" onClick={() => setOpen(true)}>
          📌 Ans Schwarze Brett hängen
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t border-line pt-2">
      <p className="text-sm font-semibold">Mitspieler gesucht – ans Schwarze Brett</p>
      <Segmented<SeekSeats> label="Wie viele?" value={seats} choices={SEEK_SEATS.map((value) => ({ value, label: SEATS[value] }))} onChange={setSeats} />
      <Segmented<SeekMood> label="Stimmung" value={mood} choices={SEEK_MOODS.map((value) => ({ value, label: MOODS[value] }))} onChange={setMood} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={state === 'busy'}
          onClick={async () => {
            setState('busy');
            const result = await postRoomNote({ name: profile?.name ?? 'Gast', avatar: profile?.avatar ?? '🦊', code, seats, mood });
            setState(result === 'ok' ? 'done' : result);
          }}
        >
          📌 Anheften
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
      {state !== 'idle' && state !== 'busy' && <p role="alert" className="text-sm text-danger">{ERRORS[state] ?? 'Das hat nicht geklappt.'}</p>}
    </div>
  );
}
