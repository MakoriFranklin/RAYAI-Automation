// Node: "Fetch & Normalize Jobs"  (mode: Run Once for All Items)
// Calls each enabled job board API, maps every posting to one common shape,
// removes duplicates and drops anything already in the Sheet (Jobs or Filtered Out tabs).

const cfg = $('Config').first().json;
const http = this.helpers.httpRequest.bind(this.helpers);
const UA = 'RAY-EA-Outreach/1.0 (n8n workflow; contact via company website)';

// ---------- helpers ----------
function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;|&ndash;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normUrl(u) {
  if (!u) return '';
  try {
    const url = new URL(String(u).trim());
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref'].forEach((p) => url.searchParams.delete(p));
    return url.toString().replace(/\/$/, '');
  } catch (e) {
    return String(u).trim();
  }
}

function toIso(d) {
  if (d === undefined || d === null || d === '') return '';
  const date = typeof d === 'number' ? new Date(d < 1e12 ? d * 1000 : d) : new Date(d);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

function joinList(v) {
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  return v ? String(v) : '';
}

// ---------- source adapters ----------
const adapters = {
  async remotive(term) {
    const body = await http({
      method: 'GET', url: 'https://remotive.com/api/remote-jobs',
      qs: { search: term, limit: 100 }, headers: { 'User-Agent': UA }, json: true, timeout: 30000,
    });
    return (body.jobs || []).map((j) => ({
      source: 'Remotive',
      sourceJobId: String(j.id),
      url: j.url,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location ? `Remote (${j.candidate_required_location})` : 'Remote',
      jobType: j.job_type || '',
      salary: j.salary || '',
      postedAt: toIso(j.publication_date),
      descriptionHtml: j.description,
    }));
  },

  async jobicy(term) {
    const body = await http({
      method: 'GET', url: 'https://jobicy.com/api/v2/remote-jobs',
      qs: { count: 100, tag: term.slice(0, 50) }, headers: { 'User-Agent': UA }, json: true, timeout: 30000,
    });
    return (body.jobs || []).map((j) => ({
      source: 'Jobicy',
      sourceJobId: String(j.id),
      url: j.url,
      title: j.jobTitle,
      company: j.companyName,
      location: j.jobGeo ? `Remote (${j.jobGeo})` : 'Remote',
      jobType: joinList(j.jobType),
      salary: j.salaryMin ? `${j.salaryMin}-${j.salaryMax || ''} ${j.salaryCurrency || ''} ${j.salaryPeriod || ''}`.trim() : '',
      postedAt: toIso(j.pubDate),
      descriptionHtml: j.jobDescription || j.jobExcerpt,
    }));
  },

  async himalayas(term) {
    const body = await http({
      method: 'GET', url: 'https://himalayas.app/jobs/api/search',
      qs: { keyword: term, limit: 20 }, headers: { 'User-Agent': UA }, json: true, timeout: 30000,
    });
    const jobs = body.jobs || body.data || [];
    return jobs.map((j) => {
      const countries = joinList(j.locationRestrictions);
      return {
        source: 'Himalayas',
        sourceJobId: String(j.guid || j.applicationLink || ''),
        url: j.applicationLink || j.guid,
        title: j.title,
        company: j.companyName,
        location: countries ? `Remote (${countries})` : 'Remote (Worldwide)',
        jobType: j.employmentType || '',
        salary: j.minSalary ? `${j.minSalary}-${j.maxSalary || ''} ${j.currency || ''} ${j.salaryPeriod || ''}`.trim() : '',
        postedAt: toIso(j.pubDate),
        descriptionHtml: j.description || j.excerpt,
      };
    });
  },
};

// ---------- fetch ----------
const raw = [];
const errors = [];
for (const [name, enabled] of Object.entries(cfg.sources)) {
  if (!enabled || !adapters[name]) continue;
  for (const term of cfg.searchTerms) {
    try {
      const jobs = await adapters[name](term);
      raw.push(...jobs);
    } catch (e) {
      // One board failing must not stop the others
      errors.push(`${name} "${term}": ${e.message}`);
    }
  }
}

// ---------- normalize, dedupe, skip already processed ----------
const seen = new Set();
for (const nodeName of ['Read Saved Jobs', 'Read Filtered Out']) {
  try {
    for (const row of $(nodeName).all()) {
      const u = normUrl(row.json['Job Posting URL']);
      if (u) seen.add(u);
    }
  } catch (e) { /* tab empty or node not executed */ }
}

const cutoff = Date.now() - cfg.maxAgeDays * 86400000;
const companyTitleKeys = new Set();
const out = [];
const stats = { fetched: raw.length, alreadyInSheet: 0, tooOld: 0, duplicates: 0, kept: 0, errors };

for (const j of raw) {
  const url = normUrl(j.url);
  if (!url || !j.title) continue;
  if (seen.has(url)) { stats.alreadyInSheet++; continue; }
  if (j.postedAt && new Date(j.postedAt).getTime() < cutoff) { stats.tooOld++; continue; }
  // the same job is often cross-posted on several boards
  const ctKey = `${String(j.company).toLowerCase().trim()}|${String(j.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
  if (companyTitleKeys.has(ctKey)) { stats.duplicates++; continue; }
  seen.add(url);
  companyTitleKeys.add(ctKey);

  const descriptionText = htmlToText(j.descriptionHtml);
  out.push({
    source: j.source,
    sourceJobId: j.sourceJobId,
    url,
    title: String(j.title).trim(),
    company: String(j.company || 'Unknown').trim(),
    location: j.location,
    jobType: j.jobType,
    salary: j.salary,
    postedAt: j.postedAt,
    descriptionText,
  });
}

out.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
stats.kept = out.length;

// Stats are attached to every item so the execution log shows what happened
return out.map((job) => ({ json: { ...job, _runStats: stats } }));
