import { editPresentation, fileName } from '@/domains/sessions/contract/file-presentation'
import type { SessionFeedRow } from '@/domains/sessions/contract/models'
import { searchLabel, searchOutcome } from '@/domains/sessions/contract/tool-changes'
import {
  type AskFacts,
  type BackgroundState,
  type ExecuteFacts,
  resultText,
  type ToolCall,
  type ToolResult as TranscriptToolResult,
} from '@/domains/sessions/contract/transcript'

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

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function commandLabel({ label, command }: ExecuteFacts) {
  return label ?? `Ran ${command ?? 'command'}`
}

// The transcript names a skill by its kebab-case slug ("simple-english"); the row shows the
// reader-facing sentence form ("Simple english") instead.
export function skillTitle(slug: string): string {
  const words = slug.split('-').filter((word) => word.length > 0)
  const [first, ...rest] = words
  if (first === undefined) return slug
  return [`${first[0]?.toUpperCase()}${first.slice(1)}`, ...rest].join(' ')
}

// Every surface that names a Tool Call uses this label. The kind remains separate metadata so a
// compact surface never has to rebuild reader-facing words from the CLI's execution type. An
// unclassified tool reads as something the agent ran, the same verb as a command, under the
// title the agent gave the call when it gave one (Codex's `js` writes `{title, code}`).
// `file` picks which of an edit's files the presentation is for.
export function toolPresentation(call: ToolCall, file = 0) {
  // The agent's own description is already a whole label; the command's first line is the fallback.
  if (call.execute !== undefined)
    return { kind: 'command' as const, label: commandLabel(call.execute) }
  const edited = call.edit?.files[file]
  if (edited !== undefined) return editPresentation(edited)
  if (call.read !== undefined)
    return { kind: 'read' as const, label: `Read ${fileName(call.read.target)}` }
  if (call.skill !== undefined)
    return { kind: 'skill' as const, label: call.skill.title ?? 'Skill' }
  if (call.other !== undefined) return { kind: 'tool' as const, label: call.other.label }
  if (call.search !== undefined || call.fetch !== undefined)
    return { kind: 'searched' as const, label: searchLabel(call) }
  return {
    kind: 'tool' as const,
    label: text(call.input.title) ?? `Ran ${call.name}`,
  }
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

function evidenceOf(
  call: ToolCall,
  result: ToolResult | undefined,
  file: number,
): ToolRow['evidence'] {
  // A Skill call's own result is a fixed placeholder ("Launching skill: X"); its real content is
  // the skill body, carried through `text` (see `toolText`), not the evidence panel.
  if (call.skill !== undefined) return null
  const presentation = toolPresentation(call, file)
  const edited = call.edit?.files[file]
  if (edited !== undefined) return { kind: 'diff', title: presentation.label, source: edited.diff }
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
  if (call.skill !== undefined) return skillBodies.get(call.id) ?? null
  if (call.fetch !== undefined) return call.fetch.url
  if (call.search !== undefined) return call.search.query
  if (call.read !== undefined || call.edit !== undefined) return null
  if (call.other !== undefined)
    return call.other.source === null ? unclassifiedText(call.input) : null
  return unclassifiedText(call.input)
}

function toolRow(call: ToolCall, { results, skillBodies }: ToolEvidence, file = 0): ToolRow {
  const result = results.get(call.id)
  const presentation = toolPresentation(call, file)
  const outcome = presentation.kind === 'searched' ? searchOutcome(result) : null
  return {
    shape: 'tool',
    id: file === 0 ? call.id : `${call.id}#${file}`,
    ...presentation,
    label: outcome === null ? presentation.label : `${presentation.label} · ${outcome}`,
    lineCounts: call.edit?.files[file]?.lineCounts ?? null,
    status: outcome === null ? toolStatus(result) : 'failed',
    evidence: evidenceOf(call, result, file),
    text: toolText(call, skillBodies),
  }
}

// The one ask row both harnesses draw: the question verbatim, never summarised into a label the
// way every other tool call is described.
export function askRow(
  id: string,
  ask: Pick<AskFacts, 'questions' | 'unsupported'>,
  answer: string | null,
): AskRow {
  return { shape: 'ask', id, questions: ask.questions, answer, unsupported: ask.unsupported }
}

// An edit over several files draws one row per file.
function feedRows(call: ToolCall, evidence: ToolEvidence): SessionFeedRow[] {
  if (call.ask !== undefined) {
    return [askRow(call.id, call.ask, resultText(evidence.results.get(call.id)?.blocks ?? []))]
  }
  const files = call.edit?.files ?? []
  if (files.length > 1) return files.map((_, file) => toolRow(call, evidence, file))
  return [toolRow(call, evidence)]
}

export function toolRows(calls: ToolCall[], evidence: ToolEvidence): SessionFeedRow[] {
  return calls.flatMap((call) => feedRows(call, evidence))
}
