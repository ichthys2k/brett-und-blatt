#!/usr/bin/env node
// Erzeugt Bildvarianten aus einem Manifest mit der Gemini-API (oder Cloudflare Workers AI).
//
//   GEMINI_API_KEY=… node scripts/grafik/erzeugen.mjs scripts/grafik/manifeste/bildkarten.json
//     --varianten=3   Varianten je Motiv (Standard 3)
//     --nur=k-h,d-s   nur diese Motive (Kennungen, kommagetrennt)
//     --modell=…      Bildmodell (Standard: GEMINI_BILDMODELL oder gemini-3.1-flash-image)
//     --pause=4       Sekunden Pause zwischen Anfragen (Standard 4)
//     --anbieter=cloudflare   statt Gemini Cloudflare Workers AI (Standardmodell FLUX.1 schnell); braucht
//                     CLOUDFLARE_ACCOUNT_ID und CLOUDFLARE_API_TOKEN (Berechtigung „Workers AI“). Keine Referenzbilder,
//                     keine Verbote (FLUX kennt keinen Negativ-Prompt), festes Format; Dateien heißen cf-v<n>.<jpg|png>.
//   node scripts/grafik/erzeugen.mjs --modelle   zeigt die Modelle, die dein Schlüssel kennt
//
// Vorhandenes wird übersprungen; bei Limits (429) wird gewartet und weitergemacht.
// Der Schlüssel steht nur in der Umgebung, nie im Repo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { argumente, ladeManifest, ordner, WURZEL } from './gemeinsam.mjs';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const { positionen, optionen } = argumente(process.argv.slice(2));
const cloudflare = optionen.anbieter === 'cloudflare';
const schluessel = process.env.GEMINI_API_KEY;
if (!cloudflare && !schluessel) {
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

if (optionen.modelle && !cloudflare) {
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
const modell = optionen.modell ?? (cloudflare ? '@cf/black-forest-labs/flux-1-schnell' : process.env.GEMINI_BILDMODELL ?? 'gemini-3.1-flash-image');
const varianten = Number(optionen.varianten ?? 3);
const pause = Number(optionen.pause ?? 4);
const nur = optionen.nur ? new Set(String(optionen.nur).split(',')) : null;

const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const ladeReferenzen = (liste) =>
  (liste ?? []).map((p) => {
    const voll = resolve(WURZEL, p);
    const endung = voll.split('.').pop().toLowerCase();
    return { inline_data: { mime_type: MIME[endung] ?? 'image/png', data: readFileSync(voll).toString('base64') } };
  });
const referenzen = ladeReferenzen(manifest.referenzen);

async function einBild(motiv, nr) {
  const ziel = resolve(ordner(manifest.name, motiv.id), `v${nr}.png`);
  if (existsSync(ziel)) return 'vorhanden';
  // Ein Motiv darf eigenen Stil, eigene Referenzen und eigene Verbote mitbringen (z. B. ein Kartenrücken ohne Figuren).
  const eigeneReferenzen = motiv.referenzen ? ladeReferenzen(motiv.referenzen) : referenzen;
  const text = [motiv.stil ?? manifest.stil, motiv.prompt, (motiv.ohne ?? manifest.ohne) && `Vermeide: ${motiv.ohne ?? manifest.ohne}`].filter(Boolean).join('\n\n');
  const body = {
    contents: [{ parts: [...eigeneReferenzen, { text }] }],
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

// Cloudflare Workers AI: Text → Bild, Antwort {result:{image:<base64>}}. Keine Referenzbilder, kein Negativ-Prompt.
async function einBildCloudflare(motiv, nr) {
  const konto = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!konto || !token) return 'CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN fehlen';
  const basis = resolve(ordner(manifest.name, motiv.id), `cf-v${nr}`);
  if (existsSync(`${basis}.jpg`) || existsSync(`${basis}.png`)) return 'vorhanden';
  const prompt = [motiv.stil ?? manifest.stil, motiv.prompt].filter(Boolean).join('\n\n').slice(0, 2000);
  for (let versuch = 1; versuch <= 4; versuch++) {
    const antwort = await fetch(`https://api.cloudflare.com/client/v4/accounts/${konto}/ai/run/${modell}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, steps: 8 }),
    });
    const text = await antwort.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { fehlerText: text.slice(0, 300) }; }
    const base64 = json.result?.image;
    if (antwort.status === 200 && base64) {
      const daten = Buffer.from(base64, 'base64');
      writeFileSync(`${basis}.${daten[0] === 0xff ? 'jpg' : 'png'}`, daten);
      return 'neu';
    }
    if (antwort.status === 429 || antwort.status >= 500) {
      const warte = 20 * versuch;
      console.log(`  ${antwort.status}, warte ${warte} s (Versuch ${versuch}) …`);
      await schlafen(warte);
      continue;
    }
    return `Fehler ${antwort.status}: ${JSON.stringify(json).slice(0, 300)}`;
  }
  return 'aufgegeben nach 4 Versuchen (erneut starten setzt fort)';
}

const motive = manifest.motive.filter((m) => !nur || nur.has(m.id));
console.log(`${manifest.name}: ${motive.length} Motive × ${varianten} Varianten, Modell ${modell}${cloudflare ? ' (Cloudflare)' : ''}`);
let nummer = 0;
for (const motiv of motive) {
  for (let v = 1; v <= varianten; v++) {
    nummer++;
    const ergebnis = await (cloudflare ? einBildCloudflare(motiv, v) : einBild(motiv, v));
    console.log(`[${nummer}/${motive.length * varianten}] ${motiv.id} v${v}: ${ergebnis}`);
    if (ergebnis === 'neu') await schlafen(pause);
  }
}
console.log('Fertig. Weiter mit: node scripts/grafik/kontaktbogen.mjs', manifestPfad);
