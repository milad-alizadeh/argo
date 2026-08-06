// The one seam every adapter reaches the network through, and the reason the suites can run a
// provider's real behaviour without a network: a test supplies a fake `Http` and asserts through
// the canonical port interface rather than around it.

export interface HttpRequest {
  method: 'GET' | 'POST'
  url: string
  headers: Record<string, string>
  /** JSON-encoded already, because only the caller knows the provider's body shape. */
  body?: string
}

export interface HttpResponse {
  status: number
  /** Parsed JSON where the response carried any, `null` otherwise — a 304 has no body at all. */
  body: unknown
  /** Lower-cased header names, so a caller never has to guess a server's casing. */
  headers: Record<string, string>
}

export type Http = (request: HttpRequest) => Promise<HttpResponse>

/** The real transport. `fetch` is node's own since 18, so this adds no dependency. */
export const nodeHttp: Http = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
  })
  return {
    status: response.status,
    body: await readJson(response),
    headers: Object.fromEntries(response.headers),
  }
}

// A provider that answered with something other than JSON has told us nothing usable, and
// throwing here would turn a malformed page into a crash rather than a failed read.
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text.trim() === '') return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
