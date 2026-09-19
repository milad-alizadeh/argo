import { z } from 'zod'
import { claudeQuestionSchema } from './claude-contract'
import type { SessionFeedRow } from './models'
import { fileChange, patchOf, searchLabel, searchOutcome } from './tool-changes'
import {
  type BackgroundState,
  type ExecuteFacts,
  resultText,
  type ToolCall,
  type ToolResult as TranscriptToolResult,
} from './transcript'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
type AskRow = Extract<SessionFeedRow, { shape: 'ask' }>
// A background command's receipt is its only result until a later record ends it: `ended` is how.
export type ToolResult = Pick<TranscriptToolResult, 'blocks' | 'failed'> & {
  background?: true
  ended?: BackgroundState
}

export function displayedToolLabel(
  call: { kind: ToolRow['kind'] | 'thought'; label: string },
  active: boolean,
  running: string,
) {
  if (!active || (call.kind !== 'command' && call.kind !== 'tool')) return call.label
  const label = call.label.startsWith('Ran ') ? call.label.slice('Ran '.length) : call.label
  return `${running} ${label}`
}

// A call's result and a Skill's body both arrive as later, separate records, keyed by call id.
export type ToolEvidence = { results: Map<string, ToolResult>; skillBodies: Map<string, string> }

const ASK_TOOL = 'AskUserQuestion'
const claudeQuestionCallInputSchema = z.strictObject({
  questions: z.array(claudeQuestionSchema).min(1),
})

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function commandLabel({ label, command }: ExecuteFacts) {
  return label ?? `Ran ${command ?? 'command'}`
}

const TOOL_DETAILS = {
  Edit: (call: ToolCall) => ({ kind: 'edited' as const, label: `Edited ${filePath(call)}` }),
  Write: (call: ToolCall) => ({ kind: 'created' as const, label: `Created ${filePath(call)}` }),
  Skill: (call: ToolCall) => ({
    kind: 'skill' as const,
    label: typeof call.input.skill === 'string' ? skillTitle(call.input.skill) : 'Skill',
  }),
  apply_patch: (call: ToolCall) => {
    const change = patchOf(call)
    return change === null
      ? { kind: 'edited' as const, label: 'Edited file' }
      : { kind: change.kind, label: change.label }
  },
} as const

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
function fileName(path: unknown) {
  if (typeof path !== 'string') return 'file'
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

const filePath = (call: ToolCall) => fileName(call.input.file_path)

// Every surface that names a Tool Call uses this label. The kind remains separate metadata so a
// compact surface never has to rebuild reader-facing words from the CLI's execution type. An
// unclassified tool reads as something the agent ran, the same verb as a command, under the
// title the agent gave the call when it gave one (Codex's `js` writes `{title, code}`).
export function toolPresentation(call: ToolCall) {
  // The agent's own description is already a whole label; the command's first line is the fallback.
  if (call.execute !== undefined)
    return { kind: 'command' as const, label: commandLabel(call.execute) }
  if (call.read !== undefined)
    return { kind: 'read' as const, label: `Read ${fileName(call.read.target)}` }
  if (call.search !== undefined || call.fetch !== undefined)
    return { kind: 'searched' as const, label: searchLabel(call) }
  return (
    TOOL_DETAILS[call.name as keyof typeof TOOL_DETAILS]?.(call) ?? {
      kind: 'tool' as const,
      label: text(call.input.title) ?? `Ran ${call.name}`,
    }
  )
}

// A tool no row knows still shows what it was asked: its code, a lone string argument as itself,
// else the input.
function unclassifiedText(input: ToolCall['input']): string | null {
  const code = text(input.code)
  if (code !== null) return code
  const values = Object.values(input)
  if (values.length === 0) return null
  const [only] = values
  if (values.length === 1 && typeof only === 'string') return only
  return JSON.stringify(input, null, 2)
}

function evidenceOf(call: ToolCall, result: ToolResult | undefined): ToolRow['evidence'] {
  // A Skill call's own result is a fixed placeholder ("Launching skill: X"); its real content is
  // the skill body, carried through `text` (see `toolText`), not the evidence panel.
  if (call.name === 'Skill') return null
  const presentation = toolPresentation(call)
  const change = fileChange(call)
  if (change !== null) return { kind: 'diff', title: presentation.label, source: change.patch }
  const source = result === undefined ? null : resultText(result.blocks)
  if (source === null) return null
  const kind = call.read === undefined ? 'output' : 'document'
  return { kind, title: presentation.label, source }
}

const ENDED_STATUS = {
  completed: 'succeeded',
  failed: 'failed',
  interrupted: 'interrupted',
} as const satisfies Record<BackgroundState, ToolRow['status']>

function toolStatus(result: ToolResult | undefined): ToolRow['status'] {
  if (result === undefined) return 'running'
  if (result.background === true)
    return result.ended === undefined ? 'running' : ENDED_STATUS[result.ended]
  return result.failed ? 'failed' : 'succeeded'
}

function toolText(call: ToolCall, skillBodies: Map<string, string>): string | null {
  if (call.execute !== undefined) return call.execute.text
  if (call.name === 'Skill') return skillBodies.get(call.id) ?? null
  if (call.fetch !== undefined) return call.fetch.url
  if (call.search !== undefined) return call.search.query
  if (call.read !== undefined) return null
  return Object.hasOwn(TOOL_DETAILS, call.name) ? null : unclassifiedText(call.input)
}

function toolRow(call: ToolCall, { results, skillBodies }: ToolEvidence): ToolRow {
  const result = results.get(call.id)
  const presentation = toolPresentation(call)
  const outcome = presentation.kind === 'searched' ? searchOutcome(result) : null
  return {
    shape: 'tool',
    id: call.id,
    ...presentation,
    label: outcome === null ? presentation.label : `${presentation.label} · ${outcome}`,
    lineCounts: fileChange(call)?.lineCounts ?? null,
    status: outcome === null ? toolStatus(result) : 'failed',
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
    answer: resultText(results.get(call.id)?.blocks ?? []),
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
