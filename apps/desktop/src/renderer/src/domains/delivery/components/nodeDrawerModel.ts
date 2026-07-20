import type { ReviewVerdict } from '@shared'
import type { CheckOutputProps } from './CheckOutput'
import type { CiRun } from './PrChecksList'

/** One round of the GitHub human review, already resolved for display — `stale`/
 * `archived` arrive as facts rather than being derived here from a sha comparison, per
 * this ticket's boundary: the lifecycle's own derivation (#33) owns staleness, and a round is
 * a second, per-round instance of the same fact the lifecycle's `review` node already carries
 * for its latest round alone. */
export interface ReviewRoundView {
  round: number
  by: string
  verdict: ReviewVerdict
  sha: string
  /** Findings still open in this round — meaningful only when `verdict` is `changes`. */
  open?: number
  /** This round's findings are all fixed — renders the archived summary line instead of
   * the live verdict. */
  archived?: boolean
  /** Total findings this round raised, shown once archived. */
  findings?: number
  /** A newer commit has superseded this round's approval — dims it, no verdict tint. */
  stale?: boolean
}

/** Everything the Commits body needs beyond the lifecycle's own `state` — the drafted commit
 * message and the sha a `now`/`done` line echoes. */
export interface CommitsDrawerData {
  dirty: number
  headSha: string | null
  unpushed: number
  /** The drafted commit message, offered at the `gate` (dirty + idle) stage. */
  draftMessage: string
  /** A local check's captured output, when the screen has one expanded (R11 — sha-keyed,
   * so its one home is this drawer). Which check is selected is screen-level state this
   * ticket doesn't own; omitted, the drawer simply has none open. */
  selectedCheck?: CheckOutputProps
}

/** The remote CI checks, keyed to the lifecycle's own head sha. */
export interface CiDrawerData {
  sha: string
  status: 'running' | 'passed' | 'failed'
  aggregate: string
  runs: readonly CiRun[]
}

/** The GitHub human review, round-stacked (R14 — distinct from the agent's own
 * `/code-review`, which lives in the Review tab). */
export interface ReviewDrawerData {
  rounds: readonly ReviewRoundView[]
}

export interface MergedSummary {
  sha: string
  how: string
  by: string
  when: string
}

export interface ClosedSummary {
  by: string
  when: string
  /** Why the branch was left behind, e.g. "superseded by #47". */
  note: string
}
