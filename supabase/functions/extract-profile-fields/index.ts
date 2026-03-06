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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { resumeText } = await req.json();
    if (!resumeText?.trim()) {
      return new Response(JSON.stringify({ error: 'No resume text provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a resume parser. Extract structured profile data from resume text. Always respond with the tool call.',
          },
          {
            role: 'user',
            content: `Extract structured profile fields from this resume:\n\n${resumeText}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_profile',
              description: 'Extract structured profile fields from a resume',
              parameters: {
                type: 'object',
                properties: {
                  full_name: { type: 'string', description: 'Full name of the candidate' },
                  email: { type: 'string', description: 'Email address' },
                  phone: { type: 'string', description: 'Phone number' },
                  location: { type: 'string', description: 'City, state, or full address' },
                  summary: { type: 'string', description: 'Professional summary or objective' },
                  skills: { type: 'array', items: { type: 'string' }, description: 'List of skills' },
                  work_experience: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        company: { type: 'string' },
                        startDate: { type: 'string' },
                        endDate: { type: 'string' },
                        description: { type: 'string' },
                      },
                      required: ['title', 'company'],
                      additionalProperties: false,
                    },
                  },
                  education: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        degree: { type: 'string' },
                        institution: { type: 'string' },
                        year: { type: 'string' },
                      },
                      required: ['degree', 'institution'],
                      additionalProperties: false,
                    },
                  },
                  certifications: { type: 'array', items: { type: 'string' }, description: 'List of certifications' },
                },
                required: ['full_name', 'skills', 'work_experience', 'education'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_profile' } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Failed to extract profile fields' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'AI did not return structured data' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const profile = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, profile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error extracting profile:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to extract profile' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
