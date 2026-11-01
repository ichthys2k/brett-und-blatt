#!/usr/bin/env node
// Erzeugt Bildvarianten aus einem Manifest mit der Gemini-API.
//
//   GEMINI_API_KEY=… node scripts/grafik/erzeugen.mjs scripts/grafik/manifeste/bildkarten.json
//     --varianten=3   Varianten je Motiv (Standard 3)
//     --nur=k-h,d-s   nur diese Motive (Kennungen, kommagetrennt)
//     --modell=…      Bildmodell (Standard: GEMINI_BILDMODELL oder gemini-2.5-flash-image)
//     --pause=4       Sekunden Pause zwischen Anfragen (Standard 4)
//   node scripts/grafik/erzeugen.mjs --modelle   zeigt die Modelle, die dein Schlüssel kennt
//
// Vorhandenes wird übersprungen; bei Limits (429) wird gewartet und weitergemacht.
// Der Schlüssel steht nur in der Umgebung, nie im Repo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { argumente, ladeManifest, ordner, WURZEL } from './gemeinsam.mjs';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const { positionen, optionen } = argumente(process.argv.slice(2));
const schluessel = process.env.GEMINI_API_KEY;
if (!schluessel) {
  console.error('GEMINI_API_KEY fehlt. In der fish-Shell: set -x GEMINI_API_KEY <dein Schlüssel>');
  process.exit(1);
}

const schlafen = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function anfrage(pfad, body) {
  const antwort = await fetch(`${API}/${pfad}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-goog-api-key': schluessel, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await antwort.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { fehlerText: text }; }
  return { status: antwort.status, json };
}

if (optionen.modelle) {
  const { status, json } = await anfrage('models?pageSize=200');
  if (status !== 200) { console.error(status, JSON.stringify(json).slice(0, 400)); process.exit(1); }
  for (const m of json.models ?? []) {
    if (/image|imagen/i.test(m.name)) console.log(m.name.replace('models/', ''), '–', (m.supportedGenerationMethods ?? []).join(','));
  }
  process.exit(0);
}

const manifestPfad = positionen[0];
if (!manifestPfad) { console.error('Manifest angeben, siehe Kopf von erzeugen.mjs'); process.exit(1); }
const manifest = ladeManifest(manifestPfad);
const modell = optionen.modell ?? process.env.GEMINI_BILDMODELL ?? 'gemini-2.5-flash-image';
const varianten = Number(optionen.varianten ?? 3);
const pause = Number(optionen.pause ?? 4);
const nur = optionen.nur ? new Set(String(optionen.nur).split(',')) : null;

const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const referenzen = (manifest.referenzen ?? []).map((p) => {
  const voll = resolve(WURZEL, p);
  const endung = voll.split('.').pop().toLowerCase();
  return { inline_data: { mime_type: MIME[endung] ?? 'image/png', data: readFileSync(voll).toString('base64') } };
});

async function einBild(motiv, nr) {
  const ziel = resolve(ordner(manifest.name, motiv.id), `v${nr}.png`);
  if (existsSync(ziel)) return 'vorhanden';
  const text = [manifest.stil, motiv.prompt, manifest.ohne && `Vermeide: ${manifest.ohne}`].filter(Boolean).join('\n\n');
  const body = {
    contents: [{ parts: [...referenzen, { text }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: motiv.format ?? manifest.format ?? '4:5' },
    },
  };
  for (let versuch = 1; versuch <= 6; versuch++) {
    const { status, json } = await anfrage(`models/${modell}:generateContent`, body);
    if (status === 200) {
      const teile = json.candidates?.[0]?.content?.parts ?? [];
      const bild = teile.find((t) => (t.inlineData ?? t.inline_data)?.data);
      if (bild) {
        writeFileSync(ziel, Buffer.from((bild.inlineData ?? bild.inline_data).data, 'base64'));
        return 'neu';
      }
      return `kein Bild (${json.candidates?.[0]?.finishReason ?? json.promptFeedback?.blockReason ?? 'unbekannt'})`;
    }
    if (status === 429 || status >= 500) {
      const warte = Math.min(120, 15 * versuch);
      console.log(`  ${status}, warte ${warte} s (Versuch ${versuch}) …`);
      if (status === 429 && /limit:\s*0|free_tier/i.test(JSON.stringify(json))) {
        console.error('  Hinweis: Die Quote dieses Modells ist 0 (Gratis-Tarif ohne Bildmodell?). Abrechnung oder anderes Modell prüfen.');
      }
      await schlafen(warte);
      continue;
    }
    return `Fehler ${status}: ${JSON.stringify(json).slice(0, 300)}`;
  }
  return 'aufgegeben nach 6 Versuchen (erneut starten setzt fort)';
}

const motive = manifest.motive.filter((m) => !nur || nur.has(m.id));
console.log(`${manifest.name}: ${motive.length} Motive × ${varianten} Varianten, Modell ${modell}`);
let nummer = 0;
for (const motiv of motive) {
  for (let v = 1; v <= varianten; v++) {
    nummer++;
    const ergebnis = await einBild(motiv, v);
    console.log(`[${nummer}/${motive.length * varianten}] ${motiv.id} v${v}: ${ergebnis}`);
    if (ergebnis === 'neu') await schlafen(pause);
  }
}
console.log('Fertig. Weiter mit: node scripts/grafik/kontaktbogen.mjs', manifestPfad);
