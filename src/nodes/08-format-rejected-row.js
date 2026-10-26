// Node: "Format Rejected Row"  (mode: Run Once for All Items)
// Every posting that fails a check is logged in the "Filtered Out" tab with the reason.
// This keeps the filter auditable and stops the same posting being re-checked every day.
// LLM errors are NOT logged, so those postings are retried on the next run.

return $input.all()
  .map((i) => i.json)
  .filter((j) => !j.retryable)
  .map((j) => ({
    json: {
      'Job Posting URL': j.url,
      'Job Title': j.title,
      'Company Name': j.company,
      'Location': j.location,
      'Source': j.source,
      'Rejected At': j.rejectStage,
      'Reason': j.rejectReason,
      'Language Requirements': j.languageRequirements,
      'Date Checked': new Date().toISOString().slice(0, 10),
    },
  }));
