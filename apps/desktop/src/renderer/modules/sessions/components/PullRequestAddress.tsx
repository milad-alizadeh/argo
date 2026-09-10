import type { SessionPullRequest } from '../../../../core/sessions/models'

// The code host's own words for a pull request's state (CONTEXT.md L4 · Delivery keeps the host's
// vocabulary verbatim), and the ink the layout prototype gives each (`--pr-*`).
export const PULL_REQUEST_STATES = ['open', 'merged', 'closed', 'draft'] as const
export type PullRequestState = (typeof PULL_REQUEST_STATES)[number]

const INK: Record<PullRequestState, string> = {
  open: 'text-pr-open',
  merged: 'text-pr-merged',
  closed: 'text-pr-closed',
  draft: 'text-pr-draft',
}

// The code host's pull-request mark, and its merged form (`roster-row-signals-prototype.html` ·
// SVG.pr, SVG.merged).
function PullRequestGlyph({ merged }: { merged: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-[12px] flex-none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 16 16"
    >
      <circle cx="4.2" cy="4" r="1.7" />
      <circle cx="4.2" cy="12.2" r="1.7" />
      <path d="M4.2 5.7v4.8" />
      {merged ? (
        <>
          <circle cx="11.8" cy="4" r="1.7" />
          <path d="M11.8 5.7v.8a4 4 0 0 1-4 4H5.9" />
        </>
      ) : (
        <>
          <circle cx="11.8" cy="12.2" r="1.7" />
          <path d="M11.8 10.5V6.6a2 2 0 0 0-2-2H7.2" />
          <path d="M8.8 3 7.2 4.6l1.6 1.6" />
        </>
      )}
    </svg>
  )
}

type PullRequestAddressProps = { pullRequest: SessionPullRequest; state: PullRequestState | null }

// The trailing address on the row's third line (variant G): the mark and the number, in the
// state's ink. A transcript names the pull request but never its state, which only the code host
// holds, so a row with no reading of the host draws the number in the quiet ink rather than
// guessing a colour (CONTEXT.md L1 · degrade down).
export function PullRequestAddress({ pullRequest, state }: PullRequestAddressProps) {
  return (
    <span
      className={`roster__pr inline-flex flex-none items-center gap-tight font-mono text-meta ${state === null ? 'text-faint' : INK[state]}`}
      data-state={state ?? undefined}
      title={pullRequest.url}
    >
      <PullRequestGlyph merged={state === 'merged'} />#{pullRequest.number}
    </span>
  )
}
