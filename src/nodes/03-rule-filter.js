// Node: "Rule Pre-Filter"  (mode: Run Once for All Items)
// Cheap deterministic checks BEFORE any LLM call:
//   relevance  -> title must look like an Executive / Admin Assistant role
//   remote     -> boards are remote-only, but reject titles that say hybrid / on-site
//   english    -> description must be written in English and must not REQUIRE another language
// Anything that passes still gets a final LLM check in the next step.

const cfg = $('Config').first().json;
const f = cfg.filters;
const rx = (list) => list.map((p) => new RegExp(p, 'i'));
const includeRx = rx(f.titleInclude);
const excludeRx = rx(f.titleExclude);
const nonRemoteRx = rx(f.titleNonRemote);

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Japanese', 'Mandarin', 'Chinese',
  'Cantonese', 'Korean', 'Arabic', 'Russian', 'Polish', 'Romanian', 'Greek', 'Hebrew', 'Turkish',
  'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Hindi', 'Tagalog', 'Filipino', 'Vietnamese', 'Thai',
  'Indonesian', 'Czech', 'Hungarian', 'Ukrainian', 'Bulgarian', 'Croatian', 'Serbian', 'Slovak',
];
const REQUIRED_WORDS = /(fluen|native|bilingual|proficien|must\s+(speak|be\s+able)|required|mandatory|written\s+and\s+(spoken|verbal)|speak|\bC1\b|\bC2\b)/i;
const OPTIONAL_WORDS = /(nice\s+to\s+have|a\s+plus|is\s+a\s+bonus|preferred|advantage|desirable|beneficial)/i;
const EN_STOPWORDS = new Set(('the and to of a in for with you our is are will on as be this or your we an at by from ' +
  'that have it all team work role who can about their experience support').split(' '));

function englishRatio(text) {
  const words = (text.toLowerCase().match(/[a-zà-ÿ]+/g) || []);
  if (words.length < 40) return 1; // too short to judge, let the LLM decide
  const hits = words.filter((w) => EN_STOPWORDS.has(w)).length;
  return hits / words.length;
}

function languageRequirements(text) {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const found = [];
  let otherRequired = false;
  for (const lang of ['English', ...LANGUAGES]) {
    const langRx = new RegExp(`\\b${lang}\\b`, 'i');
    const s = sentences.find((x) => langRx.test(x) && (REQUIRED_WORDS.test(x) || OPTIONAL_WORDS.test(x)));
    if (!s) continue;
    const optional = OPTIONAL_WORDS.test(s);
    found.push(`${lang} (${optional ? 'preferred' : 'required'})`);
    if (lang !== 'English' && !optional) otherRequired = true;
  }
  return { text: found.join('; '), otherRequired };
}

const passed = [];
const rejected = [];

for (const item of $input.all()) {
  const job = item.json;
  const reasons = [];

  const isRelevant = includeRx.some((r) => r.test(job.title)) && !excludeRx.some((r) => r.test(job.title));
  if (!isRelevant) reasons.push('Title is not an Executive / Admin Assistant role');

  const isRemote = !nonRemoteRx.some((r) => r.test(job.title));
  if (!isRemote) reasons.push('Title says hybrid or on-site');

  const ratio = englishRatio(job.descriptionText);
  const lang = languageRequirements(job.descriptionText);
  const englishText = !f.requireEnglishDescription || ratio >= 0.08;
  const isEnglish = englishText && !(f.rejectIfOtherLanguageRequired && lang.otherRequired);
  if (!englishText) reasons.push('Description is not written in English');
  if (f.rejectIfOtherLanguageRequired && lang.otherRequired) reasons.push(`Requires another language: ${lang.text}`);

  const out = {
    ...job,
    languageRequirements: lang.text || 'None stated',
    rules: { isRelevant, isRemote, isEnglish, englishRatio: Number(ratio.toFixed(3)) },
    rejectStage: reasons.length ? 'Rules' : '',
    rejectReason: reasons.join(' | '),
    passedRules: reasons.length === 0,
  };
  (out.passedRules ? passed : rejected).push(out);
}

// Cost cap: only the newest N relevant jobs go to the LLM this run.
// Overflow is NOT logged anywhere, so it is picked up again on the next run.
const toLlm = passed.slice(0, cfg.maxNewJobsPerRun);

return [...toLlm, ...rejected].map((json) => ({ json }));
