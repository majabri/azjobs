import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { validatePublicUrl } from "../_shared/validate-url.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Post-scrape cleaning ─────────────────────────────────────────────────────

/** Lines that are navigation / UI noise — not job description content */
const NOISE_PATTERNS = [
  /^(apply\s*(now|here|today|online)?|save\s*job|share\s*(this\s*)?job|print|report\s*(this\s*)?job|sign\s*in|log\s*in|create\s*account|sign\s*up|register|back\s*to\s*(search|results|jobs)|view\s*all\s*jobs|similar\s*jobs|more\s*jobs)/i,
  /^(home|about\s*us|careers|contact|blog|press|privacy|terms|cookie|sitemap|faq|help|support|accessibility)/i,
  /^(follow\s*us|connect\s*with\s*us|stay\s*connected|join\s*our\s*(team|talent)|newsletter)/i,
  /^(©|copyright|all\s*rights\s*reserved)/i,
  /^\[.*?\]\(.*?\)$/, // standalone markdown links
  /^!\[.*?\]\(.*?\)$/, // standalone markdown images
  /^(skip\s*to\s*content|main\s*navigation|breadcrumb)/i,
  /^(posted|updated|published|closes?|deadline|date\s*posted)\s*:?\s*\d/i,
  /^(job\s*(id|number|code|ref|reference))\s*:?\s*/i,
  /^[\w\s]{1,15}\s*\|\s*[\w\s]{1,15}\s*\|\s*[\w\s]{1,15}/, // nav breadcrumbs like "Home | Careers | Jobs"
  /^#{1,6}\s*(menu|navigation|footer|header|sidebar)/i,
];

/** Sections at the bottom that are not job content */
const TRAILING_SECTION_HEADERS = [
  /^#{1,4}\s*(similar\s*jobs|related\s*jobs|you\s*may\s*also|recommended|other\s*openings|explore\s*more)/i,
  /^#{1,4}\s*(share\s*this|social\s*media|follow\s*us)/i,
];

function cleanJobMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const cleaned: string[] = [];
  let consecutiveEmpty = 0;
  let hitTrailingSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop processing if we hit a trailing non-job section
    if (TRAILING_SECTION_HEADERS.some(p => p.test(trimmed))) {
      hitTrailingSection = true;
      break;
    }

    // Skip noise lines
    if (trimmed && NOISE_PATTERNS.some(p => p.test(trimmed))) continue;

    // Skip lines that are just URLs
    if (/^https?:\/\/\S+$/.test(trimmed)) continue;

    // Skip tracking pixels / tiny images
    if (/^!\[.*?\]\(.*?(tracking|pixel|beacon|1x1).*?\)$/i.test(trimmed)) continue;

    // Collapse excessive blank lines
    if (!trimmed) {
      consecutiveEmpty++;
      if (consecutiveEmpty <= 2) cleaned.push('');
      continue;
    }
    consecutiveEmpty = 0;

    // Strip inline "Apply Now" style buttons that appear mid-content
    const stripped = trimmed
      .replace(/\[apply\s*(now|here|today)?\]\(.*?\)/gi, '')
      .replace(/\[save\s*job\]\(.*?\)/gi, '')
      .replace(/\[share\]\(.*?\)/gi, '')
      .trim();

    if (stripped) cleaned.push(stripped);
  }

  return cleaned.join('\n').trim();
}

/** Try to isolate the job description block from a larger page */
function extractJobBlock(markdown: string): string {
  // Look for common job section markers and extract content between them
  const lines = markdown.split('\n');
  
  // Strategy 1: Find explicit job description header and extract from there
  const jobStartPatterns = [
    /^#{1,4}\s*(job\s*description|about\s*(the\s*)?(role|position|opportunity)|role\s*summary|position\s*overview|the\s*role|overview)/i,
    /^#{1,4}\s*(what\s*you.?ll\s*do|responsibilities|key\s*responsibilities)/i,
    /^\*\*(job\s*description|about\s*(the\s*)?(role|position))\*\*/i,
  ];
  
  let jobStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (jobStartPatterns.some(p => p.test(lines[i].trim()))) {
      jobStartIdx = i;
      break;
    }
  }
  
  // If we found a job start, use content from there
  // Otherwise check if the content already looks like a job description (has requirements/qualifications)
  const hasJobContent = /\b(requirements?|qualifications?|responsibilities|experience|what\s*you.?ll\s*(do|need|bring)|about\s*(the\s*)?(role|position))\b/i.test(markdown);
  
  if (jobStartIdx > 10 && hasJobContent) {
    // There's preamble before the job content — trim it but keep some context
    // Look backwards from jobStartIdx for a company/title header
    let actualStart = jobStartIdx;
    for (let i = jobStartIdx - 1; i >= Math.max(0, jobStartIdx - 5); i--) {
      const t = lines[i].trim();
      if (t && (t.startsWith('#') || t.startsWith('**'))) {
        actualStart = i;
        break;
      }
    }
    return lines.slice(actualStart).join('\n');
  }
  
  return markdown;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await (supabase.auth as any).getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId: string = data.claims.sub as string;

    if (!checkRateLimit(`scrape-url:${userId}`, 20, 60_000)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests – please slow down' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const urlValidation = validatePublicUrl(url);
    if (!urlValidation.ok) {
      return new Response(
        JSON.stringify({ success: false, error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const validatedUrl = urlValidation.url;

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[scrape-url] Fetching:', validatedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: validatedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[scrape-url] Firecrawl error:', response.status, responseData);
      const isBotBlocked = response.status === 403 || response.status === 429;
      return new Response(
        JSON.stringify({
          success: false,
          error: isBotBlocked
            ? 'This site blocked automatic extraction. Please paste the job description manually.'
            : (responseData.error || `Failed with status ${response.status}`),
          extractionFailed: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawMarkdown = responseData.data?.markdown || responseData.markdown || '';
    const title = responseData.data?.metadata?.title || responseData.metadata?.title || '';

    console.log('[scrape-url] Raw length:', rawMarkdown.length);

    // Step 1: Extract the job block from full-page content
    const jobBlock = extractJobBlock(rawMarkdown);

    // Step 2: Clean navigation/UI noise
    const cleaned = cleanJobMarkdown(jobBlock);

    console.log('[scrape-url] Cleaned length:', cleaned.length);
    console.log('[scrape-url] Preview:', cleaned.slice(0, 200));

    // Step 3: Validate minimum quality
    if (cleaned.length < 300) {
      console.warn('[scrape-url] Extraction too short:', cleaned.length);
      return new Response(
        JSON.stringify({
          success: false,
          error: "We couldn't extract enough content from this URL. Please paste the job description manually.",
          extractionFailed: true,
          partialText: cleaned || undefined,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if content looks like actual job description (not just navigation)
    const hasJobSignals = /\b(experience|requirements?|qualifications?|responsibilities|skills?|salary|compensation|benefits?|about\s*(the\s*)?(role|position|company)|what\s*you)/i.test(cleaned);
    if (!hasJobSignals) {
      console.warn('[scrape-url] Content lacks job signals');
      return new Response(
        JSON.stringify({
          success: false,
          error: "The extracted content doesn't appear to be a job description. Please paste it manually.",
          extractionFailed: true,
          partialText: cleaned.slice(0, 500) || undefined,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, markdown: cleaned, title }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[scrape-url] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape',
        extractionFailed: true,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
