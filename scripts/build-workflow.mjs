// Builds workflow/ea-outreach.n8n.json from the Code node sources in src/nodes.
// Run: node scripts/build-workflow.mjs
// Keeping the JavaScript in real .js files means it can be linted, tested and diffed in Git.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f) => readFileSync(join(root, 'src/nodes', f), 'utf8');

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'REPLACE_ME', name: 'Google Sheets account' } };
const CLAUDE_CRED = { httpHeaderAuth: { id: 'REPLACE_ME', name: 'Anthropic API Key' } };
const sheetDoc = { __rl: true, value: "={{ $('Config').first().json.sheetId }}", mode: 'id' };
const tab = (name) => ({ __rl: true, value: name, mode: 'name' });

let n = 0;
const id = () => `node-${String(++n).padStart(2, '0')}`;

const codeNode = (name, file, pos, mode = 'runOnceForAllItems', extra = {}) => ({
  id: id(), name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos,
  parameters: { mode, jsCode: code(file) }, ...extra,
});

const readSheet = (name, tabName, pos, extra = {}) => ({
  id: id(), name, type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: pos,
  parameters: { documentId: sheetDoc, sheetName: tab(tabName), options: {} },
  credentials: SHEETS_CRED, alwaysOutputData: true, ...extra,
});

const schema = (cols) => cols.map((c) => ({
  id: c, displayName: c, required: false, defaultMatch: false, display: true,
  type: 'string', canBeUsedToMatch: true,
}));

const appendSheet = (name, tabName, cols, pos) => ({
  id: id(), name, type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: pos,
  parameters: {
    operation: 'append',
    documentId: sheetDoc,
    sheetName: tab(tabName),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: schema(cols) },
    options: { cellFormat: 'RAW' },
  },
  credentials: SHEETS_CRED,
});

const claudeCall = (name, pos) => ({
  id: id(), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
  parameters: {
    method: 'POST',
    url: 'https://api.anthropic.com/v1/messages',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'anthropic-version', value: '2023-06-01' },
      { name: 'content-type', value: 'application/json' },
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.requestBody) }}',
    options: { batching: { batch: { batchSize: 3, batchInterval: 2000 } }, timeout: 90000 },
  },
  credentials: CLAUDE_CRED,
  retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  onError: 'continueRegularOutput',
});

const ifNode = (name, field, pos) => ({
  id: id(), name, type: 'n8n-nodes-base.if', typeVersion: 2, position: pos,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [{
        id: `${name}-cond`, leftValue: `={{ $json.${field} }}`, rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
});

const sticky = (content, pos, width, height, color = 7) => ({
  id: id(), name: `Note ${n}`, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: pos,
  parameters: { content, width, height, color },
});

const JOB_COLS = ['Job Posting URL', 'Job Title', 'Company Name', 'Location', 'Job Description',
  'LLM-Generated Outreach Message', 'Status', 'Owner', 'Rep Notes', 'Date Posted', 'Date Added',
  'Source', 'Language Requirements', 'Validation Notes', 'Prompt Version'];
const REJECT_COLS = ['Job Posting URL', 'Job Title', 'Company Name', 'Location', 'Source', 'Rejected At',
  'Reason', 'Language Requirements', 'Date Checked'];

const nodes = [
  { id: id(), name: 'Daily Schedule', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * *' }] } } },
  { id: id(), name: 'Run Manually', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 200], parameters: {} },
  codeNode('Config', '01-config.js', [240, 100]),
  readSheet('Read Prompt Library', 'Prompts', [480, 100]),
  readSheet('Read Saved Jobs', 'Jobs', [720, 100], { executeOnce: true }),
  readSheet('Read Filtered Out', 'Filtered Out', [960, 100], { executeOnce: true }),
  codeNode('Fetch & Normalize Jobs', '02-fetch-jobs.js', [1200, 100], 'runOnceForAllItems', { executeOnce: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  codeNode('Rule Pre-Filter', '03-rule-filter.js', [1440, 100]),
  ifNode('Passed Rules?', 'passedRules', [1680, 100]),
  codeNode('Build Validation Request', '04-build-validation-request.js', [1920, -60], 'runOnceForEachItem'),
  claudeCall('Claude: Validate Job', [2160, -60]),
  codeNode('Parse Validation', '05-parse-validation.js', [2400, -60], 'runOnceForEachItem'),
  ifNode('Qualified?', 'qualified', [2640, -60]),
  codeNode('Build Outreach Request', '06-build-outreach-request.js', [2880, -200], 'runOnceForEachItem'),
  claudeCall('Claude: Write Outreach', [3120, -200]),
  codeNode('Format Sheet Row', '07-format-sheet-row.js', [3360, -200]),
  appendSheet('Save to Jobs Tab', 'Jobs', JOB_COLS, [3600, -200]),
  codeNode('Format Rejected Row', '08-format-rejected-row.js', [2880, 260]),
  appendSheet('Log to Filtered Out Tab', 'Filtered Out', REJECT_COLS, [3120, 260]),

  sticky('## 1. Setup and dedupe\nConfig holds every setting (Sheet ID, keywords, sources, models, limits).\nThe three Sheet reads load the prompt library and every URL already processed, so nothing is checked or messaged twice.',
    [200, -140], 940, 460, 7),
  sticky('## 2. Collect and pre-filter\nPublic APIs only: Remotive, Jobicy, Himalayas (no LinkedIn, no HTML scraping).\nRules drop obvious mismatches for free before any LLM call.',
    [1160, -140], 680, 460, 5),
  sticky('## 3. Claude validates\nForced tool use returns strict JSON: remote, English-speaking, relevant, plus personalisation details.',
    [1880, -260], 940, 380, 4),
  sticky('## 4. Claude writes outreach\nPrompt comes from the Sheet "Prompts" tab. Several Active rows = automatic A/B test.',
    [2840, -400], 940, 380, 6),
  sticky('## 5. Audit trail\nEvery rejected posting is logged with its reason in "Filtered Out".',
    [2840, 160], 520, 300, 3),
];

const c = (to, index = 0) => ({ node: to, type: 'main', index });
const connections = {
  'Daily Schedule': { main: [[c('Config')]] },
  'Run Manually': { main: [[c('Config')]] },
  'Config': { main: [[c('Read Prompt Library')]] },
  'Read Prompt Library': { main: [[c('Read Saved Jobs')]] },
  'Read Saved Jobs': { main: [[c('Read Filtered Out')]] },
  'Read Filtered Out': { main: [[c('Fetch & Normalize Jobs')]] },
  'Fetch & Normalize Jobs': { main: [[c('Rule Pre-Filter')]] },
  'Rule Pre-Filter': { main: [[c('Passed Rules?')]] },
  'Passed Rules?': { main: [[c('Build Validation Request')], [c('Format Rejected Row')]] },
  'Build Validation Request': { main: [[c('Claude: Validate Job')]] },
  'Claude: Validate Job': { main: [[c('Parse Validation')]] },
  'Parse Validation': { main: [[c('Qualified?')]] },
  'Qualified?': { main: [[c('Build Outreach Request')], [c('Format Rejected Row')]] },
  'Build Outreach Request': { main: [[c('Claude: Write Outreach')]] },
  'Claude: Write Outreach': { main: [[c('Format Sheet Row')]] },
  'Format Sheet Row': { main: [[c('Save to Jobs Tab')]] },
  'Format Rejected Row': { main: [[c('Log to Filtered Out Tab')]] },
};

const workflow = {
  name: 'RAY | EA Job Outreach Automation',
  nodes,
  connections,
  active: false,
  settings: { executionOrder: 'v1', timezone: 'UTC', saveManualExecutions: true, saveDataErrorExecution: 'all' },
  pinData: {},
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

writeFileSync(join(root, 'workflow/ea-outreach.n8n.json'), JSON.stringify(workflow, null, 2));
console.log(`Built workflow with ${nodes.length} nodes`);
