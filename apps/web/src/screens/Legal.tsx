import type { ReactNode } from 'react';
import { Button } from '../components/controls';
import { t } from '../i18n';
import { navigate, paths } from '../lib/router';

/**
 * Die vollständigen Anbieterangaben stehen an einer Stelle – im Impressum auf
 * lipponer.de. So stehen Anschrift und Telefonnummer nicht im öffentlichen
 * Quellcode, und Ableger dieses Projekts übernehmen sie nicht versehentlich.
 */
const IMPRESSUM_URL = 'https://lipponer.de/blog/impressum/';
const SOURCE_URL = 'https://github.com/ichthys2k/brett-und-blatt';
const GITHUB_PRIVACY_URL = 'https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement';
const CLOUDFLARE_PRIVACY_URL = 'https://www.cloudflare.com/de-de/privacypolicy/';

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="font-medium text-accent underline" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <header className="mb-4 flex items-center gap-2">
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.home)}>
          ←
        </Button>
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>
      <div className="space-y-4 leading-relaxed [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </div>
  );
}

export function Impressum() {
  return (
    <LegalPage title={t('legal.imprint')}>
      <p>Brett &amp; Blatt ist ein privates, nicht-kommerzielles Open-Source-Projekt von Cornelius Lipponer aus Reutlingen.</p>
      <p>
        Die Anbieterkennzeichnung nach § 5 DDG und die Angaben nach § 18 Abs. 2 MStV stehen im Impressum auf lipponer.de:{' '}
        <ExternalLink href={IMPRESSUM_URL}>Zum vollständigen Impressum</ExternalLink>
      </p>
      <h2>Quellcode und Lizenzen</h2>
      <p>
        Der Quellcode ist öffentlich: <ExternalLink href={SOURCE_URL}>github.com/ichthys2k/brett-und-blatt</ExternalLink>. Er steht unter der GNU Affero
        General Public License 3.0, Grafiken, Sounds und andere Inhalte stehen unter der Lizenz CC BY-SA 4.0, soweit nicht anders angegeben.
      </p>
      <h2>Hinweise und Fehler</h2>
      <p>Fehler und Ideen kannst du als „Issue“ auf GitHub melden oder per E-Mail schicken (Adresse siehe Impressum).</p>
      <p>
        <a className="font-medium text-accent underline" href={paths.privacy}>
          {t('legal.privacy')}
        </a>
      </p>
    </LegalPage>
  );
}

export function Datenschutz() {
  return (
    <LegalPage title={t('legal.privacy')}>
      <p className="rounded-xl border border-line bg-surface p-4">
        <strong>Kurz gesagt:</strong> Brett &amp; Blatt braucht kein Konto, setzt keine Cookies, verwendet keine Tracker, zeigt keine Werbung und bindet
        keine fremden Dienste ein. Deine Spielstände und Einstellungen bleiben auf deinem Gerät. Nur wenn du online spielst, gehen Spitzname, Emoji-Bild
        und Spielzüge an den Spieleserver bei Cloudflare in der EU; ein Raum wird spätestens 24 Stunden nach der letzten Aktivität gelöscht.
      </p>

      <h2>Verantwortlich</h2>
      <p>
        Cornelius Lipponer, Reutlingen. Die vollständigen Kontaktdaten stehen im <ExternalLink href={IMPRESSUM_URL}>Impressum</ExternalLink>.
      </p>

      <h2>Bereitstellung der Seite durch GitHub Pages</h2>
      <p>
        Die Seite wird über GitHub Pages ausgeliefert. Anbieter ist GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Beim Aufruf
        verarbeitet GitHub technisch notwendige Daten, insbesondere deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Datei und Angaben zu Browser und
        Betriebssystem. Das dient der Auslieferung der Seite und der Sicherheit des Dienstes. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; das
        berechtigte Interesse liegt in einer sicheren und zuverlässigen Bereitstellung.
      </p>
      <p>
        Dabei können Daten in die USA übermittelt werden. GitHub ist nach dem EU-US Data Privacy Framework zertifiziert. Wie lange GitHub diese Daten
        speichert, bestimmt GitHub; Näheres steht in der <ExternalLink href={GITHUB_PRIVACY_URL}>Datenschutzerklärung von GitHub</ExternalLink>. Ich selbst
        erhalte keine Zugriffsprotokolle und keine IP-Adressen.
      </p>

      <h2>Online-Partien über Cloudflare</h2>
      <p>
        Wer online spielt, verbindet sich mit dem Spieleserver von Brett &amp; Blatt. Er läuft bei Cloudflare, Inc., 101 Townsend St., San Francisco,
        CA 94107, USA. Ohne Online-Partie wird keine Verbindung zu Cloudflare aufgebaut.
      </p>
      <p>Für einen Raum verarbeitet der Server:</p>
      <ul>
        <li>den Raumcode, die gewählten Spiele, Plätze und Einstellungen,</li>
        <li>deinen Spitznamen und dein Emoji-Bild, die alle im Raum sehen,</li>
        <li>eine zufällige Geräte-Kennung, mit der du nach einem Verbindungsabbruch auf deinen Platz zurückkommst; sie verrät nicht, wer du bist,</li>
        <li>die Spielzüge und den Spielstand, die Uhren sowie Emoji-Reaktionen und vorgefertigte Schnellnachrichten. Einen freien Chat gibt es nicht.</li>
      </ul>
      <p>
        Die Räume werden in Rechenzentren in der EU gespeichert. Ein Raum wird mit allen Daten spätestens 24 Stunden nach der letzten Aktivität gelöscht.
        Reaktionen und Schnellnachrichten werden nur weitergeleitet und nicht gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, denn ohne diese
        Daten kann die gewünschte Online-Partie nicht stattfinden.
      </p>
      <p>
        Beim Verbindungsaufbau verarbeitet Cloudflare außerdem technisch notwendige Daten wie deine IP-Adresse, Datum und Uhrzeit sowie Angaben zum
        Browser, um die Verbindung herzustellen und den Dienst vor Angriffen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Dabei können Daten in die USA
        übermittelt werden. Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert. Wie lange Cloudflare diese Daten speichert, bestimmt
        Cloudflare; Näheres steht in der <ExternalLink href={CLOUDFLARE_PRIVACY_URL}>Datenschutzerklärung von Cloudflare</ExternalLink>. Ich selbst
        werte keine Zugriffsprotokolle aus und speichere keine IP-Adressen.
      </p>

      <h2>Speicherung auf deinem Gerät</h2>
      <p>Damit du eine Partie fortsetzen kannst, speichert die App im Speicher deines Browsers (Local Storage):</p>
      <ul>
        <li>die laufende Partie mit Spielernamen, Einstellungen und Zügen,</li>
        <li>die zuletzt gewählten Einstellungen je Spiel,</li>
        <li>für Online-Partien deinen Spitznamen, dein Emoji-Bild und die zufällige Geräte-Kennung.</li>
      </ul>
      <p>
        Diese Daten verlassen dein Gerät nicht, außer Spitzname, Emoji-Bild und Geräte-Kennung, wenn du einen Online-Raum betrittst. Du kannst sie jederzeit löschen: mit „Verwerfen“ bei der laufenden Partie oder über die Einstellungen
        deines Browsers („Websitedaten löschen“). Die Speicherung ist für die von dir gewünschte Funktion unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
      </p>
      <p>
        Damit die App auch ohne Internet funktioniert, legt sie außerdem ihre eigenen Programmdateien im Zwischenspeicher deines Browsers ab (Service
        Worker). Darin sind keine persönlichen Daten enthalten.
      </p>
      <p>
        Bei Partien auf deinem Gerät rechnen die Computergegner vollständig dort, und es werden keine Spielzüge an einen Server geschickt. In Online-Partien
        rechnen Computergegner auf dem Spieleserver.
      </p>

      <h2>Namen beim Spielen</h2>
      <p>
        Namen für Spielerinnen und Spieler sind freiwillig und bleiben auf dem Gerät. Online sehen alle im Raum deinen Spitznamen; bitte keinen echten
        vollen Namen verwenden. Gerade in der Schule genügen Spitznamen oder Fantasienamen.
      </p>

      <h2>Links zu anderen Seiten</h2>
      <p>
        Links, etwa zum Quellcode auf GitHub oder zum Impressum auf lipponer.de, führen zu anderen Angeboten. Erst wenn du sie anklickst, gelten dort deren
        Datenschutzbestimmungen.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung, auf Datenübertragbarkeit und auf Widerspruch gegen die
        Verarbeitung (Art. 15 bis 21 DSGVO). Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel beim Landesbeauftragten
        für den Datenschutz und die Informationsfreiheit Baden-Württemberg.
      </p>

      <h2>Änderungen</h2>
      <p>
        Wenn neue Funktionen hinzukommen, wird diese Erklärung vorher ergänzt. Stand: Oktober 2026.
      </p>
    </LegalPage>
  );
}
