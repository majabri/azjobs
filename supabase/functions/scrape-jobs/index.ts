import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub;

    const { url, targetType } = await req.json();

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: 'Firecrawl not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping career page:', formattedUrl);

    // Scrape the page with Firecrawl
    const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeResp.json();
    if (!scrapeResp.ok) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(JSON.stringify({ error: scrapeData.error || 'Failed to scrape' }), {
        status: scrapeResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    if (!markdown || markdown.length < 50) {
      return new Response(JSON.stringify({ error: 'No meaningful content found on page', jobs: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use AI to extract structured job listings
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You extract job listings from career page content. Return a JSON array of job objects. Each object must have:
- title (string, required)
- company (string, required)
- location (string or null)
- salary (string or null)
- description (string, 2-3 sentence summary)
- job_url (string or null, the application link if found)
- job_type (string or null: "full-time", "part-time", "contract", "internship")
- is_remote (boolean)
- seniority (string or null: "entry", "mid", "senior", "lead", "director", "vp", "c-level")

Return ONLY valid JSON array. No markdown, no code blocks.
If no job listings are found, return an empty array [].`
          },
          {
            role: 'user',
            content: `Extract all job listings from this career page content. The source URL is ${formattedUrl}.\n\n${markdown.slice(0, 15000)}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('AI extraction error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to extract jobs from page' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';

    let jobs: any[] = [];
    try {
      jobs = JSON.parse(content);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        try { jobs = JSON.parse(match[0]); } catch { jobs = []; }
      }
    }

    if (!Array.isArray(jobs)) jobs = [];

    // Store in DB using service role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let inserted = 0;
    for (const job of jobs) {
      if (!job.title || !job.company) continue;

      const jobUrl = job.job_url || `${formattedUrl}#${job.title.replace(/\s+/g, '-').toLowerCase()}`;

      const { error: upsertError } = await adminClient
        .from('scraped_jobs')
        .upsert({
          title: job.title,
          company: job.company,
          description: job.description || '',
          location: job.location || null,
          salary: job.salary || null,
          job_url: jobUrl,
          source: formattedUrl,
          job_type: job.job_type || null,
          is_remote: job.is_remote || false,
          seniority: job.seniority || null,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'job_url' });

      if (!upsertError) inserted++;
    }

    // Update scraping target last_scraped_at
    await adminClient
      .from('scraping_targets')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('url', url);

    return new Response(JSON.stringify({
      success: true,
      jobs_found: jobs.length,
      jobs_stored: inserted,
      jobs,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('scrape-jobs error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
