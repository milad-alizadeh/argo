import { readFile } from 'node:fs/promises'
import { isRecord } from '@/boundary'
import { transcriptPaths } from './discover'

function tokenCount(line: string): number | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.type !== 'token_usage_record' || !isRecord(parsed.payload))
    return null
  const usage = parsed.payload.thread_token_usage
  if (!isRecord(usage)) return null
  const input = usage.input_tokens
  const cached = usage.cached_input_tokens
  const output = usage.output_tokens
  if (
    typeof input !== 'number' ||
    typeof cached !== 'number' ||
    typeof output !== 'number' ||
    !Number.isFinite(input) ||
    !Number.isFinite(cached) ||
    !Number.isFinite(output)
  )
    return null
  return Math.max(0, input - cached) + output
}

async function tokenCountFromFile(filePath: string): Promise<number | null> {
  const text = await readFile(filePath, 'utf8').catch(() => null)
  if (text === null) return null
  const reported = text.split('\n').flatMap((line) => {
    const count = tokenCount(line)
    return count === null ? [] : [count]
  })
  return reported.at(-1) ?? null
}

export async function readDelegationTokens(
  root: string,
  delegationIds: readonly string[],
): Promise<{ id: string; tokens: number | null }[]> {
  const paths = await transcriptPaths(root)
  const pathsById = new Map(
    paths.map(({ name, path }) => [name.replace(/\.jsonl$/, ''), path] as const),
  )
  return Promise.all(
    delegationIds.map(async (id) => ({
      id,
      tokens: await (pathsById.has(id) ? tokenCountFromFile(pathsById.get(id) ?? '') : null),
    })),
  )
}
