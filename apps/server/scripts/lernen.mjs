// Rauchtest für geteilte Anki-Pakete (R2) und Klassen-Lernen (#224, L7).
// Aufruf (Server läuft, z. B. lokal mit `corepack pnpm --filter @brett-und-blatt/server dev`):
//   node apps/server/scripts/lernen.mjs [http://127.0.0.1:8787]

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const origin = 'http://localhost:5173';
let failures = 0;

function check(ok, text) {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures++;
}

console.log(`Starte L7-Rauchtest gegen ${base} …\n`);

// ---------------------------------------------------------------- 1. R2: Geteilte Pakete (/pakete/<id>)
console.log('--- Teil 1: R2-Ablage für Anki-Pakete ---');

const randomChars = (len) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
};

// Kennung auf dem Server, aus dem Linkschlüssel abgeleitet (32 Hex-Zeichen)
const shareId = async (key) => {
  const enc = new TextEncoder();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`brett-und-blatt/teilen/id\n${key}`)));
  return [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const passKey = randomChars(43);
const id = await shareId(passKey);
const secret = randomChars(43);
const dummyPackage = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode('Dummy-Anki-Paket-Daten-fuer-den-Rauchtest-12345')]);

// 1.1 Upload
const putRes = await fetch(`${base}/pakete/${id}`, {
  method: 'PUT',
  headers: {
    Origin: origin,
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(dummyPackage.length),
    'X-Geheimnis': secret,
  },
  body: dummyPackage,
});
check(putRes.status === 200, `Paket hochladen: PUT /pakete/${id} (Status ${putRes.status})`);

// 1.2 Download
const getRes = await fetch(`${base}/pakete/${id}`, {
  method: 'GET',
  headers: { Origin: origin },
});
const downloaded = new Uint8Array(await getRes.arrayBuffer());
const matches = downloaded.length === dummyPackage.length && downloaded.every((b, i) => b === dummyPackage[i]);
check(getRes.status === 200 && matches, `Paket abrufen: GET /pakete/${id} (Inhalt stimmt überein)`);

// 1.3 Falsches Geheimnis beim Überschreiben
const badSecret = randomChars(43);
const badPutRes = await fetch(`${base}/pakete/${id}`, {
  method: 'PUT',
  headers: {
    Origin: origin,
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(dummyPackage.length),
    'X-Geheimnis': badSecret,
  },
  body: dummyPackage,
});
check(badPutRes.status === 401, `Falsches Geheimnis wird abgewiesen: Status ${badPutRes.status}`);

// 1.4 Löschen mit korrektem Geheimnis
const delRes = await fetch(`${base}/pakete/${id}/loeschen`, {
  method: 'POST',
  headers: { Origin: origin, 'X-Geheimnis': secret },
});
check(delRes.status === 200, `Paket löschen: POST /pakete/${id}/loeschen (Status ${delRes.status})`);

// 1.5 Abruf nach Löschen
const getAfterDel = await fetch(`${base}/pakete/${id}`, {
  method: 'GET',
  headers: { Origin: origin },
});
check(getAfterDel.status === 404, `Abruf nach Löschen liefert 404 (Status ${getAfterDel.status})`);

// ---------------------------------------------------------------- 2. Klassenpakete, fällige Karten und Lernstand
console.log('\n--- Teil 2: Klasse, Pakete, fällige Karten und Lernstand ---');

const leadToken = `lead-${randomChars(16)}`;
const m1Token = `m1-${randomChars(16)}`;
const m2Token = `m2-${randomChars(16)}`;
const m3Token = `m3-${randomChars(16)}`;

const classAct = async (code, token, action, extra = {}) => {
  const res = await fetch(`${base}/klassen/${encodeURIComponent(code)}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data };
};

// 2.1 Klasse erstellen
const createClassRes = await fetch(`${base}/klassen`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: leadToken, name: 'Lehrkraft', avatar: '🦉', className: 'Latein 7b' }),
});
const classCreated = await createClassRes.json();
const classCode = classCreated.code;
check(createClassRes.status === 201 && typeof classCode === 'string', `Klasse erstellt: Code ${classCode}`);

// 2.2 Leitung aktiviert Lernstand und hinterlegt ECDH-Schlüssel (86..90 Base64url Zeichen)
const configureLearning = await classAct(classCode, leadToken, 'configure', { learning: true });
check(configureLearning.ok && configureLearning.view?.learning === true, 'Leitung aktiviert Lernstand (configure)');

const fakeLeadPub = randomChars(87);
const leadKeyRes = await classAct(classCode, leadToken, 'leadKey', { key: fakeLeadPub });
check(
  leadKeyRes.ok && leadKeyRes.view?.leadKeys?.some((k) => k.key === fakeLeadPub),
  'Leitung hinterlegt Schlüssel (leadKey)',
);

// 2.3 Leitung lädt Paket hoch und legt es in die Klasse
const classPackKey = randomChars(43);
const classPackId = await shareId(classPackKey);
const classPackSecret = randomChars(32);
await fetch(`${base}/pakete/${classPackId}`, {
  method: 'PUT',
  headers: {
    Origin: origin,
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(dummyPackage.length),
    'X-Geheimnis': classPackSecret,
  },
  body: dummyPackage,
});

const addPackRes = await classAct(classCode, leadToken, 'addPack', { name: 'Latein Grundwortschatz', key: classPackKey });
check(
  addPackRes.ok && addPackRes.view?.packs?.length === 1 && addPackRes.view.packs[0].name === 'Latein Grundwortschatz',
  'Leitung legt Paket in die Klasse (addPack)',
);

// 2.4 Drei Schüler treten bei
const s1Join = await classAct(classCode, m1Token, 'join', { name: 'Anna', avatar: '🦊' });
const s2Join = await classAct(classCode, m2Token, 'join', { name: 'Ben', avatar: '🐻' });
const s3Join = await classAct(classCode, m3Token, 'join', { name: 'Clara', avatar: '🐱' });
check(
  s1Join.ok && s2Join.ok && s3Join.ok && s1Join.view?.packs?.[0]?.key === classPackKey,
  'Drei Schüler treten bei und sehen das Klassenpaket',
);

// 2.5 Fällige Karten: Leitung aktiviert dueCards
const enableDue = await classAct(classCode, leadToken, 'configure', { dueCards: true });
check(enableDue.ok && enableDue.view?.dueCards === true, 'Leitung aktiviert fällige Karten');

// Schüler 1 & 2 melden fällige Karten
await classAct(classCode, m1Token, 'due', { cards: ['guid-vokabel-1', 'guid-vokabel-2'] });
await classAct(classCode, m2Token, 'due', { cards: ['guid-vokabel-1', 'guid-vokabel-3'] });

// Bei 2 Meldungen (< 3) bleibt die aggregierte Liste leer (Anonymitätsschutz)
const dueQuery2 = await classAct(classCode, leadToken, 'dueCards');
check(
  dueQuery2.ok && (!dueQuery2.cards || dueQuery2.cards.length === 0),
  'Bei 2 Meldungen (< 3) bleibt die aggregierte Liste für die Leitung leer (Anonymitätsschutz)',
);

// Schüler 3 meldet fällige Karten (Schwelle >= 3 erreicht)
await classAct(classCode, m3Token, 'due', { cards: ['guid-vokabel-1', 'guid-vokabel-4'] });
const dueQuery3 = await classAct(classCode, leadToken, 'dueCards');
const topCard = dueQuery3.cards?.find((d) => d.card === 'guid-vokabel-1');
check(
  dueQuery3.ok && topCard && topCard.n === 3,
  'Ab 3 Meldungen erscheint guid-vokabel-1 mit Zähler 3 in aggregateDue',
);

// Schüler 1 widerruft Meldung (leere Liste)
await classAct(classCode, m1Token, 'due', { cards: [] });
const dueQueryAfterRevoke = await classAct(classCode, leadToken, 'dueCards');
check(
  dueQueryAfterRevoke.ok && (!dueQueryAfterRevoke.cards || dueQueryAfterRevoke.cards.length === 0),
  'Nach Widerruf von Schüler 1 fällt Meldungszahl unter 3: Liste wieder leer',
);

// 2.6 Verschlüsselter Lernstand
const dummyEncrypted = 'blob-verschluesselter-lernstand-von-anna-12345';
const progressRes = await classAct(classCode, m1Token, 'progress', { blob: dummyEncrypted });
check(progressRes.ok, 'Schüler 1 sendet verschlüsselten Lernstand (progress)');

// Leitung ruft Lernstände ab
const getProgressRes = await classAct(classCode, leadToken, 'getProgress');
const s1Id = s1Join.view?.me;
const s1Entry = getProgressRes.progress?.find((p) => p.id === s1Id);
check(
  getProgressRes.ok && s1Entry?.blob === dummyEncrypted,
  'Leitung ruft verschlüsselten Lernstand ab (getProgress)',
);

// Schüler 1 widerruft Lernstand (blob: '')
const revokeProgRes = await classAct(classCode, m1Token, 'progress', { blob: '' });
check(revokeProgRes.ok, 'Schüler 1 widerruft Lernstand');

const getAfterRevoke = await classAct(classCode, leadToken, 'getProgress');
const s1AfterRevoke = getAfterRevoke.progress?.find((p) => p.id === s1Id);
check(getAfterRevoke.ok && !s1AfterRevoke, 'Nach Widerruf liefert getProgress keinen Stand mehr');

// 2.7 Paket wieder entfernen
const packId = addPackRes.view.packs[0].id;
const removePackRes = await classAct(classCode, leadToken, 'removePack', { id: packId });
check(removePackRes.ok && removePackRes.view?.packs?.length === 0, 'Leitung entfernt Paket aus der Klasse (removePack)');

// R2-Paket aufräumen
await fetch(`${base}/pakete/${classPackId}/loeschen`, {
  method: 'POST',
  headers: { Origin: origin, 'X-Geheimnis': classPackSecret },
});

console.log(`\nFertig: ${failures === 0 ? 'Alle Tests erfolgreich!' : `${failures} Fehler aufgetreten!`}`);
process.exit(failures === 0 ? 0 : 1);
