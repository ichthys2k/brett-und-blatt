/*
 * Hinweise aufs Gerät (Web Push, #242). Wird per `workbox.importScripts` in den Service Worker der PWA geladen
 * (siehe vite.config.ts) und darf deshalb nichts importieren. Bewusst klein halten: Ein Fehler hier kann das
 * Registrieren des ganzen Service Workers und damit den Offline-Betrieb brechen.
 *
 * Der Inhalt einer Meldung ist nur { k: Art, u: Ziel } – keine Namen, keine Spielinhalte. Den sichtbaren Text
 * baut dieses Skript aus der Art.
 */
(function () {
  var TITLE = 'Brett & Blatt';
  var TEXTS = {
    matchCalled: 'Deine Turnierpartie ist bereit.',
    deadline: 'Die Frist deiner Partie läuft bald ab.',
    tournamentStarted: 'Das Turnier hat begonnen.',
    tournamentFinished: 'Das Turnier ist beendet.',
    yourTurn: 'Du bist am Zug.',
    boardYes: 'Jemand hat auf deinem Zettel „Bin dabei“ gesagt.',
    boardProposal: 'Ein Vorschlag am Schwarzen Brett wartet auf deine Zusage.',
    boardRoom: 'Dein Raum steht – komm herein!',
  };
  var FALLBACK = 'Es gibt etwas Neues.';
  // Ziel nur innerhalb der App: #/raum/<Code>, #/turnier/<Code> oder #/brett.
  var TARGET = /^#\/((raum|turnier)\/[^\s/?#]{1,40}|brett)$/;

  /** Sichtbarer Text zu einer Art; unbekannte Arten bekommen einen neutralen Text. */
  function pushText(kind) {
    return Object.prototype.hasOwnProperty.call(TEXTS, kind) ? TEXTS[kind] : FALLBACK;
  }

  /** Liest den Inhalt einer Meldung; Unbrauchbares ergibt neutrale Werte. */
  function parsePayload(event) {
    var data = null;
    try {
      data = event.data ? event.data.json() : null;
    } catch (e) {
      data = null;
    }
    var kind = data && typeof data.k === 'string' ? data.k : '';
    var url = data && typeof data.u === 'string' && TARGET.test(data.u) ? data.u : '';
    return { kind: kind, url: url };
  }

  function scopeUrl() {
    return self.registration && self.registration.scope ? self.registration.scope : '/';
  }

  function onPush(event) {
    var payload = parsePayload(event);
    var scope = scopeUrl();
    event.waitUntil(
      self.registration.showNotification(TITLE, {
        body: pushText(payload.kind),
        icon: scope + 'icons/icon-192.png',
        badge: scope + 'icons/icon-192.png',
        // Gleiche Sache ersetzt die ältere Meldung statt sich zu stapeln.
        tag: payload.kind + payload.url,
        data: { url: payload.url },
      }),
    );
  }

  function onClick(event) {
    event.notification.close();
    var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '';
    var scope = scopeUrl();
    var target = scope + url;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var client = list[i];
          if (client.url && client.url.indexOf(scope) === 0 && 'focus' in client) {
            return client.focus().then(function (focused) {
              return url && focused && 'navigate' in focused ? focused.navigate(target) : focused;
            });
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
      }),
    );
  }

  /** Der Browser hat das Abo erneuert oder verloren: neu abonnieren; die Seite meldet es beim nächsten Verbinden dem Server. */
  function onSubscriptionChange(event) {
    var options = event.oldSubscription && event.oldSubscription.options;
    if (!options) return;
    event.waitUntil(
      self.registration.pushManager
        .subscribe(options)
        .then(function () {
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        })
        .then(function (list) {
          list.forEach(function (client) {
            client.postMessage({ type: 'pushsubscriptionchange' });
          });
        })
        .catch(function () {
          // Ohne Berechtigung oder Netz geht es beim nächsten Öffnen der App weiter.
        }),
    );
  }

  if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
    self.addEventListener('push', onPush);
    self.addEventListener('notificationclick', onClick);
    self.addEventListener('pushsubscriptionchange', onSubscriptionChange);
  }
})();
