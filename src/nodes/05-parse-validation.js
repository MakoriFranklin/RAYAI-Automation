// Node: "Parse Validation"  (mode: Run Once for Each Item)
// Merges Claude's verdict back onto the job. Qualified = remote AND English AND relevant.

const job = { ...$('Build Validation Request').item.json };
delete job.requestBody;
const res = $json;

const toolUse = Array.isArray(res.content) ? res.content.find((c) => c.type === 'tool_use') : null;

if (!toolUse) {
  // API error, timeout or unexpected shape: log it so it is visible, retry happens next run
  const msg = (res.error && (res.error.message || JSON.stringify(res.error))) || 'No assessment returned';
  return { json: { ...job, qualified: false, rejectStage: 'LLM error', rejectReason: String(msg).slice(0, 300), retryable: true } };
}

const a = toolUse.input;
const reasons = [];
if (!a.is_remote) reasons.push(`Not remote: ${a.remote_evidence}`);
if (!a.is_english_speaking) reasons.push(`Not English-speaking: ${a.language_requirements}`);
if (!a.is_relevant) reasons.push(`Not relevant: ${a.relevance_evidence}`);

return {
  json: {
    ...job,
    assessment: a,
    languageRequirements: a.language_requirements || job.languageRequirements,
    validationNotes: `Remote: ${a.remote_evidence} | Relevance: ${a.relevance_evidence} | Confidence: ${a.confidence}`,
    qualified: reasons.length === 0,
    rejectStage: reasons.length ? 'LLM validation' : '',
    rejectReason: reasons.join(' | '),
  },
};
