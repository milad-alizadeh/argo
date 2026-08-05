import {
  type Agent,
  type DiffLineSide,
  FILE_CHANGES,
  PLAN_ENTRY_STATUSES,
  type Prose,
  type SessionView,
  STOP_REASONS,
  sessionFacts,
  sessionView,
  TIERS,
  type Tier,
  TOOL_CALL_KINDS,
  TOOL_CALL_STATUSES,
  type ToolCall,
  type ToolResult,
  type Turn,
} from '@shared'
import { buildSessionInterior, type SessionInteriorModel } from '../interiorModel'
import raw from './realSession.json'

// FIXTURE, derived from a REAL Claude Code session on this machine (the #318 inline-media
// implement run): twelve root turns, two review subagents, 250+ tool calls, real prompts and
// real diffs. The JSON beside this file was emitted by the app's own transcript parser
// (`main/observe/claudeTranscript.ts`) with long prose capped, so the surface is judged against
// what observation actually yields rather than against hand-written miniatures.
//
// The decoding below only NARROWS: a JSON import widens every enum to `string`, and these maps
// walk each value back to its union via the shared const arrays — no field is invented.

interface RawResult {
  kind: string
  tier: string
  change?: string
  added?: number
  removed?: number
  hunks?: { oldStart: number; newStart: number; lines: { side: string; text: string }[] }[]
  text?: string
  mediaType?: string
  bytes?: string | null
}

type RawCall = Omit<ToolCall, 'kind' | 'status' | 'result'> & {
  kind: string
  status: string
  result: RawResult | null
}

type RawTurn = Omit<Turn, 'stopReason' | 'prose' | 'toolCalls' | 'plan'> & {
  stopReason: string | null
  prose: { kind: string; markdown: string }[]
  toolCalls: RawCall[]
  plan: { entries: { text: string; status: string }[] } | null
}

type RawAgent = Omit<Agent, 'turns'> & { turns: RawTurn[] }

interface RawFixture {
  session: {
    id: string
    title: string
    model: string | null
    branch: string | null
    lastActivityAt: number | null
  }
  agents: RawAgent[]
}

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  values.find((candidate) => candidate === value) ?? null

const DIFF_SIDES: readonly DiffLineSide[] = ['add', 'del', 'context']

function resultOf(result: RawResult | null): ToolResult | null {
  if (result === null) return null
  const tier: Tier = oneOf(TIERS, result.tier) ?? 'derived'
  if (result.kind === 'media') {
    return { kind: 'media', tier, mediaType: result.mediaType ?? 'image/png', bytes: null }
  }
  if (result.kind === 'diff') {
    return {
      kind: 'diff',
      tier,
      change: oneOf(FILE_CHANGES, result.change ?? null) ?? 'modify',
      added: result.added ?? 0,
      removed: result.removed ?? 0,
      hunks: (result.hunks ?? []).map((hunk) => ({
        ...hunk,
        lines: hunk.lines.map((line) => ({
          side: oneOf(DIFF_SIDES, line.side) ?? 'context',
          text: line.text,
        })),
      })),
    }
  }
  return { kind: 'output', tier, text: result.text ?? '' }
}

const callOf = (call: RawCall): ToolCall => ({
  ...call,
  kind: oneOf(TOOL_CALL_KINDS, call.kind) ?? 'other',
  status: oneOf(TOOL_CALL_STATUSES, call.status) ?? 'completed',
  result: resultOf(call.result),
})

const proseOf = (part: { kind: string; markdown: string }): Prose =>
  part.kind === 'thought'
    ? { kind: 'thought', markdown: part.markdown }
    : { kind: 'message', markdown: part.markdown }

const turnOf = (turn: RawTurn): Turn => ({
  ...turn,
  stopReason: turn.stopReason === null ? null : (oneOf(STOP_REASONS, turn.stopReason) ?? 'unknown'),
  prose: turn.prose.map(proseOf),
  toolCalls: turn.toolCalls.map(callOf),
  plan:
    turn.plan === null
      ? null
      : {
          entries: turn.plan.entries.map((entry) => ({
            text: entry.text,
            status: oneOf(PLAN_ENTRY_STATUSES, entry.status) ?? 'pending',
          })),
        },
})

const agentOf = (agent: RawAgent): Agent => ({ ...agent, turns: agent.turns.map(turnOf) })

const DATA: RawFixture = raw

export const REAL_SESSION: SessionView = sessionView({
  id: DATA.session.id,
  title: DATA.session.title,
  model: DATA.session.model,
  branch: DATA.session.branch,
  lastActivityAt: DATA.session.lastActivityAt,
  agents: DATA.agents.map(agentOf),
  facts: sessionFacts(),
})

export const REAL_INTERIOR: SessionInteriorModel = buildSessionInterior({
  session: REAL_SESSION,
  // The record's own clock, one minute on from its last write — a real transcript's timestamps
  // are absolute, so the fixture wall-clock has to live beside them rather than at the shared
  // fixture NOW.
  nowMs: (DATA.session.lastActivityAt ?? 0) + 60_000,
  link: {
    titleSource: 'ticket',
    intent: { number: 318, title: 'Feed: inline media' },
    mode: 'Code',
  },
})
