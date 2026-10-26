// Node: "Format Sheet Row"  (mode: Run Once for All Items)
// Turns each job + Claude's message into one row for the "Jobs" tab.
// The first six columns are exactly the ones the brief asks for; the rest help the sales rep.
// If a message failed to generate, the job is skipped (not saved) so it is retried next run.

const MAX_CELL = 4000; // Sheets allows 50k per cell, but long cells make the dashboard unreadable
const rows = [];

$input.all().forEach((item, i) => {
  const job = $('Build Outreach Request').itemMatching(i).json;
  const res = item.json;
  const text = Array.isArray(res.content)
    ? res.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim()
    : '';
  if (!text) return;

  const desc = job.descriptionText.length > MAX_CELL
    ? job.descriptionText.slice(0, MAX_CELL) + '... [truncated, see posting URL]'
    : job.descriptionText;

  rows.push({
    json: {
      'Job Posting URL': job.url,
      'Job Title': job.title,
      'Company Name': job.company,
      'Location': job.location,
      'Job Description': desc,
      'LLM-Generated Outreach Message': text.replace(/\s*—\s*/g, ', '),
      'Status': 'New',
      'Owner': '',
      'Rep Notes': '',
      'Date Posted': job.postedAt ? job.postedAt.slice(0, 10) : '',
      'Date Added': new Date().toISOString().slice(0, 10),
      'Source': job.source,
      'Language Requirements': job.languageRequirements,
      'Validation Notes': job.validationNotes,
      'Prompt Version': job.promptVersion,
    },
  });
});

return rows;
