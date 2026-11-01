#!/usr/bin/env node
// Baut grafik-roh/<Manifest>/kontaktbogen.html: alle Varianten auf einer Seite zur Auswahl.
// Im Browser öffnen, Favoriten anklicken; unten steht die Zeile für übernehmen.mjs.
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { argumente, ladeManifest, ordner } from './gemeinsam.mjs';

const { positionen } = argumente(process.argv.slice(2));
const manifest = ladeManifest(positionen[0]);
const basis = ordner(manifest.name);
const zeilen = manifest.motive.map((m) => {
  const dir = resolve(basis, m.id);
  const dateien = existsSync(dir) ? readdirSync(dir).filter((d) => /^v\d+\.png$/.test(d)).sort() : [];
  const bilder = dateien.map((d) => `<img src="${m.id}/${d}" data-id="${m.id}" data-v="${d.slice(1, -4)}" loading="lazy">`).join('');
  return `<section><h2>${m.titel ?? m.id} <small>${m.id}</small></h2>${m.beschreibung ? `<p class="funktion">${m.beschreibung}</p>` : ''}<div>${bilder || '<em>noch keine Bilder</em>'}</div></section>`;
});
const html = `<!doctype html><meta charset="utf-8"><title>${manifest.name}</title>
<style>body{font:14px system-ui;background:#1c1712;color:#eee;margin:16px}h2{margin:18px 0 6px}small{opacity:.6;font-weight:400}.funktion{margin:0 0 8px;color:#e6c86e;max-width:70em}
div{display:flex;gap:8px;flex-wrap:wrap}img{height:320px;border:4px solid transparent;border-radius:6px;cursor:pointer}
img.gewaehlt{border-color:#e6b422}pre{position:sticky;bottom:0;background:#000;padding:10px;white-space:pre-wrap}</style>
${zeilen.join('\n')}
<pre id="aus">Bilder anklicken, um sie zu wählen …</pre>
<script>
const wahl={};
document.addEventListener('click',e=>{const i=e.target.closest('img');if(!i)return;
 document.querySelectorAll('img[data-id="'+i.dataset.id+'"]').forEach(x=>x.classList.remove('gewaehlt'));
 if(wahl[i.dataset.id]===i.dataset.v)delete wahl[i.dataset.id];else{wahl[i.dataset.id]=i.dataset.v;i.classList.add('gewaehlt')}
 document.getElementById('aus').textContent='node scripts/grafik/uebernehmen.mjs ${positionen[0]} '+Object.entries(wahl).map(([k,v])=>k+'='+v).join(' ');});
</script>`;
writeFileSync(resolve(basis, 'kontaktbogen.html'), html);
console.log('Geschrieben:', resolve(basis, 'kontaktbogen.html'));
