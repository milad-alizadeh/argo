import type { RibbonNodeKey, RibbonNodeState, TerminalState } from '@shared'
import { cn } from '@/lib/utils'
import type {
  CiDrawerData,
  ClosedSummary,
  CommitsDrawerData,
  MergedSummary,
  ReviewDrawerData,
} from '../nodeDrawerModel'
import { ciBody } from './ciBody'
import { commitsBody } from './commitsBody'
import { mergeBody } from './mergeBody'
import { prBody } from './prBody'
import { reviewBody } from './reviewBody'
import { closedBody, mergedBody } from './terminalBody'

/** Everything a node's body can draw on — the union of what every `node`/`state`
 * combination needs. `NodeDrawer` reads only the slice its own `node` selects. */
export interface NodeDrawerSession {
  commits: CommitsDrawerData
  pr: { headSha: string }
  ci: CiDrawerData
  review: ReviewDrawerData
  merge: { prNum: number; headSha: string }
  merged: MergedSummary
  closed: ClosedSummary
}

export type NodeDrawerProps =
  | {
      node: RibbonNodeKey
      state: RibbonNodeState
      /** Whether this node is the head — a drawer carries a control only when it is (R2). */
      isHead: boolean
      session: NodeDrawerSession
      className?: string
    }
  | {
      /** R8: the ribbon has already resolved to a terminal state — merged or closed replace
       * the five nodes entirely, so there is no per-node head to carry. */
      node: 'terminal'
      state: TerminalState
      session: NodeDrawerSession
      className?: string
    }

/**
 * Organism: the selected ribbon node's drawer — the ONE place its body renders, whichever
 * of the six kinds `node` names.
 *
 * A drawer carries a control only when its node is the head (R2 — the screen's one
 * primary). Gate actions confirm in two steps; delegated gates narrate their standing
 * order with the one revoke they carry (R6).
 */
export function NodeDrawer(props: NodeDrawerProps): React.JSX.Element {
  const { session, className } = props
  const body = (() => {
    switch (props.node) {
      case 'commits':
        return commitsBody(props.state, props.isHead, session.commits)
      case 'pr':
        return prBody(props.state, props.isHead, session.pr)
      case 'ci':
        return ciBody(props.state, props.isHead, session.ci)
      case 'review':
        return reviewBody(props.state, props.isHead, session.review)
      case 'merge':
        return mergeBody(props.state, props.isHead, session.merge)
      case 'terminal':
        return props.state === 'merged' ? mergedBody(session.merged) : closedBody(session.closed)
    }
  })()

  return (
    <div className={cn('grid gap-gap border-border border-b bg-well px-inset py-snug', className)}>
      {body}
    </div>
  )
}
