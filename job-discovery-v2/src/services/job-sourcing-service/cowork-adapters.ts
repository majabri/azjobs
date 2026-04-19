// =============================================================================
// iCareerOS — Cowork API Adapters (6 Free Sources)
//
// Sources:
//   1. Greenhouse    — boards-api.greenhouse.io (JSON API, no key needed)
//   2. Lever         — api.lever.co/v0/postings (JSON API, no key needed)
//   3. SmartRecruiters — api.smartrecruiters.com (JSON API, free tier)
//   4. Remotive      — remotive.com/api/remote-jobs (free JSON API)
//   5. We Work Remotely — RSS feed (free)
//   6. Wellfound     — apollo.io/people API alternative via direct listing
//
// All free, no API keys required for public job listings.
// =============================================================================

import axios, { AxiosRequestConfig } from 'axios'
import type { CoworkJob, RemoteType } from './types'

const REQUEST_TIMEOUT = 15_000  // 15 seconds

// Known companies on Greenhouse (expand as needed)
const GREENHOUSE_COMPANIES = [
  'airbnb', 'stripe', 'databricks', 'figma', 'notion', 'vercel',
  'supabase', 'linear', 'retool', 'hashicorp', 'cockroachdb',
  'planetscale', 'fly-io', 'render', 'railway',
]

// Known companies on Lever
const LEVER_COMPANIES = [
  'netflix', 'reddit', 'duolingo', 'plaid', 'brex', 'rippling',
  'scale-ai', 'cohere', 'anthropic', 'huggingface',
]

// SmartRecruiters company IDs
const SMARTRECRUITERS_COMPANIES = [
  'turing', 'toptal', 'andela',
]

interface FetchAllOptions {
  search_term: string
  limit?: number
}

export class CoworkAdapters {
  // -------------------------------------------------------------------------
  // Public entry point
  // -------------------------------------------------------------------------
  async fetchAll(options: FetchAllOptions): Promise<CoworkJob[]> {
    const { search_term, limit = 100 } = options
    const perSource = Math.ceil(limit / 6)

    const results = await Promise.allSettled([
      this.fetchGreenhouse(search_term, perSource),
      this.fetchLever(search_term, perSource),
      this.fetchSmartRecruiters(search_term, perSource),
      this.fetchRemotive(search_term, perSource),
      this.fetchWeWorkRemotely(search_term, perSource),
      this.fetchAshby(search_term, perSource),
    ])

    const allJobs: CoworkJob[] = []
    const sources = ['greenhouse', 'lever', 'smartrecruiters', 'remotive', 'weworkremotely', 'ashby']

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value)
        console.log(`[Cowork] ${sources[i]}: ${result.value.length} jobs`)
      } else {
        console.warn(`[Cowork] ${sources[i]} failed:`, result.reason?.message ?? result.reason)
      }
    }

    console.log(`[Cowork] Total: ${allJobs.length} jobs from ${sources.length} sources`)
    return allJobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 1. Greenhouse (no API key — public job board JSON API)
  // -------------------------------------------------------------------------
  private async fetchGreenhouse(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []
    const terms = searchTerm.toLowerCase().split(' ')

    // Fetch from multiple companies in parallel (batches of 5)
    const batches = chunk(GREENHOUSE_COMPANIES, 5)
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(company =>
          this.get(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs`, {
            params: { content: true },
          })
        )
      )

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') continue
        const companyJobs = result.value?.jobs ?? []

        for (const job of companyJobs) {
          if (!matchesTerm(job.title, terms)) continue
          jobs.push({
            id: `greenhouse_${job.id}`,
            source: 'greenhouse',
            title: job.title,
            company: batch[i],
            location: job.location?.name ?? 'Unknown',
            remote: detectRemote(job.location?.name, job.title),
            url: job.absolute_url,
            description: job.content ?? undefined,
            posted_at: job.updated_at,
          })
          if (jobs.length >= limit) break
        }
        if (jobs.length >= limit) break
      }
      if (jobs.length >= limit) break
    }

    return jobs
  }

  // -------------------------------------------------------------------------
  // 2. Lever (no API key — public job board JSON API)
  // -------------------------------------------------------------------------
  private async fetchLever(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []
    const terms = searchTerm.toLowerCase().split(' ')

    const batches = chunk(LEVER_COMPANIES, 5)
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(company =>
          this.get(`https://api.lever.co/v0/postings/${company}`, {
            params: { mode: 'json' },
          })
        )
      )

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue

        for (const job of result.value) {
          if (!matchesTerm(job.text ?? '', terms)) continue
          jobs.push({
            id: `lever_${job.id}`,
            source: 'lever',
            title: job.text,
            company: batch[i],
            location: job.categories?.location ?? 'Unknown',
            remote: detectRemote(job.categories?.location, job.text),
            url: job.hostedUrl,
            description: job.descriptionPlain ?? undefined,
            posted_at: job.createdAt
              ? new Date(job.createdAt).toISOString()
              : undefined,
          })
          if (jobs.length >= limit) break
        }
        if (jobs.length >= limit) break
      }
      if (jobs.length >= limit) break
    }

    return jobs
  }

  // -------------------------------------------------------------------------
  // 3. SmartRecruiters (free public API, no key required for public listings)
  // -------------------------------------------------------------------------
  private async fetchSmartRecruiters(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []

    try {
      const data = await this.get('https://api.smartrecruiters.com/v1/jobs', {
        params: {
          q: searchTerm,
          limit: Math.min(limit, 100),
          status: 'PUBLISHED',
        },
      })

      for (const job of data?.content ?? []) {
        jobs.push({
          id: `smartrecruiters_${job.id}`,
          source: 'smartrecruiters',
          title: job.name,
          company: job.company?.name ?? 'Unknown',
          location: job.location?.city
            ? `${job.location.city}, ${job.location.country}`
            : 'Unknown',
          remote: job.location?.remote ? 'remote' : 'onsite',
          url: `https://jobs.smartrecruiters.com/${job.company?.identifier}/${job.id}`,
          posted_at: job.releasedDate,
        })
      }
    } catch (err) {
      console.warn('[Cowork] SmartRecruiters error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 4. Remotive (free public API, remote-only jobs)
  // -------------------------------------------------------------------------
  private async fetchRemotive(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []

    try {
      const data = await this.get('https://remotive.com/api/remote-jobs', {
        params: {
          search: searchTerm,
          limit: Math.min(limit, 100),
        },
      })

      for (const job of data?.jobs ?? []) {
        jobs.push({
          id: `remotive_${job.id}`,
          source: 'remotive',
          title: job.title,
          company: job.company_name,
          location: 'Remote',
          remote: 'remote',
          url: job.url,
          description: stripHtml(job.description ?? ''),
          posted_at: job.publication_date,
        })
      }
    } catch (err) {
      console.warn('[Cowork] Remotive error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 5. We Work Remotely (RSS feed — free, no key needed)
  // -------------------------------------------------------------------------
  private async fetchWeWorkRemotely(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []

    try {
      // WWR exposes category RSS feeds — use Programming & Software Development
      const categories = ['programming', 'full-stack', 'back-end']
      const terms = searchTerm.toLowerCase().split(' ')

      for (const cat of categories) {
        const xmlText = await this.getRaw(
          `https://weworkremotely.com/categories/remote-${cat}-jobs.rss`
        )
        if (!xmlText) continue

        const items = parseRssItems(xmlText)
        for (const item of items) {
          if (!matchesTerm(item.title, terms)) continue
          const { company, role } = parseWWRTitle(item.title)
          jobs.push({
            id: `wwr_${hashStr(item.link)}`,
            source: 'weworkremotely',
            title: role,
            company,
            location: 'Remote',
            remote: 'remote',
            url: item.link,
            description: stripHtml(item.description ?? ''),
            posted_at: item.pubDate,
          })
          if (jobs.length >= limit) break
        }
        if (jobs.length >= limit) break
      }
    } catch (err) {
      console.warn('[Cowork] WeWorkRemotely error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 6. Ashby (growing startup ATS — free public API like Greenhouse)
  // -------------------------------------------------------------------------
  private async fetchAshby(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []
    const terms = searchTerm.toLowerCase().split(' ')

    // Known companies using Ashby
    const ASHBY_COMPANIES = [
      'ramp', 'openai', 'cursor', 'anyscale', 'modal',
      'replit', 'perplexity', 'midjourney',
    ]

    const batches = chunk(ASHBY_COMPANIES, 4)
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(company =>
          this.get(`https://jobs.ashbyhq.com/api/non-user-facing/job-board/jobs`, {
            params: { organizationHostedJobsPageName: company },
          })
        )
      )

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') continue

        for (const job of result.value?.jobs ?? []) {
          if (!matchesTerm(job.title ?? '', terms)) continue
          jobs.push({
            id: `ashby_${job.id}`,
            source: 'ashby',
            title: job.title,
            company: batch[i],
            location: job.locationName ?? 'Unknown',
            remote: detectRemote(job.locationName, job.title),
            url: `https://jobs.ashbyhq.com/${batch[i]}/${job.id}`,
            posted_at: job.publishedDate,
          })
          if (jobs.length >= limit) break
        }
        if (jobs.length >= limit) break
      }
      if (jobs.length >= limit) break
    }

    return jobs
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------
  private async get(url: string, config?: AxiosRequestConfig): Promise<any> {
    const res = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; iCareerOS/1.0; +https://icareeros.com)',
        Accept: 'application/json',
      },
      ...config,
    })
    return res.data
  }

  private async getRaw(url: string): Promise<string | null> {
    try {
      const res = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        responseType: 'text',
        headers: { 'User-Agent': 'iCareerOS/1.0' },
      })
      return res.data as string
    } catch {
      return null
    }
  }
}

// -------------------------------------------------------------------------
// Utility helpers
// -------------------------------------------------------------------------

function matchesTerm(text: string, terms: string[]): boolean {
  if (!text || terms.length === 0) return true
  const lower = text.toLowerCase()
  return terms.some(t => lower.includes(t))
}

function detectRemote(location?: string | null, title?: string | null): RemoteType {
  const text = `${location ?? ''} ${title ?? ''}`.toLowerCase()
  if (text.includes('remote')) return 'remote'
  if (text.includes('hybrid')) return 'hybrid'
  if (text.includes('onsite') || text.includes('on-site') || text.includes('office')) return 'onsite'
  return 'unknown'
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function hashStr(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

function parseRssItems(xml: string): Array<{ title: string; link: string; description?: string; pubDate?: string }> {
  const items: Array<{ title: string; link: string; description?: string; pubDate?: string }> = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1] ?? ''
    const link = (/<link>(.*?)<\/link>/.exec(block))?.[1] ?? ''
    const description = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block))?.[1]
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]
    if (title && link) items.push({ title, link, description, pubDate })
  }

  return items
}

function parseWWRTitle(title: string): { company: string; role: string } {
  // WWR RSS titles are formatted as: "Company: Job Role at Company"
  const parts = title.split(': ')
  if (parts.length >= 2) {
    return { company: parts[0].trim(), role: parts.slice(1).join(': ').replace(/ at .+$/, '').trim() }
  }
  return { company: 'Unknown', role: title }
}
