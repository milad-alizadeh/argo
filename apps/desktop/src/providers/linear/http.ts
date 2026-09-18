// Every GraphQL request to Linear, and the one place its answer becomes a failure the cockpit can
// name. Linear refuses a token and throttles a caller with a 400 whose error carries a code, so the
// code is read here, where the body still exists.
import { isRecord } from '../../shared/validation'
import { readJson, send } from '../request'
import type { LinearEndpoints } from './endpoints'

export type LinearFailure = 'unauthorized' | 'forbidden' | 'rate-limited' | 'unreachable'
export type LinearRead<T> = { ok: true; value: T } | { ok: false; failure: LinearFailure }

export const failed = (failure: LinearFailure) => ({ ok: false, failure }) as const

// Linear's `extensions.code` values for the refusals the cockpit tells apart.
const CODES: Record<string, LinearFailure> = {
  AUTHENTICATION_ERROR: 'unauthorized',
  FORBIDDEN: 'forbidden',
  RATELIMITED: 'rate-limited',
}

const STATUSES: Record<number, LinearFailure> = {
  401: 'unauthorized',
  403: 'forbidden',
  429: 'rate-limited',
}

function coded(body: unknown): LinearFailure | null {
  if (!isRecord(body) || !Array.isArray(body.errors)) return null
  for (const error of body.errors) {
    const code = isRecord(error) && isRecord(error.extensions) ? error.extensions.code : undefined
    const failure = typeof code === 'string' ? CODES[code] : undefined
    if (failure) return failure
  }
  return null
}

// The Account a request is made as.
export type Caller = { endpoints: LinearEndpoints; token: string }

// The `data` of one GraphQL document. Any error without data is a failure: a partial answer would
// draw a backlog with holes in it.
export async function query(
  { endpoints, token }: Caller,
  document: string,
  variables: Record<string, unknown> = {},
): Promise<LinearRead<Record<string, unknown>>> {
  const response = await send(`${endpoints.api}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: document, variables }),
  })
  if (!response || response.status >= 500) return failed('unreachable')
  const body = await readJson(response)
  const refusal = coded(body) ?? STATUSES[response.status]
  if (refusal) return failed(refusal)
  if (!response.ok || !isRecord(body) || !isRecord(body.data)) return failed('unreachable')
  return { ok: true, value: body.data }
}
