import type { RibbonNodeKey, RibbonNodeState, TerminalState } from '@shared'
import {
  ArrowBendDownRightIcon,
  ArrowClockwiseIcon,
  Button,
  CheckIcon,
  GearIcon,
  GitCommitIcon,
  GitDiffIcon,
  GitPullRequestIcon,
  Status,
  Text,
  useDisclosure,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { CheckOutput } from './CheckOutput'
import type {
  CiDrawerData,
  ClosedSummary,
  CommitsDrawerData,
  MergedSummary,
  ReviewDrawerData,
  ReviewRoundView,
} from './nodeDrawerModel'
import { PrChecksList } from './PrChecksList'

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

/** A drawer's small key/value line — the study's `.growrow`. */
function GrowRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex items-center gap-gap">{children}</div>
}

/** A gate's two-step confirm: arm on the first click, confirm on the second, cancel to back
 * out. Local UI state — the click that actually ships is a later ticket's dispatch. */
function GateAction({
  label,
  confirmLabel,
  hint,
}: {
  label: string
  confirmLabel: string
  hint: React.ReactNode
}): React.JSX.Element {
  const [armed, arm] = useDisclosure({})
  return (
    <div className="flex items-center gap-gap">
      <Button variant="primary" onClick={arm}>
        {armed ? confirmLabel : label}
      </Button>
      {armed ? (
        <Button variant="ghost" size="sm" onClick={arm}>
          cancel
        </Button>
      ) : (
        <Text variant="meta" className="text-foreground-faint">
          {hint}
        </Text>
      )}
    </div>
  )
}

/** A delegated gate's standing order — narrated, never a button, with the one revoke it
 * carries (R6). */
function DelegatedRow({ note }: { note: React.ReactNode }): React.JSX.Element {
  return (
    <GrowRow>
      <GearIcon aria-hidden className="text-foreground-faint" />
      <Text variant="row" className="text-foreground-faint">
        {note}
      </Text>
      <Button variant="ghost" size="sm" title="revoke the standing order — the gate returns to ask">
        revoke
      </Button>
    </GrowRow>
  )
}

function commitsStageBody(
  state: RibbonNodeState,
  isHead: boolean,
  data: CommitsDrawerData,
): React.JSX.Element {
  switch (state) {
    case 'now':
      return (
        <>
          <GrowRow>
            <Status word="editing" tone="run" />
            <Text variant="meta" className="text-foreground-faint">
              will commit when the slice is done · {data.dirty} dirty
            </Text>
          </GrowRow>
          {data.headSha && (
            <GrowRow>
              <CheckIcon aria-hidden className="text-muted-foreground" />
              <Text variant="row" className="text-muted-foreground">
                committed
              </Text>
              <Text variant="code-inline">{data.headSha}</Text>
              <Text variant="meta" className="text-foreground-faint">
                · agent
              </Text>
            </GrowRow>
          )}
        </>
      )
    case 'gate':
      return (
        <>
          <div className="flex items-center gap-gap rounded-md border border-inset-hair bg-inset px-inset py-snug">
            <Text variant="tag" className="text-foreground-faint">
              draft
            </Text>
            <Text variant="code" className="min-w-0 flex-1 truncate text-foreground-bright">
              {data.draftMessage}
            </Text>
            <Button variant="ghost" size="sm" title="re-draft the message from the diff">
              <ArrowClockwiseIcon aria-hidden />
            </Button>
          </div>
          {isHead && (
            <Button variant="primary">
              <GitCommitIcon aria-hidden />
              Commit {data.dirty} file{data.dirty === 1 ? '' : 's'}
            </Button>
          )}
        </>
      )
    case 'sync':
      return (
        <>
          <GrowRow>
            <Text variant="row" className="text-foreground-faint">
              unpushed commits · ↑{data.unpushed}
            </Text>
            <Text variant="code-inline">{data.headSha}</Text>
          </GrowRow>
          <Text variant="meta" className="text-tone-stale">
            CI and the approval are true of an earlier commit — pushing re-runs CI and re-requests
            review.
          </Text>
          {isHead && (
            <Button variant="primary">
              <GearIcon aria-hidden />
              Push {data.unpushed}
            </Button>
          )}
        </>
      )
    default:
      return (
        <GrowRow>
          <GitCommitIcon aria-hidden className="text-muted-foreground" />
          <Text variant="row" className="text-muted-foreground">
            committed
          </Text>
          {data.headSha && <Text variant="code-inline">{data.headSha}</Text>}
          <Text variant="meta" className="text-foreground-faint">
            — net diff in Changes below
          </Text>
        </GrowRow>
      )
  }
}

// The Commits body plus, when the screen has one open, the local check output it selected
// (R11 — sha-keyed, so this is that output's one home).
function commitsBody(
  state: RibbonNodeState,
  isHead: boolean,
  data: CommitsDrawerData,
): React.JSX.Element {
  return (
    <>
      {commitsStageBody(state, isHead, data)}
      {data.selectedCheck && <CheckOutput {...data.selectedCheck} />}
    </>
  )
}

function prBody(
  state: RibbonNodeState,
  isHead: boolean,
  data: { headSha: string },
): React.JSX.Element | null {
  switch (state) {
    case 'gate':
      return (
        <>
          <GrowRow>
            <Text variant="row" className="text-tone-done inline-flex items-center gap-tight">
              <CheckIcon aria-hidden />
              Checks
            </Text>
            <Text variant="meta" className="text-foreground-faint">
              local · values in the Checks card
            </Text>
          </GrowRow>
          {isHead && (
            <GateAction
              label="Create PR → main"
              confirmLabel="Confirm — create PR"
              hint={
                <>
                  pushes <Text variant="code-inline">{data.headSha}</Text> and opens the PR
                </>
              }
            />
          )}
        </>
      )
    case 'auto':
      return <DelegatedRow note="auto — Argo opens the PR when the tree is clean" />
    case 'done':
      return (
        <GrowRow>
          <GitPullRequestIcon aria-hidden className="text-foreground-faint" />
          <Text variant="meta" className="text-foreground-faint">
            open — number and link live on the strip anchor
          </Text>
        </GrowRow>
      )
    default:
      return null
  }
}

function ciBody(isHead: boolean, ci: CiDrawerData): React.JSX.Element {
  const stale = ci.status !== 'failed' && ci.runs.some((run) => run.status === 'failed')
  return (
    <>
      <PrChecksList sha={ci.sha} status={ci.status} aggregate={ci.aggregate} runs={ci.runs} />
      {isHead && ci.status === 'failed' && (
        <div className="flex items-center gap-gap">
          <Button variant="primary">
            <ArrowBendDownRightIcon aria-hidden />
            Fix CI
          </Button>
          <Button variant="ghost">
            <ArrowClockwiseIcon aria-hidden />
            Re-run
          </Button>
          <Text variant="meta" className="text-foreground-faint">
            Fix CI dispatches the agent · Re-run is a gh call
          </Text>
        </div>
      )}
      {stale && (
        <Text variant="meta" className="text-tone-stale">
          superseded by a newer commit
        </Text>
      )}
    </>
  )
}

function reviewRoundLine(round: ReviewRoundView): React.JSX.Element {
  if (round.archived) {
    return (
      <GrowRow>
        <CheckIcon aria-hidden className="text-muted-foreground" />
        <Text variant="row" className="text-muted-foreground">
          round {round.round} · {round.findings} findings · all fixed
        </Text>
        <Text variant="code-inline">{round.sha}</Text>
      </GrowRow>
    )
  }
  switch (round.verdict) {
    case 'changes':
      return (
        <GrowRow>
          <Text variant="row" className="text-tone-amber">
            round {round.round} · changes requested by {round.by} · {round.open} open
          </Text>
        </GrowRow>
      )
    case 'running':
      return (
        <GrowRow>
          <Status word={`round ${round.round} · running`} tone="run" />
        </GrowRow>
      )
    case 'approved':
      return (
        <GrowRow>
          <Text variant="row" className={round.stale ? 'text-foreground-faint' : 'text-tone-done'}>
            round {round.round} · approved by {round.by}
          </Text>
          <Text variant="code-inline">{round.sha}</Text>
          {round.stale && (
            <Text variant="meta" className="text-tone-stale">
              · stale — re-requested on push
            </Text>
          )}
        </GrowRow>
      )
  }
}

function reviewBody(
  state: RibbonNodeState,
  isHead: boolean,
  data: ReviewDrawerData,
): React.JSX.Element {
  const latest = data.rounds.at(-1)
  return (
    <>
      {data.rounds.length === 0 ? (
        <Text variant="meta" className="text-foreground-faint">
          no review yet
        </Text>
      ) : (
        data.rounds.map((round) => <div key={round.round}>{reviewRoundLine(round)}</div>)
      )}
      {isHead && state === 'warn' && latest?.open !== undefined && (
        <Button variant="primary">
          <ArrowBendDownRightIcon aria-hidden />
          Address {latest.open}
        </Button>
      )}
    </>
  )
}

function mergeBody(
  state: RibbonNodeState,
  isHead: boolean,
  data: { prNum: number; headSha: string },
): React.JSX.Element {
  switch (state) {
    case 'auto':
      return <DelegatedRow note="auto-merge when CI and review are green — set at dispatch" />
    case 'lock':
      return (
        <Text variant="meta" className="text-foreground-faint">
          locked — CI and the approval are stale for{' '}
          <Text variant="code-inline">{data.headSha}</Text>
        </Text>
      )
    case 'gate':
      return (
        <>
          <GrowRow>
            <Text variant="row" className="text-tone-done inline-flex items-center gap-tight">
              <CheckIcon aria-hidden /> CI
            </Text>
            <Text variant="row" className="text-tone-done inline-flex items-center gap-tight">
              <CheckIcon aria-hidden /> Review
            </Text>
          </GrowRow>
          {isHead && (
            <GateAction
              label={`Merge #${data.prNum}`}
              confirmLabel="Confirm — merge"
              hint={
                <>
                  squash into <Text variant="code-inline">main</Text>
                </>
              }
            />
          )}
        </>
      )
    default:
      return (
        <Text variant="meta" className="text-foreground-faint">
          waiting on CI and review
        </Text>
      )
  }
}

function mergedBody(summary: MergedSummary): React.JSX.Element {
  return (
    <>
      <GrowRow>
        <GitPullRequestIcon aria-hidden className="text-tone-landed" />
        <Text variant="row-strong" className="text-foreground-soft">
          Merged into <Text variant="code-inline">main</Text>
        </Text>
      </GrowRow>
      <GrowRow>
        <Text variant="meta" className="text-muted-foreground">
          commit
        </Text>
        <Text variant="code-inline">{summary.sha}</Text>
        <Text variant="meta" className="text-foreground-faint">
          · {summary.how}
        </Text>
      </GrowRow>
      <GrowRow>
        <Text variant="meta" className="text-muted-foreground">
          by
        </Text>
        <Text variant="row" className="text-foreground-soft">
          {summary.by} · {summary.when}
        </Text>
      </GrowRow>
      <Button variant="ghost">
        <GitDiffIcon aria-hidden />
        Next ticket from main
      </Button>
    </>
  )
}

function closedBody(summary: ClosedSummary): React.JSX.Element {
  return (
    <>
      <GrowRow>
        <Text variant="row-strong" className="text-foreground-soft">
          Closed without merge
        </Text>
      </GrowRow>
      <GrowRow>
        <Text variant="meta" className="text-muted-foreground">
          by
        </Text>
        <Text variant="row" className="text-foreground-soft">
          {summary.by} · {summary.when}
        </Text>
      </GrowRow>
      <GrowRow>
        <Text variant="meta" className="text-muted-foreground">
          branch
        </Text>
        <Text variant="row" className="text-foreground-soft">
          {summary.note}
        </Text>
      </GrowRow>
      <Button variant="ghost">
        <GitDiffIcon aria-hidden />
        New session from main
      </Button>
    </>
  )
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
        return ciBody(props.isHead, session.ci)
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
