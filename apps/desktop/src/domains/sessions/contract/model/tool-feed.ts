import { editPresentation, fileName } from '@/domains/sessions/contract/model/file-presentation'
import type { SessionFeedRow } from '@/domains/sessions/contract/model/models'
import { searchLabel, searchOutcome } from '@/domains/sessions/contract/model/tool-changes'
import {
  type AskFacts,
  type BackgroundState,
  type ExecuteFacts,
  resultText,
  type ToolCall,
  type ToolResult as TranscriptToolResult,
} from '@/domains/sessions/contract/model/transcript'

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
  switch (call.kind) {
    case 'execute':
      return { kind: 'command' as const, label: commandLabel(call) }
    case 'edit': {
      const edited = call.files[file]
      if (edited === undefined) throw new Error('An edit Tool Call must name a file')
      return editPresentation(edited)
    }
    case 'read':
      return { kind: 'read' as const, label: `Read ${fileName(call.target)}` }
    case 'skill':
      return { kind: 'skill' as const, label: call.title ?? 'Skill' }
    case 'other':
      return { kind: 'tool' as const, label: call.label }
    case 'search':
    case 'fetch':
      return { kind: 'searched' as const, label: searchLabel(call) }
    case 'ask':
      throw new Error('An ask Tool Call has its own Feed row')
    case 'subagent-control':
      throw new Error('A Subagent control Tool Call has no Feed row')
  }
}

function evidenceOf(
  call: ToolCall,
  result: ToolResult | undefined,
  file: number,
): ToolRow['evidence'] {
  // A Skill call's own result is a fixed placeholder ("Launching skill: X"); its real content is
  // the skill body, carried through `text` (see `toolText`), not the evidence panel.
  if (call.kind === 'skill') return null
  const presentation = toolPresentation(call, file)
  const edited = call.kind === 'edit' ? call.files[file] : undefined
  if (edited !== undefined) return { kind: 'diff', title: presentation.label, source: edited.diff }
  const source = result === undefined ? null : resultText(result.blocks)
  if (source === null) return null
  const kind = call.kind === 'read' ? 'document' : 'output'
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
  switch (call.kind) {
    case 'execute':
      return call.text
    case 'skill':
      return skillBodies.get(call.id) ?? null
    case 'fetch':
      return call.url
    case 'search':
      return call.query
    case 'other':
      return call.source === null ? call.text : null
    case 'read':
    case 'edit':
    case 'ask':
      return null
    case 'subagent-control':
      return null
  }
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
    lineCounts: call.kind === 'edit' ? (call.files[file]?.lineCounts ?? null) : null,
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
  if (call.kind === 'ask') {
    return [askRow(call.id, call, resultText(evidence.results.get(call.id)?.blocks ?? []))]
  }
  if (call.kind === 'subagent-control') return []
  const files = call.kind === 'edit' ? call.files : []
  if (files.length > 1) return files.map((_, file) => toolRow(call, evidence, file))
  return [toolRow(call, evidence)]
}

export function toolRows(calls: ToolCall[], evidence: ToolEvidence): SessionFeedRow[] {
  return calls.flatMap((call) => feedRows(call, evidence))
}
