// =============================================================================
// iCareerOS — Extended Source Adapters (Phase 0, Task 0.4)
// 6 additional free sources completing the 12-source roster
//
// Sources added here:
//   7.  Adzuna        — aggregator API (free tier, key required)
//   8.  Jooble        — aggregator API (free tier, key required)
//   9.  Himalayas     — remote jobs API (no key, attribution required)
//   10. RemoteOK      — remote jobs API (no key, attribution required)
//   11. Jobicy        — remote jobs JSON API (no key, attribution required)
//   12. Arbeitnow     — German-focused remote API (no key)
//
// Sources 1–6 (Greenhouse, Lever, SmartRecruiters, Remotive, WWR, Ashby)
// are implemented in cowork-adapters.ts — this file extends that set.
//
// Attribution requirements:
//   - RemoteOK: must display "Jobs via RemoteOK" with link to remoteok.com
//   - Remotive: must display "Jobs via Remotive" with link to remotive.com
//   - Himalayas: must display "Jobs via Himalayas" with link to himalayas.com
//   - Jobicy: must display "Jobs via Jobicy" with link to jobicy.com
// =============================================================================

import axios, { AxiosRequestConfig } from 'axios'
import type { CoworkJob, RemoteType } from './types'

const REQUEST_TIMEOUT = 20_000

// ── Cheerio fallback (used when Firecrawl limit hit for JSON-LD crawl) ──────
// We use lightweight regex-based HTML parsing to keep the bundle small.

// ── JSON-LD company career pages to crawl ────────────────────────────────────
const JSONLD_CAREER_PAGES = [
  { company: 'stripe',      url: 'https://stripe.com/jobs' },
  { company: 'shopify',     url: 'https://www.shopify.com/careers' },
  { company: 'cloudflare',  url: 'https://www.cloudflare.com/careers/jobs/' },
  { company: 'gitlab',      url: 'https://about.gitlab.com/jobs/' },
  { company: 'elastic',     url: 'https://www.elastic.co/about/careers' },
]

export interface ExtendedFetchOptions {
  search_term: string
  limit?: number
  adzuna_app_id?: string
  adzuna_app_key?: string
  jooble_api_key?: string
  country?: string
}

export class ExtendedAdapters {
  // -------------------------------------------------------------------------
  // Fetch all 6 extended sources
  // -------------------------------------------------------------------------
  async fetchAll(options: ExtendedFetchOptions): Promise<CoworkJob[]> {
    const { search_term, limit = 100, country = 'us' } = options
    const perSource = Math.ceil(limit / 6)

    const results = await Promise.allSettled([
      this.fetchAdzuna(search_term, perSource, country, options.adzuna_app_id, options.adzuna_app_key),
      this.fetchJooble(search_term, perSource, options.jooble_api_key),
      this.fetchHimalayas(search_term, perSource),
      this.fetchRemoteOK(search_term, perSource),
      this.fetchJobicy(search_term, perSource),
      this.fetchArbeitnow(search_term, perSource),
    ])

    const sources = ['adzuna', 'jooble', 'himalayas', 'remoteok', 'jobicy', 'arbeitnow']
    const allJobs: CoworkJob[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value)
        console.log(`[ExtAdapters] ${sources[i]}: ${result.value.length} jobs`)
      } else {
        console.warn(`[ExtAdapters] ${sources[i]} failed:`, result.reason?.message ?? result.reason)
      }
    }

    return allJobs
  }

  // -------------------------------------------------------------------------
  // 7. Adzuna (aggregator, free tier: 250 req/month)
  // API docs: developer.adzuna.com
  // -------------------------------------------------------------------------
  async fetchAdzuna(
    searchTerm: string,
    limit: number,
    country = 'us',
    appId?: string,
    appKey?: string
  ): Promise<CoworkJob[]> {
    const id = appId ?? process.env.ADZUNA_APP_ID
    const key = appKey ?? process.env.ADZUNA_APP_KEY

    if (!id || !key) {
      console.warn('[ExtAdapters] Adzuna: missing ADZUNA_APP_ID / ADZUNA_APP_KEY — skipping')
      return []
    }

    const jobs: CoworkJob[] = []

    try {
      const data = await this.get(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
        {
          params: {
            app_id: id,
            app_key: key,
            what: searchTerm,
            results_per_page: Math.min(limit, 50),
            content_type: 'application/json',
          },
        }
      )

      for (const result of data?.results ?? []) {
        jobs.push({
          id: `adzuna_${result.id}`,
          source: 'adzuna',
          title: result.title,
          company: result.company?.display_name ?? 'Unknown',
          location: result.location?.display_name ?? 'Unknown',
          remote: detectRemote(result.location?.display_name, result.title),
          url: result.redirect_url,
          description: result.description,
          salary_min: result.salary_min ? Math.round(result.salary_min) : undefined,
          salary_max: result.salary_max ? Math.round(result.salary_max) : undefined,
          posted_at: result.created,
        })
      }
    } catch (err) {
      console.warn('[ExtAdapters] Adzuna error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 8. Jooble (aggregator, free tier with API key)
  // API docs: jooble.org/api
  // -------------------------------------------------------------------------
  async fetchJooble(
    searchTerm: string,
    limit: number,
    apiKey?: string
  ): Promise<CoworkJob[]> {
    const key = apiKey ?? process.env.JOOBLE_API_KEY

    if (!key) {
      console.warn('[ExtAdapters] Jooble: missing JOOBLE_API_KEY — skipping')
      return []
    }

    const jobs: CoworkJob[] = []

    try {
      const data = await this.post(
        `https://jooble.org/api/${key}`,
        {
          keywords: searchTerm,
          page: 1,
          resultsOnPage: Math.min(limit, 20),
        }
      )

      for (const job of data?.jobs ?? []) {
        jobs.push({
          id: `jooble_${hashStr(job.link ?? job.title)}`,
          source: 'jooble',
          title: stripHtml(job.title ?? ''),
          company: stripHtml(job.company ?? 'Unknown'),
          location: job.location ?? 'Unknown',
          remote: detectRemote(job.location, job.title),
          url: job.link,
          description: stripHtml(job.snippet ?? ''),
          salary_min: parseSalary(job.salary)?.min,
          salary_max: parseSalary(job.salary)?.max,
          posted_at: job.updated,
        })
      }
    } catch (err) {
      console.warn('[ExtAdapters] Jooble error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 9. Himalayas (remote jobs JSON API — no key, attribution required)
  // Attribution: "Jobs via Himalayas" — https://himalayas.app
  // API docs: himalayas.app/api
  // -------------------------------------------------------------------------
  async fetchHimalayas(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []

    try {
      const data = await this.get('https://himalayas.app/jobs/api', {
        params: {
          q: searchTerm,
          limit: Math.min(limit, 100),
        },
      })

      for (const job of data?.jobs ?? []) {
        jobs.push({
          id: `himalayas_${job.slug ?? hashStr(job.title + job.companyName)}`,
          source: 'himalayas',
          title: job.title,
          company: job.companyName ?? 'Unknown',
          location: 'Remote',
          remote: 'remote',
          url: `https://himalayas.app/jobs/${job.companySlug}/${job.slug}`,
          description: job.jobDescription?.slice(0, 2000),
          posted_at: job.publishedAt,
          // Attribution requirement
          attribution: 'Jobs via Himalayas',
        } as CoworkJob & { attribution: string })
      }
    } catch (err) {
      console.warn('[ExtAdapters] Himalayas error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 10. RemoteOK (remote jobs JSON API — no key, attribution required)
  // Attribution: must display "RemoteOK" with link to remoteok.com
  // API: remoteok.com/api
  // -------------------------------------------------------------------------
  async fetchRemoteOK(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []

    try {
      // RemoteOK returns all jobs — we filter client-side
      const data = await this.get('https://remoteok.com/api', {
        headers: {
          // RemoteOK requires a user-agent that identifies the app
          'User-Agent': 'iCareerOS/1.0 (https://icareeros.com; contact@icareeros.com)',
        },
      })

      // First item is a legal notice — skip it
      const items: any[] = Array.isArray(data) ? data.slice(1) : []
      const terms = searchTerm.toLowerCase().split(' ')

      for (const job of items) {
        if (!job || !job.position) continue
        if (!matchesTerm(job.position, terms) && !matchesTerm(job.tags?.join(' ') ?? '', terms)) continue

        jobs.push({
          id: `remoteok_${job.id ?? hashStr(job.url)}`,
          source: 'remoteok',
          title: job.position,
          company: job.company ?? 'Unknown',
          location: 'Remote',
          remote: 'remote',
          url: job.url,
          description: stripHtml(job.description ?? '').slice(0, 2000),
          posted_at: job.date,
          // Attribution: per RemoteOK ToS, must display "via RemoteOK"
          attribution: 'Jobs via RemoteOK',
        } as CoworkJob & { attribution: string })

        if (jobs.length >= limit) break
      }
    } catch (err) {
      console.warn('[ExtAdapters] RemoteOK error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 11. Jobicy (remote jobs JSON feed — no key, attribution required)
  // Attribution: "Jobs via Jobicy" — jobicy.com
  // API: jobicy.com/api/v2/remote-jobs
  // -------------------------------------------------------------------------
  async fetchJobicy(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []

    try {
      const data = await this.get('https://jobicy.com/api/v2/remote-jobs', {
        params: {
          count: Math.min(limit, 50),
          tag: searchTerm.replace(/\s+/g, '-').toLowerCase(),
        },
      })

      for (const job of data?.jobs ?? []) {
        jobs.push({
          id: `jobicy_${job.id ?? hashStr(job.url)}`,
          source: 'jobicy',
          title: job.jobTitle,
          company: job.companyName ?? 'Unknown',
          location: 'Remote',
          remote: 'remote',
          url: job.url,
          description: stripHtml(job.jobDescription ?? '').slice(0, 2000),
          posted_at: job.pubDate,
          attribution: 'Jobs via Jobicy',
        } as CoworkJob & { attribution: string })
      }
    } catch (err) {
      console.warn('[ExtAdapters] Jobicy error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // 12. Arbeitnow (remote-focused job board JSON API — no key)
  // API: arbeitnow.com/api/job-board-api
  // -------------------------------------------------------------------------
  async fetchArbeitnow(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []

    try {
      const data = await this.get('https://www.arbeitnow.com/api/job-board-api', {
        params: {
          search: searchTerm,
          page: 1,
        },
      })

      const terms = searchTerm.toLowerCase().split(' ')

      for (const job of data?.data ?? []) {
        if (!matchesTerm(job.title, terms)) continue

        jobs.push({
          id: `arbeitnow_${job.slug ?? hashStr(job.url)}`,
          source: 'arbeitnow',
          title: job.title,
          company: job.company_name ?? 'Unknown',
          location: job.location ?? 'Remote',
          remote: job.remote ? 'remote' : detectRemote(job.location, job.title),
          url: job.url,
          description: stripHtml(job.description ?? '').slice(0, 2000),
          posted_at: job.created_at,
        })

        if (jobs.length >= limit) break
      }
    } catch (err) {
      console.warn('[ExtAdapters] Arbeitnow error:', (err as Error).message)
    }

    return jobs.slice(0, limit)
  }

  // -------------------------------------------------------------------------
  // Bonus: JSON-LD Career Page Crawler (company sites with Schema.org markup)
  // Uses Cheerio-style regex — no headless browser needed
  // -------------------------------------------------------------------------
  async fetchJsonLd(searchTerm: string, limit: number): Promise<CoworkJob[]> {
    const jobs: CoworkJob[] = []
    const terms = searchTerm.toLowerCase().split(' ')

    for (const { company, url } of JSONLD_CAREER_PAGES) {
      if (jobs.length >= limit) break

      try {
        const html = await this.getRaw(url)
        if (!html) continue

        // Extract JSON-LD blocks from <script type="application/ld+json">
        const ldBlocks = extractJsonLd(html)

        for (const block of ldBlocks) {
          // JobPosting schema
          if (block['@type'] === 'JobPosting') {
            const title = block.title ?? ''
            if (!matchesTerm(title, terms)) continue

            jobs.push({
              id: `jsonld_${hashStr(block.url ?? title + company)}`,
              source: 'jsonld_crawl',
              title,
              company: block.hiringOrganization?.name ?? company,
              location: block.jobLocation?.address?.addressLocality ?? 'Unknown',
              remote: block.jobLocationType === 'TELECOMMUTE' ? 'remote' : detectRemote(
                block.jobLocation?.address?.addressLocality,
                title
              ),
              url: block.url ?? url,
              description: block.description?.slice(0, 2000),
              salary_min: block.baseSalary?.value?.minValue,
              salary_max: block.baseSalary?.value?.maxValue,
              posted_at: block.datePosted,
            })

            if (jobs.length >= limit) break
          }

          // ItemList of JobPosting
          if (block['@type'] === 'ItemList' && Array.isArray(block.itemListElement)) {
            for (const item of block.itemListElement) {
              const posting = item.item ?? item
              if (posting['@type'] !== 'JobPosting') continue
              const title = posting.title ?? ''
              if (!matchesTerm(title, terms)) continue

              jobs.push({
                id: `jsonld_${hashStr(posting.url ?? title + company)}`,
                source: 'jsonld_crawl',
                title,
                company: posting.hiringOrganization?.name ?? company,
                location: posting.jobLocation?.address?.addressLocality ?? 'Unknown',
                remote: posting.jobLocationType === 'TELECOMMUTE' ? 'remote' : 'unknown',
                url: posting.url ?? url,
                description: posting.description?.slice(0, 2000),
                posted_at: posting.datePosted,
              })

              if (jobs.length >= limit) break
            }
          }
        }

        console.log(`[ExtAdapters] JSON-LD ${company}: ${jobs.filter(j => j.source === 'jsonld_crawl').length} jobs`)
      } catch (err) {
        console.warn(`[ExtAdapters] JSON-LD ${company} error:`, (err as Error).message)
      }
    }

    return jobs.slice(0, limit)
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
        ...(config?.headers ?? {}),
      },
      ...config,
    })
    return res.data
  }

  private async post(url: string, body: unknown, config?: AxiosRequestConfig): Promise<any> {
    const res = await axios.post(url, body, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'iCareerOS/1.0',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(config?.headers ?? {}),
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
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; iCareerOS/1.0; +https://icareeros.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
      return res.data as string
    } catch {
      return null
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function detectRemote(location?: string | null, title?: string | null): RemoteType {
  const text = `${location ?? ''} ${title ?? ''}`.toLowerCase()
  if (text.includes('remote')) return 'remote'
  if (text.includes('hybrid')) return 'hybrid'
  if (text.includes('onsite') || text.includes('on-site') || text.includes('office')) return 'onsite'
  return 'unknown'
}

function matchesTerm(text: string, terms: string[]): boolean {
  if (!text || terms.length === 0) return true
  const lower = text.toLowerCase()
  return terms.some(t => lower.includes(t))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function hashStr(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

function parseSalary(raw?: string): { min?: number; max?: number } | null {
  if (!raw) return null
  const numbers = raw.replace(/[^0-9.,-]/g, '').split(/[-–—,]/).map(s => parseFloat(s)).filter(n => !isNaN(n) && n > 0)
  if (numbers.length === 0) return null
  // Convert monthly/hourly to annual if plausible
  const annualise = (n: number) => n < 500 ? n * 2080 : n < 10000 ? n * 12 : n
  const [a, b] = numbers.map(annualise)
  return { min: a, max: b ?? a }
}

function extractJsonLd(html: string): any[] {
  const blocks: any[] = []
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed)) {
        blocks.push(...parsed)
      } else {
        blocks.push(parsed)
      }
    } catch {
      // skip malformed JSON-LD
    }
  }

  return blocks
}

// Singleton
export const extendedAdapters = new ExtendedAdapters()
