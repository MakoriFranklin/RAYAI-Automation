// Node: "Build Outreach Request"  (mode: Run Once for Each Item)
// Loads the prompt from the Sheet's "Prompts" tab so tone and wording can be changed
// without editing this workflow. If several rows are Active, each job gets one of them
// at random (simple A/B test); the chosen version is saved next to the message.

const cfg = $('Config').first().json;
const job = $json;
const a = job.assessment || {};

let prompts = [];
try {
  prompts = $('Read Prompt Library').all()
    .map((r) => r.json)
    .filter((r) => String(r['Active']).trim().toUpperCase() === 'TRUE' && r['User Prompt'])
    .map((r) => ({ version: String(r['Version'] || 'unnamed'), system: r['System Prompt'] || '', user: r['User Prompt'] }));
} catch (e) { /* Prompts tab missing: fall back below */ }

const prompt = prompts.length
  ? prompts[Math.floor(Math.random() * prompts.length)]
  : cfg.defaultPrompt;

const vars = {
  job_title: job.title,
  company_name: job.company,
  location: job.location,
  job_description: String(job.descriptionText).slice(0, 5000),
  executive_supported: a.executive_supported || 'Not stated',
  key_responsibilities: (a.key_responsibilities || []).join('; ') || 'Not stated',
  tools_mentioned: (a.tools_mentioned || []).join(', ') || 'None named',
  language_requirements: job.languageRequirements,
  source: job.source,
  sender_name: cfg.sender.name,
  sender_company: cfg.sender.company,
  sender_pitch: cfg.sender.pitch,
};
const fill = (t) => String(t).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => (k in vars ? vars[k] : m));

const requestBody = {
  model: cfg.llm.outreachModel,
  max_tokens: cfg.llm.outreachMaxTokens,
  temperature: cfg.llm.outreachTemperature,
  system: fill(prompt.system),
  messages: [{ role: 'user', content: fill(prompt.user) }],
};

return { json: { ...job, promptVersion: prompt.version, requestBody } };
