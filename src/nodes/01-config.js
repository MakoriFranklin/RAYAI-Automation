// Node: "Config"
// The ONLY place you need to edit to change sources, keywords, filters, models or limits.
// The outreach prompt itself lives in the Google Sheet ("Prompts" tab) so it can be
// changed without touching n8n. DEFAULT_PROMPT below is only a fallback.

const config = {
  // Google Sheet that acts as the sales dashboard (the long ID in the sheet URL)
  sheetId: 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE',

  // Search terms sent to every job board
  searchTerms: ['executive assistant', 'administrative assistant'],

  // Which boards to query. All three are public APIs with no LinkedIn involvement.
  sources: {
    remotive: true,   // remotive.com/api  (max 4 calls/day, attribution required)
    jobicy: true,     // jobicy.com/api/v2 (max 1 poll/hour, attribution required)
    himalayas: true,  // himalayas.app/jobs/api/search (attribution required)
  },

  // Only consider postings published in the last N days
  maxAgeDays: 21,

  // Safety cap on how many NEW postings go to the LLM per run (cost control)
  maxNewJobsPerRun: 40,

  // Rule based pre-filter (cheap, runs before any LLM call)
  filters: {
    // A title must match at least one of these to be considered relevant
    titleInclude: [
      '\\bexecutive\\s+(assistant|business\\s+partner|support)',
      '\\b(administrative|admin)\\s+(assistant|support|coordinator)',
      '\\bpersonal\\s+assistant\\b',
      '\\bvirtual\\s+(executive\\s+)?assistant\\b',
      '\\bassistant\\s+to\\s+(the\\s+)?(ceo|cfo|coo|cto|founder|co-founder|president|managing\\s+director|executive)',
      '\\bEA\\b',
    ],
    // ...and none of these
    titleExclude: [
      'engineer', 'developer', 'medical', 'dental', 'clinical', 'nurse', 'pharmac',
      'veterinar', 'legal\\s+assistant', 'paralegal', 'teaching', 'research\\s+assistant',
      'lab(oratory)?\\s+assistant', 'sales\\s+(rep|representative)', 'intern\\b',
    ],
    // Hard reject when the TITLE itself says it is not remote
    titleNonRemote: ['hybrid', 'on-?site', 'in[- ]office'],
    // Reject postings that REQUIRE a language other than English
    rejectIfOtherLanguageRequired: true,
    // Reject descriptions that are not written in English
    requireEnglishDescription: true,
  },

  // Claude settings
  llm: {
    validationModel: 'claude-haiku-5-5',  // fast and cheap classifier
    outreachModel: 'claude-sonnet-5-5',   // better writing for the message
    outreachMaxTokens: 700,
    outreachTemperature: 0.7,
  },

  // Values available to the prompt as {{sender_name}}, {{sender_company}}, {{sender_pitch}}
  sender: {
    name: 'Franklin',
    company: 'RAY',
    pitch:
      'RAY places pre-vetted, full-time remote Executive Assistants with founders and executives. ' +
      'Candidates are screened for written English, judgement and tool fluency, and can start within weeks.',
  },

  // Fallback prompt used ONLY if the "Prompts" tab has no row marked Active = TRUE
  defaultPrompt: {
    version: 'fallback-v1',
    system:
      'You write short, warm, specific B2B outreach emails. Never invent facts about the company. ' +
      'No buzzwords, no exclamation marks, no em dashes. Plain text only.',
    user:
      'Write a cold email from {{sender_name}} at {{sender_company}} to the hiring manager at {{company_name}}, ' +
      'who is hiring a "{{job_title}}" ({{location}}).\n\n' +
      'What we offer: {{sender_pitch}}\n\n' +
      'Who the assistant would support: {{executive_supported}}\n' +
      'Key responsibilities from the posting: {{key_responsibilities}}\n' +
      'Tools mentioned: {{tools_mentioned}}\n\n' +
      'Rules: under 120 words, reference two concrete details from the posting, one clear ask ' +
      '(a 15 minute call), format as "Subject: ..." on the first line then a blank line then the body.\n\n' +
      'Job description:\n{{job_description}}',
  },
};

return [{ json: config }];
