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
import { buildSessionInterior, type SessionInteriorModel } from '../interior/model'
import raw from './realSession.json'

// FIXTURE, derived from a REAL Claude Code session on this machine (the #318 inline-media
// implement run): two root turns, two review subagents, 226 tool calls, real prompts, real diffs
// and the screenshots the agent actually looked at. The JSON beside this file is emitted by
// `scripts/emit-real-session.mjs`, which runs the raw transcript through the app's OWN parser
// (`main/observe/claudeTranscript.ts`) with tool output capped and the images downscaled — so the
// surface is judged against what observation actually yields rather than against a miniature
// somebody wrote to look like it.
//
// RE-EMIT IT WHEN THE PARSER CHANGES. A stale fixture pins the old reading and makes a fixed bug
// look unfixed: this file carried twelve turns titled `<command-message>implement</command-message>`
// for exactly as long as it went un-regenerated after the segmentation was corrected.
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
    /** The session's own working directory. Every path in the feed is shown relative to it. */
    cwd: string | null
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
    return {
      kind: 'media',
      tier,
      mediaType: result.mediaType ?? 'image/png',
      // The pictures the agent actually looked at, downscaled by the emitter. `null` survives as
      // `null` — one path in the source run genuinely could not be read, and keeping that row
      // absent is what puts the honest-absence case on screen beside the ones that render.
      bytes: result.bytes ?? null,
    }
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
  cwd: DATA.session.cwd,
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
    // `derived`, not `ticket`: this run's transcript carries no `ai-title`, so the session's name
    // falls back to its first prompt — `/effort` — and claiming the title came from the ticket
    // would be a false provenance on the one segment whose whole job is to say where it came from.
    // The chip then spells the intent out (`intent #318 Feed: inline media`), which is also the
    // only place the ticket's own title reaches the screen.
    titleSource: 'derived',
    intent: { number: 318, title: 'Feed: inline media' },
    mode: 'Code',
  },
})
