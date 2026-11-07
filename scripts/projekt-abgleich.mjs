#!/usr/bin/env node
// Abgleich zwischen den Labels der Issues und den Feldern im GitHub-Projekt
// „Brett & Blatt – Planung“ – in beide Richtungen, die jüngere Änderung gewinnt.
//
// Je Achse (Status, Priorität, Bereich) wird verglichen:
//   - wann das Projekt-Feld zuletzt gesetzt wurde (updatedAt des Feldwerts) und
//   - wann zuletzt ein Label dieser Achse gesetzt oder entfernt wurde
//     (bei Status zählt auch Schließen/Wiederöffnen).
// Ist das Feld jünger, werden die Labels angepasst (bei Status „Fertig“ wird das
// Issue geschlossen, bei Status ≠ „Fertig“ an einem geschlossenen Issue wieder
// geöffnet). Sonst – und wenn das Feld leer ist – wird das Feld aus den Labels
// gesetzt. Neue Issues kommen ins Projekt; das Archiv (Label „context“) nicht.
//
// Aufruf: PROJECT_TOKEN=… ISSUES_TOKEN=… node scripts/projekt-abgleich.mjs [Issue-Nummer]
//   PROJECT_TOKEN: klassischer Token mit Recht „project“ (Projekt lesen/schreiben)
//   ISSUES_TOKEN:  darf Issues bearbeiten (in der Action: GITHUB_TOKEN); fehlt er,
//                  wird nur in Richtung Projekt abgeglichen
//   PROJEKT_PROBE=1: nur anzeigen, was sich ändern würde

const OWNER = process.env.PROJECT_OWNER ?? 'ichthys2k';
const REPO = process.env.PROJECT_REPO ?? 'brett-und-blatt';
const NUMBER = Number(process.env.PROJECT_NUMBER || '0');
const PROJECT_TOKEN = process.env.PROJECT_TOKEN ?? '';
const ISSUES_TOKEN = process.env.ISSUES_TOKEN ?? '';
const DRY = process.env.PROJEKT_PROBE === '1';
const ONLY = process.argv[2] ? Number(process.argv[2]) : null;

// Label ↔ Feldwert. Reihenfolge = Vorrang, falls mehrere Labels einer Achse.
const AXES = {
  Status: [
    ['status: Done', 'Fertig'],
    ['status: Review', 'Review'],
    ['status: In progress', 'In Arbeit'],
    ['status: Ready', 'Ready'],
    ['status: Zurückgestellt', 'Zurückgestellt'],
    ['status: Idee', 'Idee'],
  ],
  Priorität: [
    ['prio: hoch', 'hoch'],
    ['prio: mittel', 'mittel'],
    ['prio: niedrig', 'niedrig'],
  ],
  Bereich: [
    ['bereich: Online', 'Online'],
    ['bereich: Klang & Musik', 'Klang & Musik'],
    ['bereich: Oberfläche', 'Oberfläche'],
    ['bereich: Neues Spiel', 'Neues Spiel'],
    ['bereich: Technik', 'Technik'],
  ],
};
const PREFIX = { Status: 'status: ', Priorität: 'prio: ', Bereich: 'bereich: ' };

async function gql(token, query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data;
}

async function rest(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `bearer ${ISSUES_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
}

async function loadProject() {
  const data = await gql(
    PROJECT_TOKEN,
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
  for (const f of project.fields.nodes) if (f?.name && AXES[f.name]) fields[f.name] = f;
  for (const name of Object.keys(AXES)) if (!fields[name]) throw new Error(`Feld „${name}“ fehlt im Projekt`);
  return { id: project.id, fields };
}

const ISSUE_FIELDS = `id number state labels(first:30){ nodes{ name } }
  timelineItems(last:60, itemTypes:[LABELED_EVENT, UNLABELED_EVENT, CLOSED_EVENT, REOPENED_EVENT]){ nodes{
    __typename
    ... on LabeledEvent { createdAt label { name } }
    ... on UnlabeledEvent { createdAt label { name } }
    ... on ClosedEvent { createdAt }
    ... on ReopenedEvent { createdAt } } }
  projectItems(first:10){ nodes{ id project{ id }
    fieldValues(first:20){ nodes{ ... on ProjectV2ItemFieldSingleSelectValue { name updatedAt field{ ... on ProjectV2SingleSelectField { name } } } } } } }`;

async function loadIssues() {
  if (ONLY) {
    const data = await gql(
      PROJECT_TOKEN,
      `query($owner:String!,$repo:String!,$n:Int!){ repository(owner:$owner,name:$repo){ issue(number:$n){ ${ISSUE_FIELDS} } } }`,
      { owner: OWNER, repo: REPO, n: ONLY },
    );
    return data.repository.issue ? [data.repository.issue] : [];
  }
  const issues = [];
  for (const states of [['OPEN'], ['CLOSED']]) {
    let after = null;
    do {
      const data = await gql(
        PROJECT_TOKEN,
        `query($owner:String!,$repo:String!,$states:[IssueState!],$after:String){ repository(owner:$owner,name:$repo){
          issues(first:25,states:$states,after:$after,orderBy:{field:UPDATED_AT,direction:DESC}){
            pageInfo{ hasNextPage endCursor } nodes{ ${ISSUE_FIELDS} } } } }`,
        { owner: OWNER, repo: REPO, states, after },
      );
      const page = data.repository.issues;
      issues.push(...page.nodes);
      // Geschlossene nur die jüngsten 25 – ältere sind längst abgeglichen.
      after = states[0] === 'OPEN' && page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
  }
  return issues;
}

/** Wert einer Achse aus den Labels (bei Status: geschlossen = „Fertig“). */
function fromLabels(axis, issue) {
  if (axis === 'Status' && issue.state === 'CLOSED') return 'Fertig';
  const names = issue.labels.nodes.map((l) => l.name);
  return AXES[axis].find(([label]) => names.includes(label))?.[1] ?? null;
}

/** Zeitpunkt der letzten Label-Änderung dieser Achse (ms seit 1970, 0 = nie). */
function labelTime(axis, issue) {
  let latest = 0;
  for (const e of issue.timelineItems.nodes) {
    const isAxis =
      e.label?.name?.startsWith(PREFIX[axis]) ||
      (axis === 'Status' && (e.__typename === 'ClosedEvent' || e.__typename === 'ReopenedEvent'));
    if (isAxis) latest = Math.max(latest, Date.parse(e.createdAt));
  }
  return latest;
}

const log = (msg) => console.log(msg);

async function setField(project, item, axis, value) {
  const field = project.fields[axis];
  if (DRY) return;
  if (value === null) {
    await gql(PROJECT_TOKEN,
      `mutation($p:ID!,$i:ID!,$f:ID!){ clearProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f}){ clientMutationId } }`,
      { p: project.id, i: item.id, f: field.id });
    return;
  }
  const option = field.options.find((o) => o.name === value);
  if (!option) throw new Error(`Option „${value}“ fehlt im Feld „${axis}“`);
  await gql(PROJECT_TOKEN,
    `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ clientMutationId } }`,
    { p: project.id, i: item.id, f: field.id, o: option.id });
}

/** Labels (und ggf. Offen/Geschlossen) nach dem Projekt-Feld richten. */
async function setLabels(issue, axis, value, shown) {
  const label = AXES[axis].find(([, v]) => v === value)?.[0];
  const names = issue.labels.nodes.map((l) => l.name);
  // Status und Priorität: genau ein Label. Bereich: nur das bisher angezeigte ersetzen.
  const remove =
    axis === 'Bereich'
      ? AXES.Bereich.filter(([, v]) => v === shown).map(([l]) => l)
      : names.filter((n) => n.startsWith(PREFIX[axis]));
  if (DRY) return;
  for (const l of remove) if (l !== label) await rest('DELETE', `/issues/${issue.number}/labels/${encodeURIComponent(l)}`);
  if (label && !names.includes(label)) await rest('POST', `/issues/${issue.number}/labels`, { labels: [label] });
  if (axis === 'Status') {
    if (value === 'Fertig' && issue.state === 'OPEN') await rest('PATCH', `/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    if (value !== 'Fertig' && issue.state === 'CLOSED') await rest('PATCH', `/issues/${issue.number}`, { state: 'open' });
  }
}

async function main() {
  if (!PROJECT_TOKEN) {
    log('Kein PROJECT_TOKEN gesetzt – Abgleich übersprungen.');
    return;
  }
  const project = await loadProject();
  const issues = await loadIssues();
  let toProject = 0;
  let toLabels = 0;
  for (const issue of issues) {
    if (issue.labels.nodes.some((l) => l.name === 'context')) continue; // Archiv gehört nicht aufs Board
    let item = issue.projectItems.nodes.find((n) => n.project.id === project.id);
    const current = {};
    for (const v of item?.fieldValues.nodes ?? []) if (v?.field?.name) current[v.field.name] = v;
    if (!item) {
      log(`#${issue.number}: ins Projekt aufnehmen`);
      toProject++;
      if (DRY) item = { id: null };
      else {
        const data = await gql(PROJECT_TOKEN,
          `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`,
          { p: project.id, c: issue.id });
        item = data.addProjectV2ItemById.item;
      }
    }
    for (const axis of Object.keys(AXES)) {
      const fieldValue = current[axis]?.name ?? null;
      const labelValue = fromLabels(axis, issue);
      if (fieldValue === labelValue) continue;
      const fieldNewer =
        fieldValue !== null && ISSUES_TOKEN && Date.parse(current[axis].updatedAt) > labelTime(axis, issue);
      if (fieldNewer) {
        log(`#${issue.number}: ${axis} im Projekt geändert (${labelValue ?? '–'} → ${fieldValue}) – Labels angepasst`);
        toLabels++;
        await setLabels(issue, axis, fieldValue, labelValue);
      } else {
        log(`#${issue.number}: ${axis} ${fieldValue ?? '–'} → ${labelValue ?? '–'} (aus Labels)`);
        toProject++;
        await setField(project, item, axis, labelValue);
      }
    }
  }
  log(`${issues.length} Issues geprüft: ${toProject} Änderungen im Projekt, ${toLabels} an Labels${DRY ? ' (nur Probe)' : ''}.`);
}

main().catch((error) => {
  console.error(`Abgleich fehlgeschlagen: ${error.message}`);
  process.exit(1);
});
