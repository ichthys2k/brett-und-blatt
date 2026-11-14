import type { ReactNode } from 'react';
import { Button } from '../components/controls';
import { t } from '../i18n';
import { PUSH_PUBLIC_KEY } from '../lib/push';
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
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.menu)}>
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
      <p>
        Die Soundeffekte hat Cornelius Lipponer mit ElevenLabs erstellt. Sie sind von der freien Lizenz ausgenommen (alle Rechte vorbehalten) und liegen
        nicht im öffentlichen Quellcode.
      </p>
      <p>Die Musik hat Cornelius Lipponer mit Suno erstellt; sie steht unter CC BY-SA 4.0.</p>
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

/**
 * Hinweise aufs Gerät (Web Push, #242). **Entwurf, nicht juristisch geprüft** – Cornelius liest gegen. Der Abschnitt erscheint nur,
 * wenn die Funktion sichtbar ist (öffentlicher Schlüssel im Build), damit die Erklärung nie etwas beschreibt, das es noch nicht gibt.
 */
export function PushPrivacy() {
  return (
    <>
      <h2>Hinweise aufs Gerät (Web Push)</h2>
      <p>
        Auf Wunsch schickt der Spieleserver dir eine Meldung aufs Gerät, auch wenn die App geschlossen ist: wenn eine Turnierpartie von dir aufgerufen wird,
        eine Frist bald abläuft, ein Turnier beginnt oder endet oder du in einer Fernpartie am Zug bist. Das ist freiwillig und für das Spielen nicht nötig. Es
        passiert nur, wenn du ausdrücklich „Hinweise einschalten“ wählst und dein Browser es zusätzlich erlaubt; nie beim bloßen Öffnen einer Seite.
      </p>
      <p>
        Auch am Schwarzen Brett („Wer hat Lust?“) gibt es diese Hinweise, ebenfalls nur auf ausdrücklichen Wunsch: wenn jemand auf deinem Zettel „Bin dabei“ sagt, ein
        Vorschlag auf deine Zusage wartet oder dein Raum steht. Dort speichert der Spieleserver das Abo unter einer aus deiner Geräte-Kennung abgeleiteten
        Kurzkennung (nicht unter der Kennung selbst) und vergisst es spätestens nach drei Stunden; mit einem Abo bleibt dein Zettel hängen, auch wenn du die Seite schließt,
        bis er nach 30 Minuten (mit Verlängern später) abläuft. Die Meldung nennt weder Namen noch Spielnamen.
      </p>
      <p>Dafür speichert der Spieleserver beim jeweiligen Turnier oder Raum (Rechenzentren in der EU):</p>
      <ul>
        <li>die Adresse („Endpunkt“) des Push-Dienstes deines Browsers und zwei Schlüssel, mit denen die Meldung nur für dein Gerät lesbar verschlüsselt wird,</li>
        <li>deine Geräte-Kennung und den Zeitpunkt der Anmeldung,</li>
        <li>zum Schutz vor zu vielen Meldungen die Zeitpunkte der zuletzt gesendeten Meldungen (höchstens eine je Art und 30 Minuten) und welche Meldungen schon gesendet wurden.</li>
      </ul>
      <p>
        Die Meldung enthält nur die Art („Du bist am Zug“) und den Link zum Turnier oder Raum, keine Namen und keine Spielinhalte. Sie läuft über den Push-Dienst
        deines Browser-Herstellers (Google, Apple, Mozilla oder Microsoft); dort können Daten in Länder außerhalb der EU gelangen, und es gelten deren
        Datenschutzbestimmungen. Der Inhalt ist Ende-zu-Ende verschlüsselt, der Push-Dienst sieht nur Endpunkt, Größe und Zeitpunkt.
      </p>
      <p>
        Die Daten bleiben, bis du die Hinweise ausschaltest, bis der Push-Dienst das Abo als ungültig meldet oder bis das Turnier (30 Tage nach seinem Ende, Ligen
        nach einem Jahr) bzw. der Raum (Fernpartien 30 Tage nach der letzten Aktivität) gelöscht wird. Widerrufen kannst du jederzeit: in der App mit „Hinweise sind an –
        ausschalten“ (in einem Turnier, in einer Fernpartie oder unter „Optionen“) und in den Einstellungen deines Browsers. Auf deinem Gerät merkt sich die App nur,
        dass du Hinweise wünschst (Local Storage); das Abo selbst verwaltet dein Browser.
      </p>
      <p>
        Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du mit dem Einschalten erteilst und jederzeit mit Wirkung für die Zukunft widerrufen
        kannst. Ein Hinweis ist keine Zustellgarantie; Spielregeln und Fristen hängen nie davon ab, dass eine Meldung ankam.
      </p>
    </>
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
        CA 94107, USA. Ohne Online-Partie oder Sicherung (siehe unten) wird keine Verbindung zu Cloudflare aufgebaut.
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
        <strong>Sicherung (Narrenhof, Drachenspiel):</strong> Wenn du einen Rettungscode anlegst, verschlüsselt dein Browser je Spiel deinen Stand
        (im Narrenhof Glöckchen, Freischaltungen und Hofchronik, im Drachenspiel deine eigenen Decks und deinen Solo-Fortschritt) mit einem Schlüssel aus diesem Code und legt nur den verschlüsselten Block unter einer daraus abgeleiteten,
        zufälligen Kennung auf dem Spieleserver in der EU ab; ohne den Code kann niemand ihn lesen, auch ich nicht. Name, E-Mail-Adresse oder ein Konto
        braucht es dafür nicht, ein Passkey bleibt bei dir und deinem Passkey-Speicher. Die Sicherung wird gelöscht, wenn sie 400 Tage lang nicht abgerufen
        wurde. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Spielerausweis:</strong> Wenn du einen Spielercode anlegst oder den Ausweis in deine Sicherung legst, verschlüsselt dein Browser deine
        Geräte-Kennung, deinen Spitznamen und dein Emoji-Bild und legt sie auf dieselbe Weise und mit derselben Löschfrist auf dem Spieleserver ab. So
        erkennt dich ein Raum auch auf einem anderen Gerät wieder. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Partiebuch:</strong> Jede beendete Partie trägt dein Gerät im Partiebuch deines Passes ein: Spiel, Zeitpunkt, Dauer, Spielart, Ergebnis und die Mitspieler
        mit Spitzname, Bild und Bot-Stufe (keine Kennungen), dazu Zähler je Spiel. Das Buch liegt zunächst nur auf deinem Gerät. Legst du den Ausweis in deine
        Sicherung oder schützt ihn mit PIN, wird es auf dieselbe Weise verschlüsselt auf dem Spieleserver abgelegt, gelesen werden kann es nur mit deinem Passschlüssel.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Spielerwappen:</strong> Das Wappen deines Passes ist eine kurze Beschreibung (Schildform, Teilung, Farben, Wappentier, Zier). Es bleibt auf deinem Gerät und
        reist mit deinen Einstellungen in die verschlüsselte Sicherung. Betrittst du einen Online-Raum und hast „Mein Wappen im Raum zeigen“ nicht abgewählt, geht die Beschreibung
        zusammen mit Spitzname und Bild an den Raum und damit an alle, die darin sind; der Spieleserver prüft sie und speichert sie so lange wie den Raum. Keine Kennung und
        kein Name außer deinem Spitznamen gehört dazu. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Pass teilen:</strong> Wenn du „Link erstellen“ wählst, verschlüsselt dein Browser einen Schnappschuss (Spitzname, Bild und die Teile, die du ankreuzt) mit einem Zufallsschlüssel,
        der nur im Link hinter dem „#“ steht und nie an den Server geht. Der Spieleserver in der EU speichert nur die verschlüsselten Daten unter einer aus dem Schlüssel abgeleiteten Kennung und den
        Prüfwert eines Schreibgeheimnisses, das auf deinem Gerät bleibt. Mit „Teilen beenden“ wird alles gelöscht; ohne Abruf löscht der Server den Schnappschuss nach einem Jahr. Wer den Link hat,
        kann den Schnappschuss lesen. Das Bild („Als Bild“) entsteht auf deinem Gerät. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Eigene Pakete:</strong> Deine Pakete (Paare aus zwei Feldern, z. B. Vokabeln) liegen in deinem Pass und reisen mit der verschlüsselten Sicherung auf deine Geräte. Wählst du „Link erstellen“, verschlüsselt dein Browser das
        Paket mit einem Zufallsschlüssel, der nur im Link hinter dem „#“ steht; der Spieleserver in der EU speichert nur die verschlüsselten Daten und den Prüfwert eines Schreibgeheimnisses, das auf deinem Gerät bleibt. „Teilen beenden“ löscht sie,
        ohne Abruf löscht der Server sie nach einem Jahr. Es gibt keine öffentliche Liste. Wer den Link hat, kann das Paket lesen. Spielst du eine Partie mit einem eigenen Paket, gehen dessen Paare (höchstens 18) mit der Partie an die Mitspielenden. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Anki-Pakete teilen:</strong> Importierte Anki-Pakete liegen auf deinem Gerät (im Browser-Speicher) und gehen nicht an den Server. Wählst du „Link erstellen“, verpackt dein Browser das Paket mit seinen Bildern und Tönen (ohne deinen Lernstand),
        verschlüsselt es mit einem Zufallsschlüssel, der nur im Link hinter dem „#“ steht, und legt es als eine Datei im Speicherdienst Cloudflare R2 (Rechtsraum EU) ab. Der Spieleserver speichert dazu nur den Prüfwert eines
        Schreibgeheimnisses, das auf deinem Gerät bleibt, die Größe und den Zeitpunkt des letzten Abrufs; Cloudflare sieht nur verschlüsselte Daten. „Teilen beenden“ löscht alles; ohne Abruf löscht der Server das Paket nach einem Jahr.
        Es gibt keine öffentliche Liste. Wer den Link hat, kann das Paket lesen. Teile nur Pakete, die du teilen darfst. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Klassen:</strong> Legst du eine Klasse an oder trittst bei, speichert der Spieleserver in der EU den Namen der Klasse, die Geräte-Kennung jedes Mitglieds (zum Ausweisen, sie wird nie anderen
        Mitgliedern gezeigt) sowie Spitzname, Bild und – wenn du eines gewählt hast – das Wappen. Alle Mitglieder sehen Spitzname, Bild und Wappen der anderen Mitglieder; Fremde ohne Mitgliedschaft sehen nur den
        Namen der Klasse. Dazu legt dein Gerät eine „Klassenkarte“ ab (und führt sie nach Partieende nach): je nach Einstellung der Leitung und deiner eigenen Wahl deine Stempel, die Zahl deiner Pokale je Spiel, deine Lieblingsspiele, deinen Album-Fortschritt (nur die Zahl der Funde je Spiel) und deine Bot-Wertung (aggregierte Elo-Leistungszahl, Zahl der Partien und Siege gegen Bots; nie Codes, Kennungen oder Lernstände einzelner Karten); du kannst jeden Teil abwählen. Schaltet die Leitung die Rangliste ein, können Mitglieder die Bot-Wertung und Pokale je Spiel in einer Übersicht vergleichen. Öffnet ein Mitglied einen Raum für die Klasse, merkt sich der Server den Raumcode und wer ihn geöffnet hat für sechs Stunden und zeigt ihn nur Mitgliedern der Klasse; der Raum selbst ist nicht öffentlich. Die Leitung kann Mitglieder entfernen und die Klasse auflösen; du kannst jederzeit gehen. Eine Klasse ohne Aktivität wird nach einem Jahr gelöscht. Legt die Leitung Klassenausweise an, entstehen dabei auf dem Spieleserver Ausweise für die Kinder (nur Spitzname und ein Tierbild als Platzhalter) mit Spielercode und Start-PIN; die zugehörigen Codes
        speichert die Leitung verschlüsselt in ihrem eigenen Pass, um vergessene PINs zurückzusetzen. Bei Schulklassen ist die Schule
        für die Teilnahme der Kinder verantwortlich. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Pakete und Lernstand in der Klasse:</strong> Die Leitung kann Anki-Pakete in die Klasse legen. Dafür speichert der Spieleserver in der EU den Namen des Pakets und den Linkschlüssel, mit dem das Paket (verschlüsselt in Cloudflare R2, EU) geöffnet wird; er gibt den
        Schlüssel nur an Mitglieder der Klasse weiter und könnte das Paket damit lesen. Schaltet die Leitung „Lernstand“ ein, erscheint für jedes Mitglied zuerst ein Hinweis, und erst nach der Zustimmung (bei Kindern: der Eltern) legt das Gerät den Lernstand
        der Pakete dieser Klasse ab: die Kennungen der Karten, wie oft sie wiederholt und vergessen wurden, die Art des Lernstands, Zahl und Zeitpunkt der Antworten der letzten Tage und die Lerntage in Folge, nichts anderes aus deinem Pass (keine Partien, keine Notizen).
        Der Stand wird auf deinem Gerät mit einem Schlüssel verschlüsselt, den nur die Leitung öffnen kann; der Spieleserver speichert nur diese unlesbaren Daten und den Zeitpunkt der Ablage. Du kannst die Zustimmung jederzeit widerrufen oder die Klasse verlassen; dann wird der
        abgelegte Stand gelöscht. Schaltet die Leitung den Lernstand aus oder löst sie die Klasse auf, wird er ebenfalls gelöscht; eine Klasse ohne Aktivität wird nach einem Jahr gelöscht. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), bei Kindern unter 16 Jahren
        die der Eltern (Art. 8 DSGVO). Schaltet die Leitung „Fällige Karten der Klasse“ ein, kann dein Gerät nach deiner Zustimmung anonym melden, welche Karten der Klassenpakete bei dir fällig sind (nur die Kennungen der Karten, ohne Namen und Zahlen). Der Spieleserver speichert die
        Meldung je Gerät, damit eine neue die alte ersetzt, zeigt der Leitung aber nur eine Liste der in der Klasse am häufigsten fälligen Karten, und erst ab drei Meldungen. Du kannst die Zustimmung jederzeit widerrufen; dann wird deine Meldung gelöscht.
      </p>
      <p>
        <strong>PIN oder Passwort (Schloss):</strong> Wenn du deinen Ausweis mit PIN oder Passwort schützt, rechnet dein Browser aus Spielercode und
        PIN bzw. Passwort zwei Werte aus. Die PIN selbst verlässt dein Gerät nie. Der Spieleserver in der EU speichert nur einen Prüfwert, den er mit einem
        geheimen Schlüssel des Betreibers (dem „Pfeffer“, der nicht im Speicher liegt) bildet, einen mit demselben Schlüssel verschlüsselten Zufallsanteil,
        den im Browser verschlüsselten Ausweis und einen Zähler der Fehlversuche mit der Zeit der letzten Sperre. Nach fünf falschen Eingaben muss man
        warten, nach zehn ist der Ausweis gesperrt, bis die Rettungskarte (Rettungscode) ihn zurücksetzt. Zusätzlich zählt der Server, wie oft von einer
        IP-Adresse aus nicht vorhandene Codes oder falsche PINs versucht werden, und speichert diese Adresse höchstens eine Stunde. Das Schloss wird gelöscht,
        wenn es 400 Tage lang nicht abgerufen wurde. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und f DSGVO (Schutz vor Missbrauch).
      </p>
      <p>
        <strong>Anmeldung mit Google oder Microsoft (freiwillig):</strong> Du kannst ein Google- oder Microsoft-Konto (auch ein Schul- oder Arbeitskonto) mit
        deinem Pass verknüpfen und dich damit auf einem neuen Gerät anmelden. Dabei leitet dich der Spieleserver zum Anbieter weiter (Google Ireland Limited,
        Gordon House, Barrow Street, Dublin 4, Irland, bzw. Microsoft Ireland Operations Limited, One Microsoft Place, Dublin 18, Irland; die Anbieter können
        Daten in die USA übermitteln). Angefordert wird nur die Anmeldung („openid“), keine E-Mail-Adresse und kein Name. Der Spieleserver erhält vom
        Anbieter die feste Kennung deines Kontos, bildet daraus mit dem geheimen Schlüssel des Betreibers (dem „Pfeffer“) einen Prüfwert und verwirft die
        Kennung wieder. Gespeichert werden der Prüfwert, ein mit dem Pfeffer verschlüsselter Zufallsanteil, der im Browser verschlüsselte Inhalt (dein Pass mit
        Passschlüssel) und, wenn du „Konto + PIN“ wählst, ein Prüfwert deiner PIN samt Zähler der Fehlversuche. <strong>Wichtig:</strong> Bei „nur Konto“
        könnte, wer dein Konto übernimmt oder wer den Spieleserver samt Pfeffer betreibt, den Pass öffnen; bei „Konto + PIN“ nicht. Die Verknüpfung kannst du
        jederzeit im Pass lösen, dann wird das Schloss gelöscht; es verfällt sonst nach 400 Tagen ohne Abruf. Der Prüfwert ist ein Pseudonym und zählt als
        personenbezogenes Datum. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) durch die Verknüpfung. Kinder unter 16 Jahren brauchen
        dafür das Einverständnis ihrer Eltern; Schulen entscheiden selbst, ob Schülerkonten Apps von außen anmelden dürfen. Ohne Verknüpfung wird nichts an
        Google oder Microsoft übermittelt.
      </p>
      <p>
        <strong>Turniere:</strong> Wenn du ein Turnier anlegst, dich einschreibst oder die Turnierseite öffnest, speichert der Spieleserver in der EU den
        Namen des Turniers, deine Geräte-Kennung, deinen Spitznamen und dein Emoji-Bild sowie Paarungen und Ergebnisse. Alle Eingeschriebenen sehen
        Spitznamen, Bilder und Ergebnisse, die Geräte-Kennung sieht niemand. Das Turnier wird 30 Tage nach seinem Ende gelöscht, ein nicht beendetes 30 Tage
        nach der letzten Aktivität. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Serien:</strong> Legt die Leitung eine Serie an und ordnet ihr Turniere zu, speichert der Spieleserver in der EU den Namen der Serie, die
        Geräte-Kennung der Leitung und von jedem beendeten Turnier Name, Spitznamen der Teilnehmer, Platzierungen und Ergebnisse der Partien sowie
        je Teilnehmer eine daraus abgeleitete Kurzform der Geräte-Kennung (ein Pseudonym, mit dem derselbe Mensch über mehrere Turniere erkannt wird; die
        Kennung selbst ist daraus nicht zu lesen). Wer die Adresse der Serie kennt, sieht Spitznamen, Platzierungen, Punkte und Elo-Zahlen. Die Serie wird ein Jahr
        nach der letzten Aktivität gelöscht; die Leitung kann sie jederzeit löschen oder verlängern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und f DSGVO.
      </p>
      <p>
        <strong>Verein oder Schule (Organisationen):</strong> Stellst du einen Antrag auf eine Gruppe oder bist du Mitglied einer, speichert der Spieleserver in der EU
        deine Geräte-Kennung, deinen Spitznamen, dein Tierbild (und, wenn du es zeigst, dein Wappen), den Namen und die Art der Gruppe, deine Rollen darin
        (etwa Leitung, Schiedsrichter oder Anmeldung) und ein Protokoll, wer wann welche Rolle vergeben, angenommen, abgelehnt oder entzogen hat (nur die
        öffentlichen Kurzkennungen und Spitznamen, keine Geräte-Kennungen). Bei einem Antrag kommen der Zweck, den du angibst, und der Zeitpunkt hinzu; der
        Betreiber der Seite sieht ihn ohne deine Geräte-Kennung und gibt die Gruppe frei oder lehnt ab (entschiedene Anträge werden nach 30 Tagen gelöscht). Einladungs-Codes
        gelten einen Tag und nur einmal. Mitglieder sehen die Mitgliederliste mit Rollen; Einladungen und Protokoll sehen nur Betreiber und Leitung. Ordnet die Leitung ein
        Turnier oder eine Serie der Gruppe zu, gelten die Rollen dort, und der Server fragt sie bei der Gruppe ab. Eine Klasse zählt dabei als Gruppe: Ihre Leitung hat die
        Rolle der Leitung. Das Gerät merkt sich, dass es einen Antrag gestellt hat, nur in seinem Speicher. Eine Gruppe ohne Aktivität wird nach einem Jahr gelöscht; du
        kannst jederzeit austreten, der Betreiber der Gruppe kann Mitglieder entfernen, und der Betreiber der Seite kann eine Gruppe sperren oder auflösen. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. b und f DSGVO.
      </p>
      <p>
        Beim Verbindungsaufbau verarbeitet Cloudflare außerdem technisch notwendige Daten wie deine IP-Adresse, Datum und Uhrzeit sowie Angaben zum
        Browser, um die Verbindung herzustellen und den Dienst vor Angriffen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Dabei können Daten in die USA
        übermittelt werden. Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert. Wie lange Cloudflare diese Daten speichert, bestimmt
        Cloudflare; Näheres steht in der <ExternalLink href={CLOUDFLARE_PRIVACY_URL}>Datenschutzerklärung von Cloudflare</ExternalLink>. Ich selbst
        werte keine Zugriffsprotokolle aus und speichere keine IP-Adressen.
      </p>

      {PUSH_PUBLIC_KEY && <PushPrivacy />}

      <h2>Sprachchat in privaten Räumen</h2>
      <p>
        In privaten Räumen (nur wer den Raumcode hat) kannst du mit den anderen sprechen – in der Web-App wie in der VR-App. Das Mikrofon geht erst an, wenn
        du ausdrücklich „Mitsprechen“ wählst und es im Browser erlaubst; du kannst dich jederzeit stumm schalten, aussteigen oder einzelne Mitspieler für dich
        stumm schalten. Die Stimme läuft direkt zwischen den Geräten (WebRTC) und wird weder auf dem Spieleserver noch sonst irgendwo aufgezeichnet oder
        gespeichert. Der Spieleserver vermittelt nur den Verbindungsaufbau und weiß, wer gerade mitspricht. Dabei erfahren die Geräte im Sprachchat
        gegenseitig ihre IP-Adressen. Für den Verbindungsaufbau wird der STUN-Server von Cloudflare genutzt, in schwierigen Netzen gegebenenfalls ein
        TURN-Server von Cloudflare, der die verschlüsselten Daten nur durchleitet. Wer „Melden“ wählt, schaltet den Sprachchat für alle im Raum bis zur
        nächsten Partie ab; dabei wird nichts gespeichert oder weitergegeben. In öffentlichen Räumen gibt es keinen Sprachchat. Rechtsgrundlage ist Art. 6
        Abs. 1 lit. a DSGVO (deine Einwilligung durch das Einschalten des Mikrofons), die du jederzeit durch Aussteigen widerrufen kannst.
      </p>

      <h2>VR-App (vr.spiele.lipponer.de)</h2>
      <p>
        Die VR-App für die Meta Quest nutzt denselben Spieleserver wie diese Seite; dafür gilt das oben Gesagte. Sie wird von Cloudflare Pages ausgeliefert, wobei
        Cloudflare wie oben technisch notwendige Daten wie deine IP-Adresse verarbeitet. Sitzen mehrere Leute mit Brille im selben Raum, schicken sich die Brillen
        Kopf- und Handpositionen direkt zu (WebRTC), damit ihr euch als Figuren seht. Dabei erfahren die Brillen gegenseitig ihre IP-Adressen; der Spieleserver
        vermittelt nur den Verbindungsaufbau und speichert weder Positionen noch Adressen. Kommt keine direkte Verbindung zustande, geht höchstens einmal je
        Sekunde nur die Kopfposition über den Spieleserver an die anderen Brillen, ohne gespeichert zu werden. Für den Verbindungsaufbau wird der STUN-Server von
        Cloudflare genutzt, bei schwierigen Netzen gegebenenfalls ein TURN-Server von Cloudflare, der die Daten nur durchleitet. Wer am Handy oder Rechner
        spielt, sendet keine Positionen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>Speicherung auf deinem Gerät</h2>
      <p>Damit du eine Partie fortsetzen kannst, speichert die App im Speicher deines Browsers (Local Storage):</p>
      <ul>
        <li>die laufende Partie mit Spielernamen, Einstellungen und Zügen,</li>
        <li>die zuletzt gewählten Einstellungen je Spiel,</li>
        <li>ob der Ton an ist und wie laut, welche Playlist du je Spiel gewählt hast und welche Musikstücke du markiert oder ausgeschlossen hast,</li>
        <li>für Online-Partien deinen Spitznamen, dein Emoji-Bild und die zufällige Geräte-Kennung,</li>
        <li>im Narrenhof deinen Spielfortschritt, im Drachenspiel deine eigenen Decks und deinen Solo-Fortschritt und, falls angelegt, deinen Rettungscode.</li>
      </ul>
      <p>
        Diese Daten verlassen dein Gerät nicht, außer Spitzname, Emoji-Bild und Geräte-Kennung, wenn du einen Online-Raum betrittst, und der verschlüsselte Stand aus Narrenhof und Drachenspiel, wenn du eine Sicherung anlegst. Du kannst sie jederzeit löschen: mit „Verwerfen“ bei der laufenden Partie oder über die Einstellungen
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
        Wenn neue Funktionen hinzukommen, wird diese Erklärung vorher ergänzt. Stand: November 2026.
      </p>
    </LegalPage>
  );
}
