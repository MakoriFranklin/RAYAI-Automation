// Node: "Build Validation Request"  (mode: Run Once for Each Item)
// Asks Claude to make the final remote / English / relevance decision and to pull out
// personalisation details for the outreach message. Forced tool use guarantees valid JSON.

const cfg = $('Config').first().json;
const job = $json;

const tool = {
  name: 'record_assessment',
  description: 'Record the assessment of one job posting.',
  input_schema: {
    type: 'object',
    properties: {
      is_remote: { type: 'boolean', description: 'True only if the role can be done fully remotely (location restrictions such as "US only" are fine). False if hybrid, on-site or regular office attendance is required.' },
      remote_evidence: { type: 'string', description: 'Short quote or reason for the remote decision.' },
      is_english_speaking: { type: 'boolean', description: 'True if the working language is English and no other language is REQUIRED. A second language listed as a plus is fine.' },
      language_requirements: { type: 'string', description: 'All language requirements stated, e.g. "Fluent English required; Spanish a plus". "None stated" if none.' },
      is_relevant: { type: 'boolean', description: 'True if this is genuinely an Executive Assistant, Administrative Assistant, Personal Assistant or Executive Business Partner role supporting a person or team. False for sales, engineering, medical, legal, teaching, research or recruiting roles.' },
      relevance_evidence: { type: 'string', description: 'Short reason for the relevance decision.' },
      executive_supported: { type: 'string', description: 'Who the assistant would support (e.g. "CEO and co-founder", "VP of Sales"). "Not stated" if unknown.' },
      key_responsibilities: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'The three most specific responsibilities, paraphrased in under 12 words each.' },
      tools_mentioned: { type: 'array', items: { type: 'string' }, description: 'Software or tools named in the posting.' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['is_remote', 'remote_evidence', 'is_english_speaking', 'language_requirements', 'is_relevant',
      'relevance_evidence', 'executive_supported', 'key_responsibilities', 'tools_mentioned', 'confidence'],
  },
};

const requestBody = {
  model: cfg.llm.validationModel,
  max_tokens: 600,
  temperature: 0,
  system: 'You screen job postings for a recruitment team. Judge only from the posting text. Be strict and literal.',
  tools: [tool],
  tool_choice: { type: 'tool', name: 'record_assessment' },
  messages: [{
    role: 'user',
    content:
      `Job title: ${job.title}\nCompany: ${job.company}\nListed location: ${job.location}\n` +
      `Source board: ${job.source} (a remote-only job board)\n\nDescription:\n${String(job.descriptionText).slice(0, 6000)}`,
  }],
};

return { json: { ...job, requestBody } };
