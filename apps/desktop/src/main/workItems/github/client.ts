import type { Http } from '../http'

// The authenticated read side of the GitHub API. Two things live here rather than in the
// adapter, because both are transport concerns the adapter should not have to spell: following
// GitHub's own `link` header to the end of a list, and CONDITIONAL requests. A desktop app is
// polled rather than pushed (ADR-0018), so every poll re-asks a question whose answer usually
// has not changed; sending the previous `etag` back turns that into a 304 that costs no rate
// limit and returns the body we already hold.

const API_BASE = 'https://api.github.com'
const API_VERSION = '2022-11-28'

export interface GitHubClientOptions {
  http: Http
  token: string
  /** Overridable so a suite can assert the URLs a read produced without a network. */
  apiBase?: string
}

export interface GitHubClient {
  /** Every page of a list endpoint. Throws with the provider's own words where it refused —
   * one throw the adapter catches once, rather than a result threaded through every read. */
  list(path: string): Promise<unknown[]>
}

interface Page {
  items: unknown[]
  next: string | null
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  const base = options.apiBase ?? API_BASE
  const cache = new Map<string, { etag: string; items: unknown[] }>()

  async function page(url: string): Promise<Page> {
    const cached = cache.get(url)
    const response = await options.http({
      method: 'GET',
      url,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${options.token}`,
        'x-github-api-version': API_VERSION,
        ...(cached === undefined ? {} : { 'if-none-match': cached.etag }),
      },
    })
    const next = nextLink(response.headers.link)
    if (response.status === 304 && cached !== undefined) return { items: cached.items, next }
    if (response.status < 200 || response.status >= 300) throw new Error(refusal(response.body))

    const items = Array.isArray(response.body) ? response.body : []
    const etag = response.headers.etag
    if (etag !== undefined) cache.set(url, { etag, items })
    return { items, next }
  }

  return {
    async list(path) {
      const items: unknown[] = []
      let url: string | null = `${base}${path}`
      // Bounded by the provider's own paging rather than by a page count of ours: a truncated
      // backlog would read as a shorter one, which is a fabricated answer.
      while (url !== null) {
        const result: Page = await page(url)
        items.push(...result.items)
        url = result.next
      }
      return items
    },
  }
}

// GitHub states why it refused in the body's `message`. Reporting it verbatim is the only
// honest answer — a rate limit, a revoked grant and a missing repo want different actions from
// the user, and one invented sentence would hide which it was.
function refusal(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body
    if (typeof message === 'string' && message.trim() !== '') return message
  }
  return 'the provider refused the read'
}

// `<https://…?page=2>; rel="next", <https://…?page=9>; rel="last"` — the provider's own
// paging, followed rather than reconstructed, so a URL shape change never silently truncates.
function nextLink(header: string | undefined): string | null {
  if (header === undefined) return null
  for (const part of header.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part)
    if (match?.[1] !== undefined) return match[1]
  }
  return null
}
