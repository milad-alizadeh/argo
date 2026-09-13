// One request to a provider, bounded in time and never redirected: a bearer token is sent only to
// the host it was written for. Every failure to get an answer is `null`, which each provider names.

const TIMEOUT_MILLISECONDS = 15_000

export async function send(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      // GitHub's OAuth endpoints answer form-encoded without the Accept header, and its API refuses
      // a request with no User-Agent.
      headers: { Accept: 'application/json', 'User-Agent': 'Argo', ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS),
      redirect: 'error',
    })
  } catch {
    return null
  }
}

// A body that is not JSON is `undefined`, never a throw.
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export const formBody = (form: Record<string, string>): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(form).toString(),
})
