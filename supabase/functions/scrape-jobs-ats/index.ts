import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { withRetryText } from "../_shared/retry.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface NormalizedJob {
  title: string;
  company: string;
  description: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  job_url: string | null;
  source: string;
  external_id: string | null;
  job_type: string | null;
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
    salary_min: null,
    salary_max: null,
    salary_currency: 'USD',
    job_url: job.absolute_url || null,
    source: 'greenhouse',
    external_id: `gh-${boardToken}-${job.id}`,
    job_type: detectJobType(job.title, job.content || ''),
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
    salary_min: null,
    salary_max: null,
    salary_currency: 'USD',
    job_url: job.hostedUrl || job.applyUrl || null,
    source: 'lever',
    external_id: `lv-${company}-${job.id}`,
    job_type: job.categories?.commitment || detectJobType(job.text, job.descriptionPlain || ''),
    is_remote: /remote/i.test(job.categories?.location || '') || /remote/i.test(job.text),
  }));
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function scrapeCareerPage(url: string, companyName: string): Promise<NormalizedJob[]> {
  try {
    const fetchResult = await withRetryText(
      (signal) => fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; iCareerOS/1.0; +https://icareeros.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal,
      }),
      { maxAttempts: 3, baseDelayMs: 500, timeoutMs: 12_000, label: url }
    );
    if (!fetchResult.ok || !fetchResult.value) return [];

    const html = fetchResult.value;
    const mainMatch = html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i);
    const rawText = htmlToText(mainMatch?.[0] ?? html);
    if (!rawText || rawText.length < 100) return [];

    const lines = rawText.split('\n');
    const jobs: NormalizedJob[] = [];
    let currentTitle = '';
    let currentDesc = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (looksLikeJobTitle(trimmed)) {
        if (currentTitle) jobs.push(buildJobFromText(currentTitle, currentDesc, companyName, url));
        currentTitle = trimmed;
        currentDesc = '';
      } else if (currentTitle) {
        currentDesc += line + '\n';
      }
    }
    if (currentTitle) jobs.push(buildJobFromText(currentTitle, currentDesc, companyName, url));
    return jobs;
  } catch {
    return [];
  }
}

function looksLikeJobTitle(text: string): boolean {
  const keywords = /engineer|developer|manager|analyst|designer|architect|lead|director|specialist|coordinator|consultant|scientist|intern|associate|vp|head of|chief/i;
  return keywords.test(text) && text.length < 100;
}

function buildJobFromText(title: string, desc: string, company: string, url: string): NormalizedJob {
  const salaryMatch = desc.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?/);
  const salary = salaryMatch ? parseSalaryRange(salaryMatch[0]) : { min: null, max: null };
  return {
    title,
    company,
    description: desc.substring(0, 5000).trim(),
    location: extractLocation(desc),
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: 'USD',
    job_url: url,
    source: 'career_page',
    external_id: `cp-${company}-${title}`.replace(/\s+/g, '-').toLowerCase().substring(0, 200),
    job_type: detectJobType(title, desc),
    is_remote: /remote/i.test(desc) || /remote/i.test(title),
  };
}

function parseSalaryRange(s: string): { min: number | null; max: number | null } {
  const nums = s.replace(/[$,]/g, '').split(/[-–]/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
  return { min: nums[0] ?? null, max: nums[1] ?? nums[0] ?? null };
}

function detectJobType(title: string, desc: string): string | null {
  const text = `${title} ${desc}`.toLowerCase();
  if (/\bcontract\b/.test(text))    return 'contract';
  if (/\bpart[- ]time\b/.test(text)) return 'part-time';
  if (/\bintern\b/.test(text))       return 'internship';
  return 'full-time';
}

function extractLocation(text: string): string | null {
  const match = text.match(/(?:location|based in|office)[:\s]+([^\n,]+)/i);
  return match ? match[1].trim().substring(0, 100) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!checkRateLimit(`scrape-jobs-ats:${user.id}`, 10, 60_000)) {
      return new Response(JSON.stringify({ success: false, error: 'Too many requests' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { targets } = await req.json();
    let allJobs: NormalizedJob[] = [];

    for (const target of (targets || [])) {
      try {
        let jobs: NormalizedJob[] = [];
        if (target.type === 'greenhouse')   jobs = await scrapeGreenhouse(target.identifier);
        else if (target.type === 'lever')   jobs = await scrapeLever(target.identifier);
        else if (target.type === 'career_page') jobs = await scrapeCareerPage(target.identifier, target.company || 'Unknown');
        allJobs = allJobs.concat(jobs);
      } catch (e) {
        console.error(`Failed to scrape ${target.type}:${target.identifier}`, e);
      }
    }

    const seen = new Set<string>();
    const unique = allJobs.filter(j => {
      if (!j.external_id || seen.has(j.external_id)) return false;
      seen.add(j.external_id);
      return true;
    });

    let inserted = 0;
    for (const job of unique) {
      // Write to job_postings (scraped_jobs is a VIEW — cannot be inserted into directly)
      const { error } = await supabaseAdmin.from('job_postings').upsert({
        external_id:     job.external_id,
        title:           job.title,
        company:         job.company,
        location:        job.location,
        is_remote:       job.is_remote,
        job_type:        job.job_type,
        salary_min:      job.salary_min,
        salary_max:      job.salary_max,
        salary_currency: job.salary_currency,
        description:     job.description,
        job_url:         job.job_url,
        source:          job.source,
        scraped_at:      new Date().toISOString(),
        quality_score:   50,
        is_flagged:      false,
      }, { onConflict: 'external_id' });
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({ success: true, scraped: allJobs.length, deduplicated: unique.length, inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Scrape failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
