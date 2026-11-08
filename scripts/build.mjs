import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');

// Stable ids keep re-imports updating the same workflow/nodes instead of creating duplicates.
const uuid = (seed) => {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const SOURCES_TABLE = 'rss_sources';
const SEEN_TABLE = 'rss_seen';
const table = (name) => ({ __rl: true, mode: 'name', value: name });

function workflow(id, name, nodes, edges) {
  const connections = {};
  for (const [from, to, output = 0] of edges) {
    const c = (connections[from] ??= { main: [] });
    while (c.main.length <= output) c.main.push([]);
    c.main[output].push({ node: to, type: 'main', index: 0 });
  }
  return {
    id,
    name,
    nodes: nodes.map((n) => ({ id: uuid(`${id}/${n.name}`), ...n })),
    connections,
    settings: { executionOrder: 'v1' },
    pinData: {},
    active: false,
  };
}

const code = (name, file, position, extra = {}) => ({
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
  parameters: { jsCode: src(file) },
  ...extra,
});

const getRows = (name, tableName, position, extra = {}) => ({
  name,
  type: 'n8n-nodes-base.dataTable',
  typeVersion: 1.1,
  position,
  parameters: {
    resource: 'row',
    operation: 'get',
    dataTableId: table(tableName),
    returnAll: true,
  },
  alwaysOutputData: true,
  ...extra,
});

const insertRows = (name, tableName, position) => ({
  name,
  type: 'n8n-nodes-base.dataTable',
  typeVersion: 1.1,
  position,
  parameters: {
    resource: 'row',
    operation: 'insert',
    dataTableId: table(tableName),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
    options: {},
  },
});

const deleteRows = (name, tableName, position, conditions, extra = {}) => ({
  name,
  type: 'n8n-nodes-base.dataTable',
  typeVersion: 1.1,
  position,
  parameters: {
    resource: 'row',
    operation: 'deleteRows',
    dataTableId: table(tableName),
    matchType: 'allConditions',
    filters: { conditions },
    options: {},
  },
  ...extra,
});

const ifTrue = (name, field, position) => ({
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{
        id: uuid(`${name}/cond`),
        leftValue: `={{ $json.${field} }}`,
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
});

const rssRead = (name, position, extra = {}) => ({
  name,
  type: 'n8n-nodes-base.rssFeedRead',
  typeVersion: 1.2,
  position,
  parameters: { url: '={{ $json.url }}', options: {} },
  onError: 'continueRegularOutput',
  ...extra,
});

const telegramSend = (name, position, additionalFields, extra = {}) => ({
  name,
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position,
  parameters: {
    chatId: '={{ $json.chatId }}',
    text: '={{ $json.text }}',
    additionalFields: { appendAttribution: false, disable_web_page_preview: true, ...additionalFields },
  },
  credentials: { telegramApi: { id: 'telegram-bot', name: 'Telegram RSS bot' } },
  ...extra,
});

const llmRequest = (name, position, url, headers, credential) => ({
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  parameters: {
    method: 'POST',
    url,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendHeaders: headers.length > 0,
    headerParameters: { parameters: headers },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.body) }}',
    options: { timeout: 600000 },
  },
  credentials: { httpHeaderAuth: credential },
  retryOnFail: true,
  maxTries: 2,
  waitBetweenTries: 30000,
});

const bot = workflow('rssDigestBot0001', 'RSS Digest — бот управления источниками', [
  {
    name: 'Telegram Trigger',
    type: 'n8n-nodes-base.telegramTrigger',
    typeVersion: 1.2,
    position: [0, 300],
    webhookId: uuid('bot/webhook'),
    parameters: {
      updates: ['message'],
      additionalFields: { userIds: '135656943' },
    },
    credentials: { telegramApi: { id: 'telegram-bot', name: 'Telegram RSS bot' } },
  },
  code('Parse command', 'bot/parse-command.js', [220, 300]),
  {
    name: 'Route',
    type: 'n8n-nodes-base.switch',
    typeVersion: 3.2,
    position: [440, 300],
    parameters: { mode: 'expression', numberOutputs: 4, output: '={{ $json.route }}' },
  },
  getRows('Get sources (add)', SOURCES_TABLE, [680, 0]),
  code('Check duplicate', 'bot/check-duplicate.js', [900, 0]),
  ifTrue('Is duplicate?', 'duplicate', [1120, 0]),
  rssRead('Try feed', [1340, 100], { alwaysOutputData: true }),
  code('Check feed', 'bot/check-feed.js', [1560, 100]),
  ifTrue('Feed OK?', 'ok', [1780, 100]),
  code('To source row', 'bot/to-source-row.js', [2000, 0]),
  insertRows('Save source', SOURCES_TABLE, [2220, 0]),
  code('Reply added', 'bot/reply-added.js', [2440, 0]),
  getRows('Get sources (remove)', SOURCES_TABLE, [680, 300]),
  code('Resolve source', 'bot/resolve-remove.js', [900, 300]),
  ifTrue('Found?', 'found', [1120, 300]),
  deleteRows('Delete source', SOURCES_TABLE, [1340, 260],
    [{ keyName: 'url', condition: 'eq', keyValue: '={{ $json.url }}' }],
    { alwaysOutputData: true }),
  code('Reply removed', 'bot/reply-removed.js', [1560, 260]),
  getRows('Get sources (list)', SOURCES_TABLE, [680, 500]),
  code('Format list', 'bot/format-list.js', [900, 500]),
  telegramSend('Reply', [2700, 300], {}),
], [
  ['Telegram Trigger', 'Parse command'],
  ['Parse command', 'Route'],
  ['Route', 'Get sources (add)', 0],
  ['Route', 'Get sources (remove)', 1],
  ['Route', 'Get sources (list)', 2],
  ['Route', 'Reply', 3],
  ['Get sources (add)', 'Check duplicate'],
  ['Check duplicate', 'Is duplicate?'],
  ['Is duplicate?', 'Reply', 0],
  ['Is duplicate?', 'Try feed', 1],
  ['Try feed', 'Check feed'],
  ['Check feed', 'Feed OK?'],
  ['Feed OK?', 'To source row', 0],
  ['Feed OK?', 'Reply', 1],
  ['To source row', 'Save source'],
  ['Save source', 'Reply added'],
  ['Reply added', 'Reply'],
  ['Get sources (remove)', 'Resolve source'],
  ['Resolve source', 'Found?'],
  ['Found?', 'Delete source', 0],
  ['Found?', 'Reply', 1],
  ['Delete source', 'Reply removed'],
  ['Reply removed', 'Reply'],
  ['Get sources (list)', 'Format list'],
  ['Format list', 'Reply'],
]);

const digest = workflow('rssDigestDaily01', 'RSS Digest — ежедневный дайджест', [
  {
    name: 'Schedule',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [0, 300],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 9 * * *' }] } },
  },
  code('Config', 'digest/config.js', [220, 300]),
  getRows('Get sources', SOURCES_TABLE, [440, 300]),
  code('Prepare sources', 'digest/prepare-sources.js', [660, 300]),
  rssRead('Read feeds', [880, 300]),
  code('Normalize', 'digest/normalize.js', [1100, 300]),
  getRows('Get seen links', SEEN_TABLE, [1320, 300], { executeOnce: true }),
  code('Filter new', 'digest/filter-new.js', [1540, 300]),
  code('Build request', 'digest/build-request.js', [1760, 300]),
  {
    name: 'Provider',
    type: 'n8n-nodes-base.switch',
    typeVersion: 3.2,
    position: [1980, 300],
    parameters: { mode: 'expression', numberOutputs: 2, output: "={{ $json.provider === 'gemini' ? 1 : 0 }}" },
  },
  llmRequest('Claude', [2200, 200], 'https://api.anthropic.com/v1/messages', [
    { name: 'anthropic-version', value: '2026-10-21' },
    { name: 'anthropic-beta', value: 'server-side-fallback-2026-07-01' },
  ], { id: 'anthropic-key', name: 'Anthropic API key' }),
  llmRequest('Gemini', [2200, 400],
    "=https://generativelanguage.googleapis.com/v1beta/models/{{ $('Config').first().json.geminiModel }}:generateContent",
    [], { id: 'gemini-key', name: 'Gemini API key' }),
  code('Format posts', 'digest/format-posts.js', [2420, 300]),
  // No retry: n8n retries a node with all its items, which would repost already-sent parts.
  telegramSend('Send to Telegram', [2640, 300], { parse_mode: 'HTML' }),
  code('Admin notice', 'digest/admin-notice.js', [1320, 520]),
  telegramSend('Notify admin', [1540, 520], {}, { onError: 'continueRegularOutput' }),
  code('Mark seen', 'digest/mark-seen.js', [2860, 300]),
  insertRows('Save seen links', SEEN_TABLE, [3080, 300]),
  deleteRows('Prune old seen', SEEN_TABLE, [3300, 300],
    [{
      keyName: 'createdAt',
      condition: 'lt',
      keyValue: "={{ $now.minus({ days: $('Config').first().json.seenRetentionDays }).toISO() }}",
    }],
    { executeOnce: true }),
], [
  ['Schedule', 'Config'],
  ['Config', 'Get sources'],
  ['Get sources', 'Prepare sources'],
  ['Prepare sources', 'Read feeds'],
  ['Read feeds', 'Normalize'],
  ['Normalize', 'Get seen links'],
  ['Normalize', 'Admin notice'],
  ['Admin notice', 'Notify admin'],
  ['Get seen links', 'Filter new'],
  ['Filter new', 'Build request'],
  ['Build request', 'Provider'],
  ['Provider', 'Claude', 0],
  ['Provider', 'Gemini', 1],
  ['Claude', 'Format posts'],
  ['Gemini', 'Format posts'],
  ['Format posts', 'Send to Telegram'],
  ['Send to Telegram', 'Mark seen'],
  ['Mark seen', 'Save seen links'],
  ['Save seen links', 'Prune old seen'],
]);

const createTable = (name, tableName, columns, position) => ({
  name,
  type: 'n8n-nodes-base.dataTable',
  typeVersion: 1.1,
  position,
  executeOnce: true,
  parameters: {
    resource: 'table',
    operation: 'create',
    tableName,
    columns: { column: columns.map((c) => ({ name: c, type: 'string' })) },
    options: { createIfNotExists: true },
  },
});

const setup = workflow('rssDigestSetup01', 'RSS Digest — создать таблицы (запустить 1 раз)', [
  {
    name: 'Run once',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [0, 300],
    parameters: {},
  },
  createTable('Create rss_sources', SOURCES_TABLE, ['url', 'title'], [220, 300]),
  createTable('Create rss_seen', SEEN_TABLE, ['link'], [440, 300]),
], [
  ['Run once', 'Create rss_sources'],
  ['Create rss_sources', 'Create rss_seen'],
]);

mkdirSync(join(root, 'workflows'), { recursive: true });
for (const [file, wf] of [['setup.json', setup], ['bot.json', bot], ['digest.json', digest]]) {
  writeFileSync(join(root, 'workflows', file), JSON.stringify(wf, null, 2) + '\n');
  console.log(`workflows/${file}: ${wf.nodes.length} nodes`);
}
