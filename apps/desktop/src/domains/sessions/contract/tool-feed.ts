import { z } from 'zod'
import { claudeQuestionSchema } from './claude-contract'
import type { SessionFeedRow } from './models'
import { fileChange, searchOutcome } from './tool-changes'
import { commandText, hasToolPresentation, toolPresentation } from './tool-presentation'
import { resultText, type ToolCall, type ToolResult as TranscriptToolResult } from './transcript'

export {
  displayedToolLabel,
  executableToolCall,
  toolPresentation,
  toolTarget,
} from './tool-presentation'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
type AskRow = Extract<SessionFeedRow, { shape: 'ask' }>
export type ToolResult = Pick<TranscriptToolResult, 'blocks' | 'failed'>

// A call's result and a Skill's body both arrive as later, separate records, keyed by call id.
export type ToolEvidence = { results: Map<string, ToolResult>; skillBodies: Map<string, string> }

const ASK_TOOL = 'AskUserQuestion'
const claudeQuestionCallInputSchema = z.strictObject({
  questions: z.array(claudeQuestionSchema).min(1),
})

const EVIDENCE_KINDS = { Bash: 'output', Read: 'document' } as const

// A tool no row knows still shows what it was asked: its code, a lone string argument as itself,
// else the input.
function unclassifiedText(input: ToolCall['input']): string | null {
  const code = typeof input.code === 'string' && input.code.trim().length > 0 ? input.code : null
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
  const kind = EVIDENCE_KINDS[call.name as keyof typeof EVIDENCE_KINDS] ?? 'output'
  return { kind, title: presentation.label, source }
}

function toolStatus(result: ToolResult | undefined): ToolRow['status'] {
  if (result === undefined) return 'running'
  return result.failed ? 'failed' : 'succeeded'
}

function toolText(call: ToolCall, skillBodies: Map<string, string>): string | null {
  const command = commandText(call)
  if (command !== null) return command
  if (call.name === 'exec' && typeof call.input.input === 'string') return call.input.input
  if (call.name === 'Skill') return skillBodies.get(call.id) ?? null
  if (call.name === 'web__run') {
    const url = typeof call.input.url === 'string' ? call.input.url : null
    return url ?? (typeof call.input.query === 'string' ? call.input.query : null)
  }
  return hasToolPresentation(call) ? null : unclassifiedText(call.input)
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
