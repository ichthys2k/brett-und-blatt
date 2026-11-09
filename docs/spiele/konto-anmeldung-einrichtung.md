# Einrichtung: Google und Microsoft für die Anmeldung (für Cornelius)

Stand: 9.11.2026. Du legst beide Apps selbst an; **Client-Geheimnisse gehören nie in den Chat oder ins Repo**, sondern nur als Wrangler-Secrets. Die Schritte beschreiben die Oberflächen der Anbieter aus meinem Wissen (❓); die Menünamen können abweichen. Hintergrund: [`konto-anmeldung.md`](konto-anmeldung.md).

Rückruf-Adressen (beide Anbieter, je eine):

- Betrieb: `https://brett-und-blatt.lipponer.workers.dev/konto/google/rueckruf` und `…/konto/microsoft/rueckruf`
- Lokal (nur zum Testen): `http://127.0.0.1:8787/konto/google/rueckruf` (Google) und `http://localhost:8787/konto/microsoft/rueckruf` (Microsoft)

## A. Google

1. Google Cloud Console (console.cloud.google.com) öffnen, oben ein Projekt wählen oder anlegen („Brett und Blatt“).
2. **APIs & Dienste → OAuth-Zustimmungsbildschirm**: Nutzertyp **Extern**, App-Name „Brett & Blatt“, Support-E-Mail, Entwickler-Kontakt. Bei **Bereiche** nur die Standard-Bereiche (openid) lassen. Bei **App-Domain** Startseite `https://spiele.lipponer.de`, Datenschutz `https://spiele.lipponer.de/#/datenschutz`.
3. Den Status auf **In Produktion** stellen („App veröffentlichen“). Im Status „Testing“ dürfen sich nur eingetragene Testnutzer anmelden. ❓ Bei nur `openid` verlangt Google keine inhaltliche Prüfung der Bereiche.
4. **Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID**, Typ **Webanwendung**, Name „Brett & Blatt Worker“. Unter **Autorisierte Weiterleitungs-URIs** die zwei Adressen oben (Betrieb und lokal) eintragen. Erstellen.
5. Es erscheinen **Client-ID** und **Clientschlüssel**. Beides notieren (nicht teilen).
6. Im Repo-Ordner `apps/server`:
   ```
   corepack pnpm exec wrangler secret put GOOGLE_CLIENT_ID
   corepack pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   (Werte erst auf Nachfrage eintippen/einfügen.) Lokal zum Testen: in `apps/server/.dev.vars` (steht in `.gitignore`) `GOOGLE_CLIENT_ID=…` und `GOOGLE_CLIENT_SECRET=…`.

## B. Microsoft

1. Microsoft Entra Admin Center (entra.microsoft.com) mit einem Konto öffnen, das Apps registrieren darf (ein privates Microsoft-Konto reicht, dann liegt die App in einem persönlichen Verzeichnis; ❓ ggf. ein kostenloses Azure-Konto anlegen).
2. **Identität → Anwendungen → App-Registrierungen → Neue Registrierung**. Name „Brett & Blatt“. **Unterstützte Kontotypen:** „Konten in einem beliebigen Organisationsverzeichnis (beliebiger Microsoft Entra-Mandant – mehrinstanzenfähig) **und persönliche Microsoft-Konten** (z. B. Skype, Xbox)“. Umleitungs-URI: Plattform **Web**, `https://brett-und-blatt.lipponer.workers.dev/konto/microsoft/rueckruf`. Registrieren.
3. In **Authentifizierung** die lokale Adresse `http://localhost:8787/konto/microsoft/rueckruf` hinzufügen. Implizite Flüsse **nicht** aktivieren.
4. Auf der Übersichtsseite die **Anwendungs-ID (Client)** notieren.
5. **Zertifikate und Geheimnisse → Neuer geheimer Clientschlüssel**, Laufzeit so lang wie möglich (❓ höchstens 24 Monate). **Den Wert sofort kopieren** (er wird nur einmal angezeigt) – und dir den Ablauftermin notieren; danach geht die Anmeldung nicht mehr, bis ein neuer Schlüssel gesetzt ist.
6. **API-Berechtigungen:** nur die vorgegebene „User.Read“ ist da; für die Anmeldung braucht es nichts weiter (openid wird mit der Anmeldung eingeschlossen). Keine Administrator-Zustimmung erteilen.
7. Optional, später: **Branding & Eigenschaften** (Logo, Link zur Datenschutzerklärung `https://spiele.lipponer.de/#/datenschutz`); ein „bestätigter Herausgeber“ ist für `openid` nicht nötig ❓.
8. Secrets setzen:
   ```
   corepack pnpm exec wrangler secret put MS_CLIENT_ID
   corepack pnpm exec wrangler secret put MS_CLIENT_SECRET
   ```
   Lokal: `.dev.vars` mit `MS_CLIENT_ID=…` und `MS_CLIENT_SECRET=…`.

## C. Kontrolle

- `GET https://brett-und-blatt.lipponer.workers.dev/konto/google/start` ohne Secrets liefert 503 („Anbieter nicht eingerichtet“), mit Secrets die Weiterleitung.
- Im Pass erscheinen „Mit Google verknüpfen“ und „Mit Microsoft verknüpfen“ nur, wenn der jeweilige Anbieter eingerichtet ist (`GET /konto` meldet die Anbieter).
- Prüfen mit: einem privaten Google-Konto, einem privaten Microsoft-Konto und einem Schul- oder Arbeitskonto (Microsoft 365 oder Workspace). Wenn ein Schulkonto „Zustimmung des Administrators erforderlich“ zeigt, liegt das an der Mandanten-Einstellung der Schule, nicht an der App.
