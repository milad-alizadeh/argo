// Every request to GitHub, and the one place a status code becomes a failure the cockpit can name.
// GitHub throttles with the same 403 it refuses a token with, so the headers are read here, where
// they still exist.

export type GitHubFailure =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'unreachable'
export type GitHubRead<T> = { ok: true; value: T } | { ok: false; failure: GitHubFailure }

const TIMEOUT_MILLISECONDS = 15_000
// GitHub's own ceiling for `per_page`, and a backstop so a runaway listing cannot walk forever.
const PAGE_SIZE = 100
const PAGE_LIMIT = 20

export const failed = (failure: GitHubFailure) => ({ ok: false, failure }) as const

async function send(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      // GitHub's OAuth endpoints answer form-encoded without this, and its API refuses a request
      // with no User-Agent.
      headers: { Accept: 'application/json', 'User-Agent': 'Argo', ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS),
      redirect: 'error',
    })
  } catch {
    return null
  }
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

// The OAuth endpoints answer a pending grant, a refusal and a success all with a JSON body, so
// the body and not the status is the answer. Only a body that is not JSON is a transport failure.
export async function postForm(
  url: string,
  form: Record<string, string>,
): Promise<GitHubRead<unknown>> {
  const response = await send(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  })
  if (!response || response.status >= 500) return failed('unreachable')
  const body = await json(response)
  return body === undefined ? failed('unreachable') : { ok: true, value: body }
}

function throttled(response: Response): boolean {
  if (response.status === 429) return true
  return (
    response.status === 403 &&
    (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'))
  )
}

const REFUSALS: Record<number, GitHubFailure> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
}

function nextPage(response: Response, origin: string): string | null {
  const link = response.headers.get('link')
  const match = link?.match(/<([^>]+)>;\s*rel="next"/)
  if (!match?.[1]) return null
  // A bearer token follows the link, so a link off the API host is not followed.
  try {
    return new URL(match[1]).origin === origin ? match[1] : null
  } catch {
    return null
  }
}

type Page = { body: unknown; next: string | null }

async function getPage(url: string, token: string): Promise<GitHubRead<Page>> {
  const response = await send(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response) return failed('unreachable')
  if (throttled(response)) return failed('rate-limited')
  const refusal = REFUSALS[response.status]
  if (refusal) return failed(refusal)
  if (!response.ok) return failed('unreachable')
  const body = await json(response)
  if (body === undefined) return failed('unreachable')
  return { ok: true, value: { body, next: nextPage(response, new URL(url).origin) } }
}

export async function get(url: string, token: string): Promise<GitHubRead<unknown>> {
  const page = await getPage(url, token)
  return page.ok ? { ok: true, value: page.value.body } : page
}

// Every item of one listing, following GitHub's own `next` link rather than guessing page numbers.
export async function getAll(url: string, token: string): Promise<GitHubRead<unknown[]>> {
  const items: unknown[] = []
  let next: string | null = `${url}${url.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}`
  for (let page = 0; next && page < PAGE_LIMIT; page += 1) {
    const read: GitHubRead<Page> = await getPage(next, token)
    if (!read.ok) return read
    if (!Array.isArray(read.value.body)) return failed('unreachable')
    items.push(...read.value.body)
    next = read.value.next
  }
  return { ok: true, value: items }
}
