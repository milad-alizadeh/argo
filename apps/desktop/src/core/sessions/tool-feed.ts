import type { SessionFeedRow } from './models'
import type { ToolCall } from './transcript'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
export type ToolResult = { content: string | null; failed: boolean }

const TOOL_DETAILS = {
  Bash: (call: ToolCall) => ({
    kind: 'command' as const,
    label: `Ran ${String(call.input.command ?? 'command').split('\n')[0]}`,
  }),
  Edit: (call: ToolCall) => ({ kind: 'edited' as const, label: `Edited ${filePath(call)}` }),
  Read: (call: ToolCall) => ({ kind: 'read' as const, label: `Read ${filePath(call)}` }),
  Write: (call: ToolCall) => ({ kind: 'created' as const, label: `Created ${filePath(call)}` }),
} as const

const EVIDENCE_KINDS = { Bash: 'output', Edit: 'diff', Read: 'document' } as const

function filePath(call: ToolCall) {
  if (typeof call.input.file_path !== 'string') return 'file'
  return call.input.file_path.split('/').filter(Boolean).at(-1) ?? call.input.file_path
}

function toolPresentation(call: ToolCall) {
  return (
    TOOL_DETAILS[call.name as keyof typeof TOOL_DETAILS]?.(call) ?? {
      kind: 'tool' as const,
      label: 'Called an unclassified tool',
    }
  )
}

function toolDetail(call: ToolCall, result: ToolResult | undefined): string | null {
  if (
    call.name === 'Edit' &&
    typeof call.input.old_string === 'string' &&
    typeof call.input.new_string === 'string'
  ) {
    return `+${call.input.new_string.split('\n').length} −${call.input.old_string.split('\n').length}`
  }
  const passed = result?.content?.match(/\b(\d+) pass(?:ed)?\b/i)?.[1]
  return passed === undefined ? null : `${passed} passed`
}

function evidence(call: ToolCall, result: ToolResult | undefined): ToolRow['evidence'] {
  const presentation = toolPresentation(call)
  const source =
    call.name === 'Edit' &&
    typeof call.input.old_string === 'string' &&
    typeof call.input.new_string === 'string'
      ? `-${call.input.old_string}\n+${call.input.new_string}`
      : (result?.content ?? null)
  if (source === null) return null
  const kind = EVIDENCE_KINDS[call.name as keyof typeof EVIDENCE_KINDS] ?? 'output'
  return { kind, title: presentation.label, source }
}

function toolStatus(result: ToolResult | undefined): ToolRow['status'] {
  if (result === undefined) return 'running'
  return result.failed ? 'failed' : 'succeeded'
}

function toolRow(call: ToolCall, results: Map<string, ToolResult>): ToolRow {
  const result = results.get(call.id)
  return {
    shape: 'tool',
    id: call.id,
    ...toolPresentation(call),
    detail: toolDetail(call, result),
    status: toolStatus(result),
    evidence: evidence(call, result),
  }
}

export function toolRows(calls: ToolCall[], results: Map<string, ToolResult>): ToolRow[] {
  return calls.map((call) => toolRow(call, results))
}

function countLabel(verb: string, noun: string, count: number) {
  return `${verb} ${count} ${noun}${count === 1 ? '' : 's'}`
}

const TOOL_GROUP_TITLES: Record<ToolRow['kind'], (count: number) => string> = {
  command: (count) => countLabel('Ran', 'command', count),
  read: (count) => countLabel('Read', 'file', count),
  edited: (count) => countLabel('Edited', 'file', count),
  created: (count) => countLabel('Created', 'file', count),
  tool: (count) => countLabel('Called', 'tool', count),
}

function toolGroupLabel(calls: ToolRow[]) {
  const counts: Record<ToolRow['kind'], number> = {
    command: 0,
    read: 0,
    edited: 0,
    created: 0,
    tool: 0,
  }
  for (const call of calls) counts[call.kind] += 1
  return Object.entries(counts)
    .flatMap(([kind, count]) =>
      count === 0 ? [] : [TOOL_GROUP_TITLES[kind as ToolRow['kind']](count)],
    )
    .join(' · ')
}

export function groupToolRuns(rows: SessionFeedRow[]): SessionFeedRow[] {
  const grouped: SessionFeedRow[] = []
  for (let index = 0; index < rows.length; ) {
    const row = rows[index]
    if (row?.shape !== 'tool') {
      if (row !== undefined) grouped.push(row)
      index += 1
      continue
    }
    const calls: ToolRow[] = []
    while (rows[index]?.shape === 'tool') calls.push(rows[index++] as ToolRow)
    if (calls.length === 1) grouped.push(calls[0] as ToolRow)
    else {
      grouped.push({
        shape: 'tool-group',
        id: `tool-group:${calls.map(({ id }) => id).join(':')}`,
        label: toolGroupLabel(calls),
        calls,
      })
    }
  }
  return grouped
}
