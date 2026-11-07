#!/usr/bin/env node
// Abgleich GitHub-Labels → Felder im GitHub-Projekt „Brett & Blatt – Planung“.
//
// Die Labels am Issue sind führend (Agenten und Vorlagen setzen sie). Dieses
// Skript nimmt jedes Issue ins Projekt auf und trägt daraus die Felder
// „Status“, „Priorität“ und „Bereich“ ein, damit Board und Tabellen
// gruppieren und sortieren können. In die Gegenrichtung (Board → Label)
// wird nichts geschrieben.
//
// Aufruf: PROJECT_TOKEN=… node scripts/projekt-abgleich.mjs [Issue-Nummer]
//   ohne Nummer: alle offenen und die zuletzt geschlossenen Issues
//   PROJEKT_PROBE=1: nur anzeigen, was sich ändern würde
// Der Schlüssel braucht das Recht „project“ (klassischer Token).

const OWNER = process.env.PROJECT_OWNER ?? 'ichthys2k';
const REPO = process.env.PROJECT_REPO ?? 'brett-und-blatt';
const NUMBER = Number(process.env.PROJECT_NUMBER ?? '0');
const TOKEN = process.env.PROJECT_TOKEN ?? process.env.GH_TOKEN ?? '';
const DRY = process.env.PROJEKT_PROBE === '1';
const ONLY = process.argv[2] ? Number(process.argv[2]) : null;

// Label → Feldwert. Reihenfolge = Vorrang, falls mehrere Labels einer Achse.
const STATUS = [
  ['status: Done', 'Fertig'],
  ['status: Review', 'Review'],
  ['status: In progress', 'In Arbeit'],
  ['status: Ready', 'Ready'],
  ['status: Zurückgestellt', 'Zurückgestellt'],
  ['status: Idee', 'Idee'],
];
const PRIO = [
  ['prio: hoch', 'hoch'],
  ['prio: mittel', 'mittel'],
  ['prio: niedrig', 'niedrig'],
];
const BEREICH = [
  ['bereich: Online', 'Online'],
  ['bereich: Klang & Musik', 'Klang & Musik'],
  ['bereich: Oberfläche', 'Oberfläche'],
  ['bereich: Neues Spiel', 'Neues Spiel'],
  ['bereich: Technik', 'Technik'],
];
const FIELDS = { Status: STATUS, Priorität: PRIO, Bereich: BEREICH };

async function gql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data;
}

/** Projekt finden: per Nummer oder per Titel. */
async function loadProject() {
  const data = await gql(
    `query($owner:String!){ user(login:$owner){ projectsV2(first:50){ nodes{ id number title
      fields(first:50){ nodes{ ... on ProjectV2SingleSelectField { id name options { id name } } } } } } } }`,
    { owner: OWNER },
  );
  const projects = data.user.projectsV2.nodes;
  const project = NUMBER
    ? projects.find((p) => p.number === NUMBER)
    : projects.find((p) => p.title === 'Brett & Blatt – Planung');
  if (!project) throw new Error('Projekt „Brett & Blatt – Planung“ nicht gefunden');
  const fields = {};
  for (const f of project.fields.nodes) if (f?.name && FIELDS[f.name]) fields[f.name] = f;
  for (const name of Object.keys(FIELDS)) {
    if (!fields[name]) throw new Error(`Feld „${name}“ fehlt im Projekt`);
  }
  return { id: project.id, number: project.number, fields };
}

/** Issues des Repos mit Labels und – falls vorhanden – Projekt-Eintrag. */
async function loadIssues() {
  const issues = [];
  for (const states of [['OPEN'], ['CLOSED']]) {
    let after = null;
    do {
      const data = await gql(
        `query($owner:String!,$repo:String!,$states:[IssueState!],$after:String){ repository(owner:$owner,name:$repo){
          issues(first:50,states:$states,after:$after,orderBy:{field:UPDATED_AT,direction:DESC}){
            pageInfo{ hasNextPage endCursor }
            nodes{ id number state labels(first:30){ nodes{ name } }
              projectItems(first:10){ nodes{ id project{ id }
                fieldValues(first:20){ nodes{ ... on ProjectV2ItemFieldSingleSelectValue { name field{ ... on ProjectV2SingleSelectField { name } } } } } } } } } } }`,
        { owner: OWNER, repo: REPO, states, after },
      );
      const page = data.repository.issues;
      issues.push(...page.nodes);
      // Geschlossene nur die jüngsten 50 – ältere stehen längst auf „Fertig“.
      after = states[0] === 'OPEN' && page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
  }
  return ONLY ? issues.filter((i) => i.number === ONLY) : issues;
}

function wanted(issue) {
  const names = issue.labels.nodes.map((l) => l.name);
  const pick = (map) => map.find(([label]) => names.includes(label))?.[1] ?? null;
  return {
    Status: issue.state === 'CLOSED' ? 'Fertig' : pick(STATUS),
    Priorität: pick(PRIO),
    Bereich: pick(BEREICH),
  };
}

async function main() {
  if (!TOKEN) {
    console.log('Kein PROJECT_TOKEN gesetzt – Abgleich übersprungen.');
    return;
  }
  const project = await loadProject();
  const issues = await loadIssues();
  let changes = 0;
  for (const issue of issues) {
    if (issue.labels.nodes.some((l) => l.name === 'context')) continue; // Archiv gehört nicht aufs Board
    let item = issue.projectItems.nodes.find((n) => n.project.id === project.id);
    const current = {};
    for (const v of item?.fieldValues.nodes ?? []) if (v?.field?.name) current[v.field.name] = v.name;
    if (!item) {
      console.log(`#${issue.number}: ins Projekt aufnehmen`);
      changes++;
      if (DRY) item = { id: null };
      else {
        const data = await gql(
          `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`,
          { p: project.id, c: issue.id },
        );
        item = data.addProjectV2ItemById.item;
      }
    }
    const want = wanted(issue);
    for (const [name, value] of Object.entries(want)) {
      if ((current[name] ?? null) === value) continue;
      const field = project.fields[name];
      console.log(`#${issue.number}: ${name} ${current[name] ?? '–'} → ${value ?? '–'}`);
      changes++;
      if (DRY) continue;
      if (value === null) {
        await gql(
          `mutation($p:ID!,$i:ID!,$f:ID!){ clearProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f}){ clientMutationId } }`,
          { p: project.id, i: item.id, f: field.id },
        );
      } else {
        const option = field.options.find((o) => o.name === value);
        if (!option) throw new Error(`Option „${value}“ fehlt im Feld „${name}“`);
        await gql(
          `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ clientMutationId } }`,
          { p: project.id, i: item.id, f: field.id, o: option.id },
        );
      }
    }
  }
  console.log(`${issues.length} Issues geprüft, ${changes} Änderungen${DRY ? ' (nur Probe)' : ''}.`);
}

main().catch((error) => {
  console.error(`Abgleich fehlgeschlagen: ${error.message}`);
  process.exit(1);
});
