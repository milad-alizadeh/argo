// The limit lives in the person's own Codex config; the app-server reads and writes it for Argo.
import { z } from 'zod'
import type { CodexRequest, ConfigWriteResponse } from '../app-server'
import { autoCompactLimitSchema } from '../auto-compact-limit'

const KEY = 'model_auto_compact_token_limit'

// The generated `Config` types the value as a bigint; on the wire it is a JSON number or null.
const configReadSchema = z.object({
  config: z.object({ [KEY]: z.number().int().nullable().optional() }),
})

const configWriteSchema = z.object({
  status: z.enum(['ok', 'okOverridden']),
}) satisfies z.ZodType<Pick<ConfigWriteResponse, 'status'>>

function configuredLimit(response: unknown): number | null {
  const value = configReadSchema.parse(response).config[KEY]
  if (value === null || value === undefined) return null
  const parsed = autoCompactLimitSchema.safeParse(value)
  if (parsed.success) return parsed.data
  throw new Error(`${KEY} = ${value} in the Codex config is outside the range Argo can show.`)
}

export function readAutoCompactLimit(request: CodexRequest): Promise<number | null> {
  return request('config/read', {}, configuredLimit)
}

// Another config layer can override the written value, so the limit then in effect is read back.
export async function writeAutoCompactLimit(
  request: CodexRequest,
  chosen: number,
): Promise<number | null> {
  const limit = autoCompactLimitSchema.parse(chosen)
  const written = await request(
    'config/value/write',
    { keyPath: KEY, value: limit, mergeStrategy: 'replace' },
    (value) => configWriteSchema.parse(value),
  )
  return written.status === 'ok' ? limit : readAutoCompactLimit(request)
}
