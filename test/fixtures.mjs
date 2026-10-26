// Test fixtures shaped exactly like each board's documented API response.
// These are invented postings used only to test the logic offline.

const recent = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const EA_DESC = `<p>We are looking for an experienced Executive Assistant to support our CEO and co-founder.
This is a fully remote role open to candidates in any timezone overlapping with US Eastern hours.</p>
<ul><li>Own the CEO's calendar across three time zones and protect focus time</li>
<li>Coordinate board meeting logistics and prepare pre-reads</li>
<li>Book complex international travel and manage expense reports in Expensify</li></ul>
<p>You will work in Google Workspace, Notion and Slack every day. Fluent written and spoken English is required.
Spanish is a plus. You have at least four years of experience supporting a C-level executive and you are comfortable
with confidential information.</p>`;

export const remotive = {
  'executive assistant': { 'job-count': 3, jobs: [
    { id: 101, url: 'https://remotive.com/remote-jobs/all-others/executive-assistant-to-ceo-101', title: 'Executive Assistant to the CEO',
      company_name: 'Northwind Labs', category: 'All others', job_type: 'full_time', publication_date: recent(2),
      candidate_required_location: 'USA, Canada', salary: '$60,000 - $75,000', description: EA_DESC },
    { id: 102, url: 'https://remotive.com/remote-jobs/software-dev/senior-backend-engineer-102', title: 'Senior Backend Engineer',
      company_name: 'Acme Cloud', category: 'Software Development', job_type: 'full_time', publication_date: recent(1),
      candidate_required_location: 'Worldwide', salary: '', description: '<p>Build APIs in Go. Support our executive team with data.</p>' },
    { id: 103, url: 'https://remotive.com/remote-jobs/all-others/executive-assistant-old-103', title: 'Executive Assistant',
      company_name: 'Old Co', category: 'All others', job_type: 'full_time', publication_date: recent(60),
      candidate_required_location: 'Worldwide', salary: '', description: EA_DESC },
  ] },
  'administrative assistant': { 'job-count': 1, jobs: [
    { id: 104, url: 'https://remotive.com/remote-jobs/all-others/administrative-assistant-spanish-104', title: 'Bilingual Administrative Assistant',
      company_name: 'Sol Logistics', category: 'All others', job_type: 'full_time', publication_date: recent(3),
      candidate_required_location: 'LATAM',
      description: `<p>We need an Administrative Assistant to support our operations director. You will handle scheduling,
      vendor emails and data entry for our team in Mexico and the US. Fluency in Spanish is required as most of our
      clients and vendors communicate in Spanish. English at a professional level is also needed for internal work
      and reports to our head office.</p>` },
  ] },
};

export const jobicy = {
  'executive assistant': { jobs: [
    // Same job as Remotive 101, cross-posted: must be de-duplicated
    { id: 201, url: 'https://jobicy.com/jobs/201-executive-assistant-to-the-ceo', jobTitle: 'Executive Assistant to the CEO',
      companyName: 'Northwind Labs', jobType: ['full-time'], jobGeo: 'USA', pubDate: recent(2), jobDescription: EA_DESC },
    { id: 202, url: 'https://jobicy.com/jobs/202-executive-assistant-hybrid', jobTitle: 'Executive Assistant (Hybrid, London)',
      companyName: 'Thames Capital', jobType: ['full-time'], jobGeo: 'UK', pubDate: recent(4), jobDescription: EA_DESC },
    { id: 203, url: 'https://jobicy.com/jobs/203-asistente-ejecutiva', jobTitle: 'Executive Assistant / Asistente Ejecutiva',
      companyName: 'Grupo Andes', jobType: ['full-time'], jobGeo: 'LATAM', pubDate: recent(5),
      jobDescription: `<p>Buscamos una asistente ejecutiva para apoyar al director general. Será responsable de gestionar la agenda,
      coordinar reuniones con clientes, preparar informes semanales y organizar los viajes de negocios del equipo directivo.
      La persona ideal tiene experiencia de tres años en puestos similares, excelente organización, discreción y manejo de
      herramientas como Google Workspace y Slack. Ofrecemos trabajo remoto desde cualquier país de Latinoamérica, horario
      flexible y un equipo cercano que valora la iniciativa y la comunicación clara en todo momento.</p>` },
  ] },
  'administrative assistant': { jobs: [] },
};

export const himalayas = {
  'executive assistant': { jobs: [
    { title: 'Executive Business Partner, Founder Office', companyName: 'Lumen Health Tech', employmentType: 'Full Time',
      locationRestrictions: [], pubDate: Math.floor(Date.now() / 1000) - 86400,
      applicationLink: 'https://himalayas.app/companies/lumen/jobs/executive-business-partner',
      guid: 'https://himalayas.app/companies/lumen/jobs/executive-business-partner',
      description: `<p>Partner with our founder on everything from investor updates to hiring pipelines. Remote first, async friendly.
      You will run the founder's inbox and calendar, draft investor update emails and keep our hiring pipeline moving in Ashby.
      We work in English across 9 countries. Tools: Google Workspace, Linear, Ashby, Notion.</p>` },
    { title: 'Executive Assistant', companyName: 'Already Saved Inc', employmentType: 'Full Time',
      locationRestrictions: ['United States'], pubDate: Math.floor(Date.now() / 1000) - 86400 * 2,
      applicationLink: 'https://himalayas.app/companies/already-saved/jobs/executive-assistant',
      guid: 'https://himalayas.app/companies/already-saved/jobs/executive-assistant', description: EA_DESC },
  ] },
  'administrative assistant': { jobs: [] },
};

// What the Google Sheets "read" nodes would return
export const savedJobsRows = [{ 'Job Posting URL': 'https://himalayas.app/companies/already-saved/jobs/executive-assistant', 'Job Title': 'Executive Assistant' }];
export const filteredOutRows = [{}]; // empty tab + alwaysOutputData
export const promptRows = [
  { Version: 'v1-warm', Active: 'TRUE', 'System Prompt': 'You write warm outreach. Plain text.', 'User Prompt': 'Write to {{company_name}} about {{job_title}} supporting {{executive_supported}}. Mention {{key_responsibilities}}. From {{sender_name}} at {{sender_company}}.' },
  { Version: 'v2-direct', Active: 'FALSE', 'System Prompt': 'Be blunt.', 'User Prompt': 'Short note to {{company_name}}.' },
];
