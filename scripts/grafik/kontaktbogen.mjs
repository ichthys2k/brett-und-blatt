#!/usr/bin/env node
// Baut grafik-roh/<Manifest>/kontaktbogen.html: alle Varianten auf einer Seite zur Auswahl.
// Im Browser öffnen: Bild anklicken = genehmigen, „↻ Neue Version“ = weitere Variante wünschen.
// Reihenfolge: zuerst ungeprüfte Motive (Bilder da, noch nicht übernommen), dann übernommene, dann Motive ohne Bilder.
// Unten stehen die Zeilen für übernehmen.mjs und (für gewünschte Neuerzeugungen) erzeugen.mjs.
//   --modell=… --schluessel=…   werden in die erzeugen.mjs-Zeile übernommen (mit --ja, die Kosten sind bekannt)
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { argumente, ladeManifest, ordner, WURZEL } from './gemeinsam.mjs';

const { positionen, optionen } = argumente(process.argv.slice(2));
const manifest = ladeManifest(positionen[0]);
const basis = ordner(manifest.name);
const zusatz = [optionen.schluessel && `--schluessel=${optionen.schluessel}`, optionen.modell && `--modell=${optionen.modell}`, optionen.schluessel === 'bezahlt' && '--ja'].filter(Boolean).join(' ');
const zielDir = manifest.ziel ? resolve(WURZEL, manifest.ziel) : null;
const istUebernommen = (id) => zielDir && existsSync(resolve(zielDir, `${manifest.praefix ?? ''}${id}${manifest.suffix ?? ''}.webp`));
const abschnitte = { ungeprueft: [], uebernommen: [], leer: [] };
manifest.motive.forEach((m) => {
  const dir = resolve(basis, m.id);
  const dateien = existsSync(dir) ? readdirSync(dir).filter((d) => /^(cf-)?v\d+\.(png|jpg)$/.test(d)).sort() : [];
  const bilder = dateien.map((d) => {
    const fremd = d.startsWith('cf-'); // Cloudflare-Bilder nur zum Vergleich, nicht wählbar
    return `<figure${fremd ? ' class="fremd"' : ''}><img src="${m.id}/${d}" ${fremd ? '' : `data-id="${m.id}" data-v="${d.match(/^v(\d+)/)[1]}" `}loading="lazy"><figcaption>${fremd ? 'Cloudflare' : 'Gemini'} ${d.match(/v(\d+)/)[1]}</figcaption></figure>`;
  }).join('');
  const gruppe = !dateien.some((d) => !d.startsWith('cf-')) ? 'leer' : istUebernommen(m.id) ? 'uebernommen' : 'ungeprueft';
  abschnitte[gruppe].push(`<section><h2>${m.titel ?? m.id} <small>${m.id}</small> <button data-neu="${m.id}" data-n="${dateien.filter((d) => !d.startsWith('cf-')).reduce((n, d) => Math.max(n, Number(d.match(/v(\d+)/)[1])), 0)}">↻ Neue Version</button></h2>${m.beschreibung ? `<p class="funktion">${m.beschreibung}</p>` : ''}<div>${bilder || '<em>noch keine Bilder</em>'}</div></section>`);
});
const kopf = (titel, n) => `<h1>${titel} <small>(${n})</small></h1>`;
const zeilen = [
  abschnitte.ungeprueft.length && kopf('Ungeprüft', abschnitte.ungeprueft.length), ...abschnitte.ungeprueft,
  abschnitte.uebernommen.length && kopf('Schon übernommen', abschnitte.uebernommen.length), ...abschnitte.uebernommen,
  abschnitte.leer.length && kopf('Noch ohne Bilder', abschnitte.leer.length), ...abschnitte.leer,
].filter(Boolean);
const html = `<!doctype html><meta charset="utf-8"><title>${manifest.name}</title>
<style>body{font:14px system-ui;background:#1c1712;color:#eee;margin:16px}h1{margin:28px 0 0;padding-top:10px;border-top:2px solid #e6b422;font-size:20px}h2{margin:18px 0 6px}small{opacity:.6;font-weight:400}.funktion{margin:0 0 8px;color:#e6c86e;max-width:70em}
div{display:flex;gap:8px;flex-wrap:wrap}figure{margin:0}figcaption{font-size:12px;opacity:.7;text-align:center}figure.fremd img{cursor:default}img{height:320px;border:4px solid transparent;border-radius:6px;cursor:pointer}
img.gewaehlt{border-color:#e6b422}button{font:inherit;font-size:12px;margin-left:8px;cursor:pointer}button.an{background:#e6b422;color:#000}pre{position:sticky;bottom:0;background:#000;padding:10px;white-space:pre-wrap}</style>
${zeilen.join('\n')}
<pre id="aus">Bilder anklicken, um sie zu wählen …</pre>
<script>
const wahl={},neu={};
function zeige(){
 const u=Object.entries(wahl).map(([k,v])=>k+'='+v).join(' ');
 const gruppen={};Object.entries(neu).forEach(([id,n])=>{(gruppen[n+1]=gruppen[n+1]||[]).push(id)});
 const e=Object.entries(gruppen).map(([n,ids])=>'node scripts/grafik/erzeugen.mjs ${positionen[0]} --varianten='+n+' --nur='+ids.join(',')+'${zusatz ? ' ' + zusatz : ''}');
 const z=[];if(u)z.push('node scripts/grafik/uebernehmen.mjs ${positionen[0]} '+u);
 if(e.length)z.push('# Neue Version gewünscht, danach Kontaktbogen neu bauen:',...e,'node scripts/grafik/kontaktbogen.mjs ${positionen[0]}${zusatz.replace(' --ja', '') ? ' ' + zusatz.replace(' --ja', '') : ''}');
 document.getElementById('aus').textContent=z.join('\\n')||'Bild anklicken = genehmigen, „Neue Version“ = weitere Variante …';}
document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-neu]');
 if(b){const id=b.dataset.neu;if(id in neu){delete neu[id];b.classList.remove('an')}else{neu[id]=Number(b.dataset.n);b.classList.add('an')}return zeige()}
 const i=e.target.closest('img');if(!i||!i.dataset.id)return;
 document.querySelectorAll('img[data-id="'+i.dataset.id+'"]').forEach(x=>x.classList.remove('gewaehlt'));
 if(wahl[i.dataset.id]===i.dataset.v)delete wahl[i.dataset.id];else{wahl[i.dataset.id]=i.dataset.v;i.classList.add('gewaehlt')}
 zeige()});
</script>`;
writeFileSync(resolve(basis, 'kontaktbogen.html'), html);
console.log('Geschrieben:', resolve(basis, 'kontaktbogen.html'));
