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

fs.mkdirSync(OUT, { recursive: true });
const publish = [];
for (const f of fs.readdirSync(REPO).filter((f) => f.endsWith('.json'))) {
  const wf = readWorkflow(path.join(REPO, f));
  const current = live.get(wf.id);
  if (current) {
    const liveNodes = new Map(current.nodes.map((n) => [n.name, n]));
    for (const node of wf.nodes) {
      const ln = liveNodes.get(node.name);
      if (!ln?.credentials) continue;
      if (node.type === 'n8n-nodes-base.httpRequest') {
        // The editor can keep a stale credential on a node switched to "None"; copying it would
        // make publishing fail on a credential that no longer exists.
        const auth = ln.parameters?.authentication;
        if (!auth || auth === 'none') continue;
        node.parameters.authentication = auth;
        if (ln.parameters.genericAuthType) node.parameters.genericAuthType = ln.parameters.genericAuthType;
        if (ln.parameters.nodeCredentialType) node.parameters.nodeCredentialType = ln.parameters.nodeCredentialType;
      }
      node.credentials = ln.credentials;
    }
    if (current.activeVersionId || current.active) publish.push(wf.id);
  }
  fs.writeFileSync(path.join(OUT, f), JSON.stringify(wf));
  console.log(`${wf.id} ${wf.name}${publish.includes(wf.id) ? ' (publish)' : ''}`);
}
fs.writeFileSync('/tmp/deploy/publish.txt', publish.join('\n'));
