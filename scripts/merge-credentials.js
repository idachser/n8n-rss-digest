// Runs inside the n8n container (node - < scripts/merge-credentials.js).
// Import replaces nodes wholesale, so credentials attached in the UI would fall back to the
// placeholders from the repo; copy them over from the live workflows by node name.
const fs = require('fs');
const path = require('path');

const REPO = '/workflows';
const LIVE = '/tmp/deploy/live';
const OUT = '/tmp/deploy/out';

const readWorkflow = (file) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data) ? data[0] : data;
};

const live = new Map();
for (const f of fs.readdirSync(LIVE)) {
  const wf = readWorkflow(path.join(LIVE, f));
  live.set(wf.id, wf);
}

const repo = fs.readdirSync(REPO)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, wf: readWorkflow(path.join(REPO, f)) }));

// The editor can keep a stale credential on an HTTP node switched to "None"; copying it would
// make publishing fail on a credential that no longer exists.
const liveCredentials = (ln) => {
  if (!ln?.credentials) return null;
  if (ln.type === 'n8n-nodes-base.httpRequest') {
    const auth = ln.parameters?.authentication;
    if (!auth || auth === 'none') return null;
  }
  return ln.credentials;
};

// Repo placeholder id -> credential the user attached in the UI, learned from nodes present on
// both sides, so nodes added since the last deploy get the same credential instead of a placeholder.
const placeholders = new Map();
for (const { wf } of repo) {
  const current = live.get(wf.id);
  if (!current) continue;
  const liveNodes = new Map(current.nodes.map((n) => [n.name, n]));
  for (const node of wf.nodes) {
    const creds = liveCredentials(liveNodes.get(node.name));
    if (!creds || !node.credentials) continue;
    for (const [type, ref] of Object.entries(node.credentials)) {
      if (creds[type]) placeholders.set(`${type}:${ref.id}`, creds[type]);
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
const publish = [];
for (const { file: f, wf } of repo) {
  const current = live.get(wf.id);
  const liveNodes = new Map((current?.nodes ?? []).map((n) => [n.name, n]));
  for (const node of wf.nodes) {
    const ln = liveNodes.get(node.name);
    const creds = liveCredentials(ln);
    if (creds) {
      if (node.type === 'n8n-nodes-base.httpRequest') {
        node.parameters.authentication = ln.parameters.authentication;
        if (ln.parameters.genericAuthType) node.parameters.genericAuthType = ln.parameters.genericAuthType;
        if (ln.parameters.nodeCredentialType) node.parameters.nodeCredentialType = ln.parameters.nodeCredentialType;
      }
      node.credentials = creds;
    } else if (node.credentials) {
      for (const [type, ref] of Object.entries(node.credentials)) {
        const mapped = placeholders.get(`${type}:${ref.id}`);
        if (mapped) node.credentials[type] = mapped;
      }
    }
  }
  if (current && (current.activeVersionId || current.active)) publish.push(wf.id);
  fs.writeFileSync(path.join(OUT, f), JSON.stringify(wf));
  console.log(`${wf.id} ${wf.name}${publish.includes(wf.id) ? ' (publish)' : ''}`);
}
fs.writeFileSync('/tmp/deploy/publish.txt', publish.join('\n'));
