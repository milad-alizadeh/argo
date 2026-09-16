import { z } from 'zod'
import { claudeQuestionSchema } from './claude-contract'
import type { SessionFeedRow } from './models'
import type { ToolCall } from './transcript'
import { createdPatch, unifiedPatch } from './unified-patch'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
type AskRow = Extract<SessionFeedRow, { shape: 'ask' }>
export type ToolResult = { content: string | null; failed: boolean }

// A call's result and a Skill's body both arrive as later, separate records, keyed by call id.
export type ToolEvidence = { results: Map<string, ToolResult>; skillBodies: Map<string, string> }

const ASK_TOOL = 'AskUserQuestion'
const claudeQuestionCallInputSchema = z.strictObject({
  questions: z.array(claudeQuestionSchema).min(1),
})

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const TOOL_DETAILS = {
  // The agent's own description is already a whole label; the raw command, first line, is the fallback.
  Bash: (call: ToolCall) => ({
    kind: 'command' as const,
    label:
      text(call.input.description) ??
      `Ran ${String(call.input.command ?? 'command').split('\n')[0]}`,
  }),
  Edit: (call: ToolCall) => ({ kind: 'edited' as const, label: `Edited ${filePath(call)}` }),
  Read: (call: ToolCall) => ({ kind: 'read' as const, label: `Read ${filePath(call)}` }),
  Write: (call: ToolCall) => ({ kind: 'created' as const, label: `Created ${filePath(call)}` }),
  Skill: (call: ToolCall) => ({
    kind: 'skill' as const,
    label: typeof call.input.skill === 'string' ? skillTitle(call.input.skill) : 'Skill',
  }),
  // Codex's own two shell tools: `exec_command`'s structured call carries its command on `cmd`,
  // and a `custom_tool_call` named `exec` carries the model's bare script on `input` (see
  // `readToolCall` in the Codex adapter). Both read as a command, the same as Claude's `Bash`.
  exec_command: (call: ToolCall) => ({
    kind: 'command' as const,
    label: `Ran ${String(call.input.cmd ?? 'command').split('\n')[0]}`,
  }),
  exec: (call: ToolCall) => ({
    kind: 'command' as const,
    label: `Ran ${String(call.input.input ?? 'command').split('\n')[0]}`,
  }),
} as const

const EVIDENCE_KINDS = { Bash: 'output', Read: 'document' } as const

// The transcript names a skill by its kebab-case slug ("simple-english"); the row shows the
// reader-facing sentence form ("Simple english") instead.
function skillTitle(slug: string): string {
  const words = slug.split('-').filter((word) => word.length > 0)
  const [first, ...rest] = words
  if (first === undefined) return slug
  return [`${first[0]?.toUpperCase()}${first.slice(1)}`, ...rest].join(' ')
}

// A row names the file, never the path that reached it: every surface drawing this label is narrow
// and the absolute path is both too long to read and the same prefix on every line (#2273).
function filePath(call: ToolCall) {
  const path = call.input.file_path
  if (typeof path !== 'string') return 'file'
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

// Every surface that names a Tool Call uses this label. The kind remains separate metadata so a
// compact surface never has to rebuild reader-facing words from the CLI's execution type.
export function toolPresentation(call: ToolCall) {
  return (
    TOOL_DETAILS[call.name as keyof typeof TOOL_DETAILS]?.(call) ?? {
      kind: 'tool' as const,
      label: `Called ${call.name}`,
    }
  )
}

// A tool no row knows still shows what it was asked: a lone string argument as itself, else the input.
function unclassifiedText(input: ToolCall['input']): string | null {
  const values = Object.values(input)
  if (values.length === 0) return null
  const [only] = values
  if (values.length === 1 && typeof only === 'string') return only
  return JSON.stringify(input, null, 2)
}

const lineCount = (text: string) => text.split('\n').length

// An Edit or a Write carries its change in its own input, so its diff is ready before the result.
function fileChange(call: ToolCall) {
  const { old_string: oldText, new_string: newText, content } = call.input
  if (call.name === 'Edit' && typeof oldText === 'string' && typeof newText === 'string') {
    return {
      patch: unifiedPatch(oldText, newText),
      lineCounts: { added: lineCount(newText), removed: lineCount(oldText) },
    }
  }
  if (call.name === 'Write' && typeof content === 'string') {
    return { patch: createdPatch(content), lineCounts: { added: lineCount(content), removed: 0 } }
  }
  return null
}

function evidenceOf(call: ToolCall, result: ToolResult | undefined): ToolRow['evidence'] {
  // A Skill call's own result is a fixed placeholder ("Launching skill: X"); its real content is
  // the skill body, carried through `text` (see `toolText`), not the evidence panel.
  if (call.name === 'Skill') return null
  const presentation = toolPresentation(call)
  const change = fileChange(call)
  if (change !== null) return { kind: 'diff', title: presentation.label, source: change.patch }
  const source = result?.content ?? null
  if (source === null) return null
  const kind = EVIDENCE_KINDS[call.name as keyof typeof EVIDENCE_KINDS] ?? 'output'
  return { kind, title: presentation.label, source }
}

function toolStatus(result: ToolResult | undefined): ToolRow['status'] {
  if (result === undefined) return 'running'
  return result.failed ? 'failed' : 'succeeded'
}

function toolText(call: ToolCall, skillBodies: Map<string, string>): string | null {
  if (call.name === 'Bash' && typeof call.input.command === 'string') return call.input.command
  if (call.name === 'exec_command' && typeof call.input.cmd === 'string') return call.input.cmd
  if (call.name === 'exec' && typeof call.input.input === 'string') return call.input.input
  if (call.name === 'Skill') return skillBodies.get(call.id) ?? null
  return Object.hasOwn(TOOL_DETAILS, call.name) ? null : unclassifiedText(call.input)
}

function toolRow(call: ToolCall, { results, skillBodies }: ToolEvidence): ToolRow {
  const result = results.get(call.id)
  return {
    shape: 'tool',
    id: call.id,
    ...toolPresentation(call),
    lineCounts: fileChange(call)?.lineCounts ?? null,
    status: toolStatus(result),
    evidence: evidenceOf(call, result),
    text: toolText(call, skillBodies),
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

function feedRow(call: ToolCall, evidence: ToolEvidence): SessionFeedRow {
  if (call.name === ASK_TOOL) return askRow(call, evidence.results) ?? toolRow(call, evidence)
  return toolRow(call, evidence)
}

export function toolRows(calls: ToolCall[], evidence: ToolEvidence): SessionFeedRow[] {
  return calls.map((call) => feedRow(call, evidence))
}
