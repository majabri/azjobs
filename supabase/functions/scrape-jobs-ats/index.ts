import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NormalizedJob {
  title: string;
  company: string;
  description: string;
  location: string | null;
  salary: string | null;
  job_url: string | null;
  source: string;
  source_id: string | null;
  job_type: string | null;
  seniority: string | null;
  industry: string | null;
  is_remote: boolean;
}

async function scrapeGreenhouse(boardToken: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.jobs || []).map((job: any) => ({
    title: job.title || '',
    company: data.name || boardToken,
    description: (job.content || '').replace(/<[^>]*>/g, ' ').substring(0, 5000),
    location: job.location?.name || null,
    salary: null,
    job_url: job.absolute_url || null,
    source: 'greenhouse',
    source_id: `gh-${boardToken}-${job.id}`,
    job_type: detectJobType(job.title, job.content || ''),
    seniority: detectSeniority(job.title),
    industry: null,
    is_remote: /remote/i.test(job.location?.name || '') || /remote/i.test(job.title),
  }));
}

async function scrapeLever(company: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`);
  if (!res.ok) return [];
  const jobs: any[] = await res.json();
  return jobs.map((job: any) => ({
    title: job.text || '',
    company: company,
    description: (job.descriptionPlain || job.description || '').substring(0, 5000),
    location: job.categories?.location || null,
    salary: null,
    job_url: job.hostedUrl || job.applyUrl || null,
    source: 'lever',
    source_id: `lv-${company}-${job.id}`,
    job_type: job.categories?.commitment || detectJobType(job.text, job.descriptionPlain || ''),
    seniority: detectSeniority(job.text),
    industry: job.categories?.department || null,
    is_remote: /remote/i.test(job.categories?.location || '') || /remote/i.test(job.text),
  }));
}

async function scrapeCareerPage(url: string, companyName: string): Promise<NormalizedJob[]> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) return [];

  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const markdown = data.data?.markdown || data.markdown || '';
  
  // Extract job-like entries from markdown
  const lines = markdown.split('\n');
  const jobs: NormalizedJob[] = [];
  let currentTitle = '';
  let currentDesc = '';

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch && looksLikeJobTitle(headingMatch[1])) {
      if (currentTitle) {
        jobs.push(buildJobFromText(currentTitle, currentDesc, companyName, url));
      }
      currentTitle = headingMatch[1].trim();
      currentDesc = '';
    } else if (currentTitle) {
      currentDesc += line + '\n';
    }
  }
  if (currentTitle) {
    jobs.push(buildJobFromText(currentTitle, currentDesc, companyName, url));
  }
  return jobs;
}

function looksLikeJobTitle(text: string): boolean {
  const keywords = /engineer|developer|manager|analyst|designer|architect|lead|director|specialist|coordinator|consultant|scientist|intern|associate|vp|head of|chief/i;
  return keywords.test(text) && text.length < 100;
}

function buildJobFromText(title: string, desc: string, company: string, url: string): NormalizedJob {
  return {
    title,
    company,
    description: desc.substring(0, 5000).trim(),
    location: extractLocation(desc),
    salary: extractSalary(desc),
    job_url: url,
    source: 'career_page',
    source_id: `cp-${company}-${title}`.replace(/\s+/g, '-').toLowerCase().substring(0, 200),
    job_type: detectJobType(title, desc),
    seniority: detectSeniority(title),
    industry: null,
    is_remote: /remote/i.test(desc) || /remote/i.test(title),
  };
}

function detectJobType(title: string, desc: string): string | null {
  const text = `${title} ${desc}`.toLowerCase();
  if (/\bcontract\b/.test(text)) return 'contract';
  if (/\bpart[- ]time\b/.test(text)) return 'part-time';
  if (/\bintern\b/.test(text)) return 'internship';
  return 'full-time';
}

function detectSeniority(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(chief|cto|ceo|cfo|coo|ciso)\b/.test(t)) return 'executive';
  if (/\b(vp|vice president|svp)\b/.test(t)) return 'vp';
  if (/\bdirector\b/.test(t)) return 'director';
  if (/\b(lead|principal|staff)\b/.test(t)) return 'senior';
  if (/\bsenior\b/.test(t)) return 'senior';
  if (/\bjunior\b/.test(t)) return 'junior';
  if (/\bintern\b/.test(t)) return 'intern';
  return 'mid';
}

function extractLocation(text: string): string | null {
  const match = text.match(/(?:location|based in|office)[:\s]+([^\n,]+)/i);
  return match ? match[1].trim().substring(0, 100) : null;
}

function extractSalary(text: string): string | null {
  const match = text.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*(?:per year|\/yr|annually|\/year))?/i);
  return match ? match[0] : null;
}

function scoreJobQuality(job: NormalizedJob): { score: number; flagged: boolean; reasons: string[] } {
  let score = 100;
  const reasons: string[] = [];

  if (!job.description || job.description.length < 50) {
    score -= 30;
    reasons.push('Very short or missing description');
  }
  if (!job.location && !job.is_remote) {
    score -= 10;
    reasons.push('No location specified');
  }
  if (!job.salary) {
    score -= 5;
    reasons.push('No salary information');
  }
  if (job.description && /\b(urgent|immediately|asap)\b/i.test(job.description)) {
    score -= 15;
    reasons.push('Contains urgency keywords (potential spam)');
  }
  if (job.description && /\b(commission only|unpaid|volunteer)\b/i.test(job.description)) {
    score -= 25;
    reasons.push('Potentially unpaid or commission-only');
  }

  return { score: Math.max(0, score), flagged: score < 60, reasons };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { targets } = await req.json();
    // targets: Array<{ type: 'greenhouse' | 'lever' | 'career_page', identifier: string, company?: string }>

    let allJobs: NormalizedJob[] = [];

    for (const target of (targets || [])) {
      try {
        let jobs: NormalizedJob[] = [];
        if (target.type === 'greenhouse') {
          jobs = await scrapeGreenhouse(target.identifier);
        } else if (target.type === 'lever') {
          jobs = await scrapeLever(target.identifier);
        } else if (target.type === 'career_page') {
          jobs = await scrapeCareerPage(target.identifier, target.company || 'Unknown');
        }
        allJobs = allJobs.concat(jobs);
      } catch (e) {
        console.error(`Failed to scrape ${target.type}:${target.identifier}`, e);
      }
    }

    // Deduplicate by source_id
    const seen = new Set<string>();
    const unique = allJobs.filter(j => {
      if (!j.source_id || seen.has(j.source_id)) return false;
      seen.add(j.source_id);
      return true;
    });

    // Score and upsert
    let inserted = 0;
    for (const job of unique) {
      const quality = scoreJobQuality(job);
      const { error } = await supabaseAdmin.from('scraped_jobs').upsert({
        ...job,
        quality_score: quality.score,
        is_flagged: quality.flagged,
        flag_reasons: quality.reasons,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'source_id' });
      if (!error) inserted++;
    }

    return new Response(
      JSON.stringify({ success: true, scraped: allJobs.length, deduplicated: unique.length, inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Scrape failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
