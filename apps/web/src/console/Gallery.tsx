import {
  KnsActionRow,
  KnsBanner,
  KnsButton,
  KnsChoiceRow,
  KnsCode,
  KnsDialog,
  KnsEmpty,
  KnsField,
  KnsGrid,
  KnsInfoRow,
  KnsLinkRow,
  KnsList,
  KnsListItem,
  KnsPage,
  KnsSection,
  KnsShelf,
  KnsSliderRow,
  KnsSplit,
  KnsStepperRow,
  KnsSubTabs,
  KnsTextRow,
  KnsTile,
  KnsToggleRow,
} from '@brett-und-blatt/ui';
import { useState } from 'react';
import { paths } from '../lib/router';
import { ConsoleFrame } from './ConsoleFrame';

/*
 * Schauseite der Konsolen-Bausteine (#636, U1): jeder Baustein in seinen Zuständen, nur mit Beispielwerten und
 * ohne Speicher. Erreichbar über /?modus=konsole#/bausteine; in keinem Menü verlinkt. Die Texte sind Beispiele
 * und stehen deshalb nicht in i18n.ts.
 */

const CATEGORIES = [
  { id: 'knoepfe', label: 'Knöpfe', icon: '🔘' },
  { id: 'zeilen', label: 'Zeilen', icon: '☰' },
  { id: 'listen', label: 'Listen', icon: '📋' },
  { id: 'kacheln', label: 'Kacheln', icon: '🧩' },
  { id: 'meldungen', label: 'Meldungen', icon: '💬' },
  { id: 'formular', label: 'Formular', icon: '✏️' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

const SUBTABS = [
  { id: 'eins', label: 'Spielen', href: paths.gallery },
  { id: 'zwei', label: 'Schwarzes Brett', href: paths.gallery },
  { id: 'drei', label: 'Turniere', href: paths.gallery },
  { id: 'vier', label: 'Klassen', href: paths.gallery },
  { id: 'fuenf', label: 'Vereine', href: paths.gallery },
];

function Buttons() {
  const [dialog, setDialog] = useState<'s' | 'm' | 'l' | null>(null);
  return (
    <>
      <KnsSection title="KnsButton" hint="Genau eine Hauptaktion je Ansicht; Gefährliches fragt nach.">
        <div className="flex flex-wrap gap-3 p-4">
          <KnsButton variant="primary">Spielen</KnsButton>
          <KnsButton>Einladen</KnsButton>
          <KnsButton variant="danger">Löschen</KnsButton>
          <KnsButton variant="quiet">Später</KnsButton>
          <KnsButton variant="primary" size="l">
            Groß
          </KnsButton>
          <KnsButton disabled>Gesperrt</KnsButton>
        </div>
      </KnsSection>
      <KnsSection title="KnsDialog">
        <KnsActionRow label="Kleines Fenster" hint="50 u breit" action="Öffnen" onAction={() => setDialog('s')} />
        <KnsActionRow label="Mittleres Fenster" hint="80 u breit" action="Öffnen" onAction={() => setDialog('m')} />
        <KnsActionRow label="Großes Fenster" hint="110 u breit" action="Öffnen" onAction={() => setDialog('l')} />
      </KnsSection>
      <KnsSection title="KnsCode">
        <div className="p-4">
          <KnsCode value="🦊🍀🎲🌙" label="Raumcode" />
        </div>
      </KnsSection>
      {dialog && (
        <KnsDialog
          title="Klasse auflösen?"
          size={dialog}
          onClose={() => setDialog(null)}
          actions={
            <>
              <KnsButton data-bub-autofocus onClick={() => setDialog(null)}>
                Abbrechen
              </KnsButton>
              <KnsButton variant="danger" onClick={() => setDialog(null)}>
                Auflösen
              </KnsButton>
            </>
          }
        >
          <p>Alle Mitglieder verlieren den Zugang. Das lässt sich nicht rückgängig machen.</p>
        </KnsDialog>
      )}
    </>
  );
}

function Rows() {
  const [toggle, setToggle] = useState(true);
  const [volume, setVolume] = useState(70);
  const [look, setLook] = useState('tavern');
  const [back, setBack] = useState('rot');
  const [name, setName] = useState('Cornelius');
  const [seats, setSeats] = useState(4);
  return (
    <>
      <KnsSection title="Schalter und Regler">
        <KnsToggleRow label="Musik" hint="Spielt Stücke passend zum Spiel." checked={toggle} onChange={setToggle} />
        <KnsToggleRow label="Gesperrt" checked={false} onChange={() => undefined} disabled />
        <KnsSliderRow label="Lautstärke Musik" value={volume} min={0} max={100} step={5} onChange={setVolume} format={(v) => `${v} %`} />
      </KnsSection>
      <KnsSection title="Auswahl">
        <KnsChoiceRow
          label="Aussehen"
          hint="Bis vier Möglichkeiten: Knopfleiste"
          value={look}
          onChange={setLook}
          choices={[
            { value: 'tavern', label: 'Taverne' },
            { value: 'plain', label: 'Schlicht' },
          ]}
        />
        <KnsChoiceRow
          label="Kartenrücken"
          hint="Mehr als vier: Fenster"
          value={back}
          onChange={setBack}
          choices={['rot', 'blau', 'grün', 'gold', 'schwarz', 'Wappen'].map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))}
        />
        <KnsStepperRow label="Plätze" value={seats} min={2} max={6} onChange={setSeats} />
      </KnsSection>
      <KnsSection title="Text, Verweise und Anzeige">
        <KnsTextRow label="Name" value={name} onChange={setName} maxLength={24} />
        <KnsLinkRow label="Impressum" href={paths.imprint} />
        <KnsLinkRow label="Pass" href={paths.pass} value="Cornelius" />
        <KnsLinkRow label="Quellcode" href="https://github.com/ichthys2k/brett-und-blatt" external />
        <KnsInfoRow label="Version" value="2026.11.21" />
        <KnsActionRow label="App zurücksetzen" hint="Löscht alle Einstellungen auf diesem Gerät." action="Zurücksetzen" variant="danger" onAction={() => undefined} />
      </KnsSection>
    </>
  );
}

function Lists() {
  const [hidden, setHidden] = useState<string[]>([]);
  const rooms = [
    { id: 'a', emoji: '🃏', title: 'Skat', meta: 'Anna · 1 Platz frei' },
    { id: 'b', emoji: '♟️', title: 'Schach', meta: 'Ben · 1 Platz frei' },
    { id: 'c', emoji: '🎲', title: 'Kniffel', meta: 'Clara · 3 Plätze frei' },
  ].filter((room) => !hidden.includes(room.id));
  return (
    <>
      <KnsSection title="KnsList" hint="Ganze Zeile = Hauptaktion (A), rechts höchstens zwei Nebenknöpfe.">
        <div className="p-3">
          {rooms.length > 0 ? (
            <KnsList>
              {rooms.map((room) => (
                <KnsListItem
                  key={room.id}
                  leading={room.emoji}
                  title={room.title}
                  meta={room.meta}
                  trailing="offen"
                  onActivate={() => undefined}
                  actions={
                    <KnsButton variant="quiet" aria-label={`${room.title} ausblenden`} onClick={() => setHidden((list) => [...list, room.id])}>
                      Ausblenden
                    </KnsButton>
                  }
                />
              ))}
              <KnsListItem leading="🔒" title="Nur Anzeige" meta="ohne Aktion" />
            </KnsList>
          ) : (
            <KnsEmpty icon="🌙" title="Gerade keine offenen Runden" text="Eröffne selbst einen Raum." action={<KnsButton onClick={() => setHidden([])}>Wieder zeigen</KnsButton>} />
          )}
        </div>
      </KnsSection>
      <KnsSection title="KnsSubTabs">
        <div className="p-3">
          <KnsSubTabs tabs={SUBTABS} current="eins" />
        </div>
      </KnsSection>
    </>
  );
}

function Tiles() {
  return (
    <>
      <KnsShelf title="KnsShelf" subtitle="Waagrecht rollende Reihe">
        {['🃏', '♟️', '🎲', '🧩', '🀄', '🎯'].map((art, index) => (
          <li key={art}>
            <KnsTile onActivate={() => undefined} art={art} title={`Spiel ${index + 1}`} meta="2–4 Spieler" badge={index % 2 ? '🎮' : '🎮↔'} mark={index === 0 ? '★' : undefined} />
          </li>
        ))}
      </KnsShelf>
      <KnsSection title="KnsGrid">
        <KnsGrid>
          <li>
            <KnsTile href={paths.gallery} art="🌐" title="Online" meta="Mit anderen spielen" variant="link" />
          </li>
          <li>
            <KnsTile href={paths.gallery} art="📚" title="Lernen" meta="Karteikasten und Lernpakete für die Schule" variant="link" />
          </li>
          <li>
            <KnsTile href={paths.gallery} art="🎲" title="Helfer" meta="Würfel, Uhr und Punkte" variant="link" />
          </li>
        </KnsGrid>
      </KnsSection>
    </>
  );
}

function Notices() {
  const [floating, setFloating] = useState(false);
  return (
    <>
      <div className="flex flex-col gap-3">
        <KnsBanner title="Hinweis">Die Konsole ist jetzt Standard.</KnsBanner>
        <KnsBanner tone="success" title="Neuer Stempel" action={<KnsButton>Ansehen</KnsButton>} onClose={() => undefined}>
          Du hast „Erste Partie“ bekommen.
        </KnsBanner>
        <KnsBanner tone="warning">Die Verbindung ist langsam.</KnsBanner>
        <KnsBanner tone="danger" title="Das hat nicht geklappt" action={<KnsButton>Nochmal</KnsButton>}>
          Prüfe die Verbindung.
        </KnsBanner>
        <div>
          <KnsButton onClick={() => setFloating(true)}>Schwebende Meldung zeigen</KnsButton>
        </div>
      </div>
      <KnsSection title="KnsEmpty">
        <KnsEmpty icon="📭" title="Noch nichts da" text="Hier erscheinen deine Aushänge." action={<KnsButton variant="primary">Aushang schreiben</KnsButton>} />
      </KnsSection>
      {floating && (
        <KnsBanner floating title="Neue Oberfläche" action={<KnsButton onClick={() => setFloating(false)}>Verstanden</KnsButton>} onClose={() => setFloating(false)}>
          Die frühere findest du unter Optionen → Oberfläche.
        </KnsBanner>
      )}
    </>
  );
}

function Form() {
  const [title, setTitle] = useState('');
  return (
    <KnsSection title="KnsField">
      <div className="p-4">
        <KnsField label="Name des Turniers" hint="Höchstens 40 Zeichen." error={title.length > 40 ? 'Der Name ist zu lang.' : undefined}>
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
        </KnsField>
        <KnsField label="Spiel">
          <select defaultValue="skat">
            <option value="skat">Skat</option>
            <option value="schach">Schach</option>
          </select>
        </KnsField>
      </div>
    </KnsSection>
  );
}

/** Schauseite der Bausteine in der Konsolen-Oberfläche. */
export function Gallery() {
  const [category, setCategory] = useState<CategoryId>('knoepfe');
  return (
    <ConsoleFrame tab={null}>
      <KnsPage title="Bausteine" subtitle="Schauseite der Konsolen-Oberfläche (#636)" actions={<KnsButton variant="primary">Hauptaktion</KnsButton>}>
        <KnsSplit nav={CATEGORIES} current={category} onSelect={(id) => setCategory(id as CategoryId)}>
          {category === 'knoepfe' && <Buttons />}
          {category === 'zeilen' && <Rows />}
          {category === 'listen' && <Lists />}
          {category === 'kacheln' && <Tiles />}
          {category === 'meldungen' && <Notices />}
          {category === 'formular' && <Form />}
        </KnsSplit>
      </KnsPage>
    </ConsoleFrame>
  );
}

/** In der klassischen Oberfläche zeigt die Schauseite nur einen Hinweis. */
export function GalleryClassicNote() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Bausteine</h1>
      <p>
        Nur in der Konsolen-Oberfläche: <a href="?modus=konsole#/bausteine">?modus=konsole</a>
      </p>
    </main>
  );
}
