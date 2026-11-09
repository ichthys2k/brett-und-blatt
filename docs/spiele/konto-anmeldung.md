# Anmeldung mit Google- oder Microsoft-Konto (#153, #154)

Stand: 9.11.2026. Ergebnis des Konzept-Issues #153; die Umsetzung (#154) folgt diesem Dokument. Einordnung im Plan: [`spielerpass.md`](spielerpass.md), Abschnitt 8.3. **Einrichtung bei den Anbietern (für Cornelius): [`konto-anmeldung-einrichtung.md`](konto-anmeldung-einrichtung.md).**

Was hier steht, ist geprüft an den Erkennungsdokumenten der Anbieter (`accounts.google.com/.well-known/openid-configuration`, `login.microsoftonline.com/common/v2.0/.well-known/openid-configuration`, abgerufen 9.11.2026). Aussagen zu Kosten, Prüfung der Apps und Zustimmung in Schulen stammen aus meinem Wissen, die Hilfeseiten der Anbieter waren nicht abrufbar; sie sind mit ❓ markiert und vor dem Einrichten gegen die Anbieterseiten zu halten.

## 1. Ergebnis in Kürze

- Ein Konto wird ein **weiterer Öffner** des Passes, kein Ersatz für Spielercode, PIN, Passkey oder Notfallkarte. Der Server speichert **weder E-Mail noch Namen**, nur einen Prüfwert (HMAC) der Kontokennung.
- **Es gibt keinen Weg, der stärker ist als „Pfeffer allein“, solange das Konto der einzige Öffner ist.** Ein Anbieter liefert kein Geheimnis, das nur im Browser des Menschen entsteht (anders als ein Passkey mit PRF). Der Schlüssel des Passes muss also irgendwo liegen, wo die Anmeldung ihn freigibt: beim Server, geschützt durch den Pfeffer. Der Betreiber (und wer Datenbank und Pfeffer zugleich hat) könnte Konto-Schlösser öffnen. Das sagen die Oberfläche und die Datenschutzerklärung ehrlich.
- **Der stärkere Weg ist „Konto + PIN“**: Das Konto beweist die Anmeldung, die PIN (oder das Passwort) liefert den zweiten Teil des Schlüssels im Browser, den der Server nie sieht. Wer nur das Konto hat (Betreiber, gekapertes Konto), kommt nicht an den Pass. Empfohlen für Pässe mit Fortschritt; „nur Konto“ ist der bequeme Weg, etwa für Kinder und Schulen.
- Alle drei Zugangswege (nur Konto, Konto + PIN, kein Konto) bleiben freiwillig. Wer kein Konto verknüpft, hat wie bisher keins.

## 2. Ablauf

OpenID Connect, Autorisierungscode mit PKCE, **über den Worker** (Google verlangt für Web-Apps ein Client-Geheimnis beim Tausch des Codes, das nicht in den Browser darf).

```
Browser ── POST /konto/<anbieter>/start {binden} ──► Worker
          (binden = Hash eines Zufallswerts, der im Browser bleibt)
Worker: erzeugt state, nonce, code_verifier, speichert sie 10 Minuten (Durable Object je state),
        antwortet mit der Anbieter-Adresse (authorize + code_challenge S256, scope=openid)
Browser ── Weiterleitung ──► Anbieter (Anmeldung, Einwilligung)
Anbieter ── Weiterleitung ──► Worker /konto/<anbieter>/rueckruf?code&state
Worker: tauscht den Code (mit Client-Geheimnis + code_verifier), prüft das ID-Token
        (Signatur über JWKS, iss, aud, exp, nonce), bildet die Kontokennung,
        legt ein Ticket an (5 Minuten, an `binden` gebunden)
Worker ── Weiterleitung ──► spiele.lipponer.de/#/konto?ticket=…
Browser ── POST /konto-schloss/<Kennung>/<aktion> {ticket, binden, …} ──► Worker
```

- **Scope nur `openid`.** Keine E-Mail, kein Profil, kein Token wird gespeichert; nach der Prüfung des ID-Tokens wirft der Worker alles weg außer der Kontokennung im Ticket.
- **Ticket:** 5 Minuten gültig, für mehrere Aufrufe (Anlegen und Schreiben brauchen zwei), an den Browser gebunden (das Geheimnis `binding` bleibt im Browser, im Rückruf-Link steht nur das Ticket). Ein abgefangener Link nützt nichts. Die Seite nimmt das Ticket sofort aus der Adresse.
- **Kontokennung:** bei Google `sub`; bei Microsoft `tid` + `sub` (das `sub` von Microsoft ist je App und Nutzer stabil; `oid` wäre über Apps hinweg gleich und damit weniger privat; ❓ am echten Konto prüfen, ob `sub` bei privaten und bei Schulkonten immer vorhanden ist). Das Konto-Schloss liegt unter `HMAC(Pfeffer, "konto\n" + anbieter + "\n" + kontokennung)`, auf 128 Bit gekürzt.
- **Microsoft „common“:** ID-Tokens tragen die Mandanten-Kennung im Aussteller (`https://login.microsoftonline.com/<tid>/v2.0`); der Worker prüft den Aussteller gegen die `tid` im Token, nicht gegen eine feste Adresse.

## 3. Konto-Schloss

Liegt in einem eigenen Durable Object (`AccountLock`, ein Objekt je Kontokennung-HMAC, in der EU), Logik in `packages/online/src/account-lock.ts`.

- **Inhalt:** der Passschlüssel samt Ausweis, im Browser verschlüsselt. **Nur Konto:** Schlüssel = `HKDF(Serveranteil)`; der Serveranteil liegt mit dem Pfeffer verschlüsselt im Objekt und kommt nur nach gültigem Ticket heraus. **Konto + PIN:** Schlüssel = `HKDF(wrap ‖ Serveranteil)` mit `wrap` aus PIN und Kontokennungs-HMAC (PBKDF2 wie beim PIN-Schloss); der Server prüft zusätzlich `auth` (wie beim PIN-Schloss) und zählt Fehlversuche je Konto-Schloss (ab 5 Wartezeit, ab 10 gesperrt, wie `lock.ts`).
- **Aktionen:** `verknuepfen` (angemeldeter Browser mit offenem Pass legt das Schloss an oder ersetzt es), `oeffnen` (neues Gerät: Ticket + ggf. PIN → Serveranteil + Inhalt; der Browser entschlüsselt, legt den Pass auf dem Gerät an), `loesen` (Ticket oder offener Pass entfernt das Schloss). Ohne Ticket geschieht nichts.
- **Mehrere Konten je Pass:** erlaubt (Google und Microsoft zugleich, auch zwei Google-Konten). Jedes hat sein eigenes Schloss mit demselben Inhalt. Der Pass merkt sich im Block `einstellungen` nur die Kennungen der Konto-Schlösser und die Anbieter (kein Name, keine E-Mail), damit „Verknüpfung lösen“ weiß, was zu löschen ist.
- **Verlust des Kontos** (gesperrt, gelöscht): Notfallkarte oder Passkey öffnen den Pass wie immer; danach eine neue Verknüpfung. Schlösser ohne Zugriff verfallen nach 13 Monaten wie die anderen.
- **Neuer Passschlüssel** (wenn der Spielercode erneuert wird): der Pass schreibt alle verknüpften Konto-Schlösser neu, solange er offen ist; sonst bleiben sie bis zum Verfall unbrauchbar.

## 4. Bedrohungen

| Bedrohung | Wirkung | Antwort |
|---|---|---|
| Fremder kapert das Google-/Microsoft-Konto | öffnet bei „nur Konto“ den Pass | „Konto + PIN“ wählbar; Hinweis im Dialog |
| Betreiber oder Cloudflare (Datenbank + Pfeffer) | kann „nur Konto“-Schlösser öffnen | offen in der Datenschutzerklärung; bei „Konto + PIN“ nicht möglich; Pfeffer nur als Secret |
| Datenbank-Kopie ohne Pfeffer | nichts durchprobierbar | Kontokennung nur als HMAC mit Pfeffer, Serveranteil mit Pfeffer verschlüsselt |
| Abgefangener Rückruf-Link | nichts | Ticket 5 Minuten, an das Geheimnis des Browsers gebunden |
| Gefälschter Rückruf (CSRF, Code-Einschleusung) | Anmeldung am falschen Konto | `state` + `nonce` + PKCE, `state` einmalig und 10 Minuten gültig |
| Aussteller-Fälschung bei Microsoft „common“ | gefälschte ID-Token | Signatur über JWKS, Aussteller gegen `tid` im Token, `aud` = eigene Client-Kennung |
| Durchprobieren der PIN bei „Konto + PIN“ | – | Zähler je Konto-Schloss, ab 10 gesperrt; Zurücksetzen nur über die Notfallkarte |
| Client-Geheimnis läuft ab (Microsoft: höchstens 24 Monate) | Anmeldung geht nicht mehr | Erinnerung in `docs/betreiber.md`; Fehlerbild „Anbieter nicht erreichbar“ |

## 5. Anbieter: was nötig ist

Schritt-für-Schritt für Cornelius: [`konto-anmeldung-einrichtung.md`](konto-anmeldung-einrichtung.md). Eckdaten:

| | Google | Microsoft |
|---|---|---|
| Wo | Google Cloud Console → APIs & Dienste → Anmeldedaten (OAuth-Client „Webanwendung“) | Microsoft Entra Admin Center → App-Registrierungen |
| Konten | alle Google-Konten, auch Workspace | „Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten“ |
| Scopes | `openid` | `openid` |
| Rückruf-Adresse | `https://brett-und-blatt.lipponer.workers.dev/konto/google/rueckruf` (+ lokal `http://127.0.0.1:8787/konto/google/rueckruf`) | `…/konto/microsoft/rueckruf` (+ lokal `http://localhost:8787/…`) |
| Secrets | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `MS_CLIENT_ID`, `MS_CLIENT_SECRET` |
| Kosten | ❓ keine für die Anmeldung | ❓ keine für die App-Registrierung |
| Prüfung | ❓ Bei nur `openid` keine Überprüfung der Scopes nötig; für Zustimmungsbildschirm Name, Support-E-Mail, Datenschutz-Link; „In Produktion“ stellen, sonst nur 100 Testnutzer | ❓ Für `openid` genügt Einwilligung des Nutzers; manche Schul-Mandanten verlangen Zustimmung des Administrators |

## 6. Rechtliches

- **Rechtsgrundlage:** Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) durch die Verknüpfung; jederzeit lösbar. Google und Microsoft werden in der Datenschutzerklärung als Empfänger der Anmeldung genannt (Drittland: USA, mit Angemessenheitsbeschluss/Data Privacy Framework nach Selbstauskunft der Anbieter ❓ prüfen).
- **Pseudonym:** Auch der HMAC einer Kontokennung ist ein Pseudonym und damit personenbezogen; er wird zusammen mit dem Pass gelöscht (Löschen der Verknüpfung, Verfall nach 13 Monaten).
- **Kinder unter 16:** In Deutschland braucht es für die Einwilligung die Eltern (Art. 8 DSGVO). Die Oberfläche weist darauf hin, dass die Verknüpfung freiwillig ist und Kinder ohne Konto spielen können (PIN, Notfallkarte, Passkey).
- **Schulkonten:** funktionieren technisch gleich. Schulen entscheiden selbst, ob Schüler Apps von außen anmelden dürfen (Mandanten-Einstellung). Wir bieten es nicht gezielt für Schüler an; in der Klassenverwaltung steht ein Satz dazu.
- **README und Datenschutzerklärung:** „ohne eigenes Konto; Anmeldung mit Google oder Microsoft ist freiwillig“, Beschreibung des Ablaufs, des Pfeffers und der Grenzen („nur Konto“ vs. „Konto + PIN“).

## 7. Ausblick: Klassen aus Microsoft Teams oder Google Classroom

Nur bewertet, nicht geplant:

- **Microsoft:** Die Bildungs-API (Education/EduRoster) braucht Berechtigungen, die ein **Administrator der Schule** erteilen muss, und eine Anmeldung mit Schul-Mandant. Ohne Zusage der Schule geht es nicht; pro Schule wäre eine Freigabe nötig.
- **Google Classroom:** Die Classroom-API-Bereiche (Kurse, Teilnehmer) sind „sensible“ Bereiche: Google verlangt eine **Überprüfung der App** (Datenschutz, Sicherheitsbewertung) und Workspace-Administratoren müssen den Zugriff zulassen.
- **Empfehlung:** nicht bauen. Der bestehende Weg (Klassencode, Klassenausweise zum Drucken, Liste einfügen) deckt den Bedarf ohne Fremdzugriff auf Schülerdaten. Eine Übernahme per Datei (CSV-Export aus Teams oder Classroom) ist ein kleiner, späterer Schritt ohne Anbieteranbindung.

## 8. Umsetzung (#154, 9.11.2026)

- **Server:** `apps/server/src/index.ts` (Routen `GET /konto`, `POST /konto/<anbieter>/start`, `GET /konto/<anbieter>/rueckruf`, `POST /konto/ticket`, `POST /konto-schloss/<Kennung>/<aktion>`, Durable Objects `AccountFlow` für Vorgang und Ticket, `AccountLockBox` für das Konto-Schloss, **Wrangler-Migration v10**), `apps/server/src/oidc.ts` (Tausch des Codes, Signatur über JWKS), Logik ohne Anbieterbindung in `packages/online/src/account.ts`. Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` (und der vorhandene `PASS_PEPPER`); ohne sie meldet `GET /konto` den Anbieter nicht, und die Oberfläche zeigt nichts.
- **Browser:** `packages/ui/src/sync/account.ts` (Schlüssel, Aufrufe), `apps/web/src/lib/accountLogin.ts`, Seite `#/konto` (`screens/Account.tsx`), Bereich „Mit Konto anmelden“ im Pass (`components/AccountPanel.tsx`). Die verknüpften Anbieter stehen je Pass in `brett-und-blatt:konten` (nur Anbieter und Zeit).
- **Abweichung vom Konzept:** Die verknüpfte Kennung der Konto-Schlösser steht nicht im Pass-Block (wie in Abschnitt 3 angedacht), sondern nur auf dem Gerät; „Lösen“ geht auf jedem Gerät nach einer Anmeldung, weil das Ticket die Kennung liefert. Der Inhalt eines Konto-Schlosses wird nur beim Verknüpfen geschrieben; Änderungen am Pass (Blöcke) laufen über den Passschlüssel, der darin steht.
- **Nicht geprüft:** der Ablauf mit echten Google-, Microsoft- und Schulkonten (Apps müssen erst angelegt werden, Anleitung: `konto-anmeldung-einrichtung.md`). Getestet sind die Logik (Token-Prüfung mit eigenem Schlüsselpaar, Konto-Schloss, Ticket) und der Browser-Teil gegen einen nachgebauten Server.
