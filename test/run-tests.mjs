// Offline test: runs every Code node exactly as n8n would, with mocked HTTP, Sheets and Claude.
// Run: node test/run-tests.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import * as fx from './fixtures.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const src = (f) => readFileSync(join(root, 'src/nodes', f), 'utf8');

// ---- minimal n8n Code node runtime ----
function makeRuntime(outputs) {
  const $ = (name) => {
    const items = outputs[name];
    if (!items) throw new Error(`Node "${name}" has not run`);
    return {
      first: () => items[0],
      all: () => items,
      itemMatching: (i) => items[i],
      get item() { return items[$.__index]; },
    };
  };
  return $;
}

async function runNode(file, outputs, inputItems, mode = 'all', httpMock) {
  const $ = makeRuntime(outputs);
  const ctx = { helpers: { httpRequest: httpMock || (async () => { throw new Error('no http in this node'); }) } };
  const fn = new AsyncFunction('$', '$input', '$json', src(file));
  if (mode === 'all') {
    const res = await fn.call(ctx, $, { all: () => inputItems, first: () => inputItems[0] }, inputItems[0]?.json);
    return res;
  }
  const out = [];
  for (let i = 0; i < inputItems.length; i++) {
    $.__index = i;
    const r = await fn.call(ctx, $, { item: inputItems[i] }, inputItems[i].json);
    if (r) out.push(Array.isArray(r) ? r[0] : r);
  }
  return out;
}

const httpMock = async ({ url, qs }) => {
  const term = qs.search || qs.tag || qs.keyword;
  if (url.includes('remotive')) return fx.remotive[term] || { jobs: [] };
  if (url.includes('jobicy')) return fx.jobicy[term] || { jobs: [] };
  if (url.includes('himalayas')) return fx.himalayas[term] || { jobs: [] };
  throw new Error('unexpected url ' + url);
};

function claudeValidate(item, { failFor } = {}) {
  const j = item.json;
  if (failFor && j.company === failFor) return { json: { error: { message: '529 Overloaded' } } };
  return { json: { content: [{ type: 'tool_use', name: 'record_assessment', input: {
    is_remote: true, remote_evidence: 'Fully remote role', is_english_speaking: true,
    language_requirements: 'Fluent English required; Spanish a plus', is_relevant: true,
    relevance_evidence: 'Supports the CEO / founder directly', executive_supported: 'CEO and co-founder',
    key_responsibilities: ['Manage CEO calendar across time zones', 'Coordinate board meetings', 'Book international travel'],
    tools_mentioned: ['Google Workspace', 'Notion', 'Slack'], confidence: 'high' } }] } };
}

async function pipeline({ failFor } = {}) {
  const o = {};
  o['Config'] = await runNode('01-config.js', o, [{ json: {} }]);
  o['Read Prompt Library'] = fx.promptRows.map((json) => ({ json }));
  o['Read Saved Jobs'] = fx.savedJobsRows.map((json) => ({ json }));
  o['Read Filtered Out'] = fx.filteredOutRows.map((json) => ({ json }));
  o['Fetch & Normalize Jobs'] = await runNode('02-fetch-jobs.js', o, o['Read Filtered Out'], 'all', httpMock);
  o['Rule Pre-Filter'] = await runNode('03-rule-filter.js', o, o['Fetch & Normalize Jobs']);
  const pass = o['Rule Pre-Filter'].filter((i) => i.json.passedRules);
  const fail = o['Rule Pre-Filter'].filter((i) => !i.json.passedRules);
  o['Build Validation Request'] = await runNode('04-build-validation-request.js', o, pass, 'each');
  o['Claude: Validate Job'] = o['Build Validation Request'].map((i) => claudeValidate(i, { failFor }));
  o['Parse Validation'] = await runNode('05-parse-validation.js', o, o['Claude: Validate Job'], 'each');
  const qualified = o['Parse Validation'].filter((i) => i.json.qualified);
  const notQualified = o['Parse Validation'].filter((i) => !i.json.qualified);
  o['Build Outreach Request'] = await runNode('06-build-outreach-request.js', o, qualified, 'each');
  o['Claude: Write Outreach'] = o['Build Outreach Request'].map((i) => ({ json: { content: [{ type: 'text',
    text: `Subject: A remote EA for ${i.json.company}\n\nHi team, saw you are hiring — we can help.` }] } }));
  o['Format Sheet Row'] = await runNode('07-format-sheet-row.js', o, o['Claude: Write Outreach']);
  const rejected = [
    ...(await runNode('08-format-rejected-row.js', o, fail)),
    ...(await runNode('08-format-rejected-row.js', o, notQualified)),
  ];
  return { o, rows: o['Format Sheet Row'], rejected };
}

// ---------- Scenario 1: happy path ----------
const { o, rows, rejected } = await pipeline();
const stats = o['Fetch & Normalize Jobs'][0].json._runStats;
console.log('Fetch stats:', stats);

assert.equal(stats.alreadyInSheet, 1, 'skips URL already in Jobs tab');
assert.equal(stats.tooOld, 1, 'drops postings older than maxAgeDays');
assert.equal(stats.duplicates, 1, 'drops the same job cross-posted on another board');

const savedCompanies = rows.map((r) => r.json['Company Name']).sort();
assert.deepEqual(savedCompanies, ['Lumen Health Tech', 'Northwind Labs'], 'only qualified jobs are saved');

const reasons = Object.fromEntries(rejected.map((r) => [r.json['Company Name'], r.json['Reason']]));
console.log('Rejected:', reasons);
assert.match(reasons['Acme Cloud'], /not an Executive/);
assert.match(reasons['Thames Capital'], /hybrid/);
assert.match(reasons['Grupo Andes'], /not written in English/);
assert.match(reasons['Sol Logistics'], /Spanish \(required\)/);

const northwind = rows.find((r) => r.json['Company Name'] === 'Northwind Labs').json;
assert.deepEqual(Object.keys(northwind).slice(0, 6), ['Job Posting URL', 'Job Title', 'Company Name', 'Location',
  'Job Description', 'LLM-Generated Outreach Message'], 'required columns first, in brief order');
assert.ok(!northwind['Job Description'].includes('<'), 'HTML stripped');
assert.ok(!northwind['LLM-Generated Outreach Message'].includes('—'), 'em dashes removed');
assert.equal(northwind['Prompt Version'], 'v1-warm', 'active prompt from Sheet used');
const sentPrompt = o['Build Outreach Request'][0].json.requestBody.messages[0].content;
assert.ok(!/\{\{/.test(sentPrompt), 'all template variables filled');
assert.match(sentPrompt, /CEO and co-founder/);

// ---------- Scenario 2: Claude error -> job not logged, retried next run ----------
const s2 = await pipeline({ failFor: 'Lumen Health Tech' });
assert.ok(!s2.rows.some((r) => r.json['Company Name'] === 'Lumen Health Tech'), 'errored job not saved');
assert.ok(!s2.rejected.some((r) => r.json['Company Name'] === 'Lumen Health Tech'), 'errored job not logged as rejected');

// ---------- Scenario 3: empty Prompts tab -> fallback prompt ----------
const saved = fx.promptRows.splice(0);
const s3 = await pipeline();
assert.equal(s3.rows[0].json['Prompt Version'], 'fallback-v1');
fx.promptRows.push(...saved);

// Write the offline dry-run output for reference
mkdirSync(join(root, 'test/output'), { recursive: true });
writeFileSync(join(root, 'test/output/dry-run-jobs.json'), JSON.stringify(rows.map((r) => r.json), null, 2));
writeFileSync(join(root, 'test/output/dry-run-filtered-out.json'), JSON.stringify(rejected.map((r) => r.json), null, 2));
console.log('\nAll tests passed.');
