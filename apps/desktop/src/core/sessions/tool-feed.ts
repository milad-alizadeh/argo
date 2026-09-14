import { z } from 'zod'
import { claudeQuestionSchema } from './claude-contract'
import type { SessionFeedRow } from './models'
import type { ToolCall } from './transcript'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
type AskRow = Extract<SessionFeedRow, { shape: 'ask' }>
export type ToolResult = { content: string | null; failed: boolean }

const ASK_TOOL = 'AskUserQuestion'
const claudeQuestionCallInputSchema = z.strictObject({
  questions: z.array(claudeQuestionSchema).min(1),
})

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

function toolDetail(call: ToolCall): string | null {
  if (
    call.name === 'Edit' &&
    typeof call.input.old_string === 'string' &&
    typeof call.input.new_string === 'string'
  ) {
    return `+${call.input.new_string.split('\n').length} −${call.input.old_string.split('\n').length}`
  }
  return null
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

function toolText(call: ToolCall): string | null {
  return call.name === 'Bash' && typeof call.input.command === 'string' ? call.input.command : null
}

function toolRow(call: ToolCall, results: Map<string, ToolResult>): ToolRow {
  const result = results.get(call.id)
  return {
    shape: 'tool',
    id: call.id,
    ...toolPresentation(call),
    detail: toolDetail(call),
    status: toolStatus(result),
    evidence: evidence(call, result),
    text: toolText(call),
  }
}

// `AskUserQuestion`'s own input carries the structured question verbatim, so the row draws it
// directly rather than summarising it into a label the way every other tool call is described.
function askRow(call: ToolCall, results: Map<string, ToolResult>): AskRow | null {
  const parsed = claudeQuestionCallInputSchema.safeParse(call.input)
  if (!parsed.success) return null
  return {
    shape: 'ask',
    id: call.id,
    questions: parsed.data.questions,
    answer: results.get(call.id)?.content ?? null,
    unsupported: null,
  }
}

function feedRow(call: ToolCall, results: Map<string, ToolResult>): SessionFeedRow {
  if (call.name === ASK_TOOL) return askRow(call, results) ?? toolRow(call, results)
  return toolRow(call, results)
}

export function toolRows(calls: ToolCall[], results: Map<string, ToolResult>): SessionFeedRow[] {
  return calls.map((call) => feedRow(call, results))
}
