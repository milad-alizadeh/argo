import type { FeedRow, SessionView, Turn } from '@shared'
import { rootAgent, turnFeedRows } from '@shared'
import {
  type SubagentGroupModel,
  subagentGroup,
  subagentRow,
  subagentsOf,
} from './interiorSubagents'
import {
  agentChapters,
  type ChapterModel,
  type TimelineTurnModel,
  timelineTurn,
} from './interiorTimeline'
import { type PlanProgressModel, sessionPlan } from './sessionPlan'

// The Activity surface's derivation: the session's own turns as chapters, and every delegate with
// a chapter feed of its own — built in one pass so the rail, the seams and the prose they head
// cannot fall out of step.

export type { ChapterModel, TimelineTurnModel, ToolStepModel } from './interiorTimeline'

/** One agent on the surface: a delegate carrying its own chapter feed, or one of this session's own
 * turns carrying its rows. The subagent's `chapters` are what its scope renders — the same feed
 * grammar as the session's, because two grammars for one kind of record is a misreading waiting to
 * happen. */
export type ActivityItem =
  | {
      key: string
      kind: 'subagent'
      subagent: ReturnType<typeof subagentRow>
      /** The phase the CLI reported for it, absent where it reported none. */
      group: string | null
      /** The delegate's own feed, one chapter per turn. */
      chapters: readonly ChapterModel[]
    }
  | {
      key: string
      kind: 'turn'
      /** The exchange as prose, derived once in `@shared` — what the agent was asked, what it
       * thought, what it said and what it changed, in the order it happened. */
      rows: readonly FeedRow[]
    }

export type DelegateItem = Extract<ActivityItem, { kind: 'subagent' }>

export interface ActivityModel {
  /** The session's own live to-do list, or `null` where the CLI reported none. Session-scoped, so
   * ONE tracker is drawn for the surface rather than one inside every turn. */
  plan: PlanProgressModel | null
  /** `null` where the session spawned none: there is no rail to draw, so none is drawn. */
  subagents: SubagentGroupModel | null
  /** Oldest turn first, so the live one is at the BOTTOM — a session reads the way a chat does. */
  turns: readonly TimelineTurnModel[]
  /** Every delegate, in spawn order — the agents rail's rows, each carrying its own feed. */
  delegated: readonly DelegateItem[]
  /** The session's own turns as feed sections, aligned index-for-index with `turns`. */
  own: readonly ActivityItem[]
  /** The session's working directory — the root every path on this feed is SHOWN relative to.
   *
   * Presentation only. The rows keep the absolute path the record carried, because that is the fact
   * and because a path outside this tree must stay absolute to remain true. This is the one prefix
   * the surface is allowed to stop repeating, and it is already stated in the session's header.
   *
   * `null` for an external session Argo could not read a cwd for, in which case paths render whole:
   * an unknown root is not a reason to guess at a shorter one. */
  root: string | null
}

function spawnedItems(session: SessionView, nowMs: number | null): DelegateItem[] {
  return subagentsOf(session).map((agent) => {
    const row = subagentRow(agent, nowMs)
    return {
      key: row.key,
      kind: 'subagent',
      subagent: row,
      group: agent.group ?? null,
      chapters: agentChapters(agent.turns, nowMs),
    }
  })
}

/**
 * The Activity surface's whole view-model, built from the session's own root Agent.
 *
 * An unparseable transcript yields no root, which renders as an empty surface rather than an
 * error: observation failure is not work failure (`cockpit-failure-states-spec.md` §8).
 */
export function buildActivity(session: SessionView, nowMs: number | null = null): ActivityModel {
  const root = rootAgent(session.agents)
  const compacted = new Set(root?.compactions.map((mark) => mark.beforeTurnId) ?? [])
  // The scannable model and the feed section for one turn are built in ONE pass, from one Turn: the
  // key and the ordinal they share are then a single derivation rather than two that must agree.
  const chronological = (root?.turns ?? []).map((turn, index) => {
    const model = timelineTurn(turn, { compacted, ordinal: index + 1, nowMs })
    return { model, item: ownItem(model, turn) }
  })
  return {
    plan: sessionPlan(session),
    subagents: subagentGroup(session, nowMs),
    turns: chronological.map(({ model }) => model),
    delegated: spawnedItems(session, nowMs),
    own: chronological.map(({ item }) => item),
    root: session.cwd,
  }
}

const rowsOf = (item: ActivityItem | undefined): readonly FeedRow[] =>
  item?.kind === 'turn' ? item.rows : []

/** The session's own feed as chapters: `turns` and `own` are one list built twice from one pass,
 * so the join is by index, not by lookup. */
export const sessionChapters = (activity: ActivityModel): ChapterModel[] =>
  activity.turns.map((turn, index) => ({ ...turn, rows: rowsOf(activity.own[index]) }))

/** One section per Turn, holding that turn's rows. The section is the turn because the turn is what
 * a prompt opens and a stop reason closes.
 *
 * The compaction seam is the one thing a section carries that its Turn does not know: history was
 * condensed in FRONT of this turn, and the feed draws it as the divider that says why earlier
 * context is no longer in the agent's head. */
function ownItem(model: TimelineTurnModel, turn: Turn): ActivityItem {
  const rows = turnFeedRows(turn, { compactedBefore: model.compactedBefore })
  return { key: model.key, kind: 'turn', rows }
}
