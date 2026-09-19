import { readFile } from 'node:fs/promises'
import { isRecord } from '@/shared/validation'
import type {
  SessionSubagentUsage,
  SubagentUsageFacts,
} from '../../../domains/sessions/contract/background-work-contract'
import { transcriptPaths } from './discover'

function delegationFacts(line: string): Partial<SubagentUsageFacts> {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return {}
  }
  if (!isRecord(parsed) || !isRecord(parsed.payload)) return {}
  if (parsed.type === 'turn_context' && typeof parsed.payload.model === 'string')
    return { model: parsed.payload.model }
  if (parsed.type !== 'token_usage_record') return {}
  const usage = parsed.payload.thread_token_usage
  if (!isRecord(usage)) return {}
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
    return {}
  return { tokens: Math.max(0, input - cached) + output }
}

async function delegationFactsFromFile(filePath: string): Promise<Required<SubagentUsageFacts>> {
  const text = await readFile(filePath, 'utf8').catch(() => null)
  if (text === null) return { tokens: null, model: null }
  const facts: Required<SubagentUsageFacts> = { tokens: null, model: null }
  for (const line of text.split('\n')) {
    const reported = delegationFacts(line)
    if (reported.tokens !== undefined) facts.tokens = reported.tokens
    if (reported.model !== undefined) facts.model = reported.model
  }
  return facts
}

export async function readSubagentTokens(
  root: string,
  delegationIds: readonly string[],
): Promise<SessionSubagentUsage[]> {
  const paths = await transcriptPaths(root)
  const pathsById = new Map(
    paths.map(({ name, path }) => [name.replace(/\.jsonl$/, ''), path] as const),
  )
  return Promise.all(
    delegationIds.map(async (id) => ({
      id,
      ...(pathsById.has(id)
        ? await delegationFactsFromFile(pathsById.get(id) ?? '')
        : { tokens: null, model: null }),
    })),
  )
}
