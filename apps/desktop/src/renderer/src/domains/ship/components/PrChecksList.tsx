import type { CiStatus } from '@shared'
import { cn } from '@/lib/utils'
import { ArrowSquareOutIcon, Button, StatusIcon, Text } from '@/shared/components/ui'
import type { RosterIcon, RosterTone } from '@/shared/delivery'
import { CiCard } from './CiCard'

export const CI_RUN_STATUSES = ['queued', 'running', 'passed', 'failed'] as const

/** One named GitHub Actions run's own status — finer-grained than the aggregate `CiStatus`
 * a PR carries, since an individual run can still be `queued` while the aggregate already
 * reads `running`. */
export type CiRunStatus = (typeof CI_RUN_STATUSES)[number]

export interface CiRun {
  /** The check's own name, as GitHub reports it. */
  name: string
  status: CiRunStatus
  duration: string
  /** A failure's own note — a stray line of context beside the glyph. */
  note?: string
}

// Reuses the Roster's own icon/tone vocabulary (`StatusIcon`) rather than a parallel one: a
// GitHub Actions run's four states map onto four states the Roster already draws.
const CI_RUN_PRESENTATION: Record<CiRunStatus, { icon: RosterIcon; tone: RosterTone }> = {
  queued: { icon: 'circle', tone: 'gray' },
  running: { icon: 'circle-notch', tone: 'run' },
  passed: { icon: 'check', tone: 'done' },
  failed: { icon: 'x', tone: 'red' },
}

const AGGREGATE_TONE: Record<CiStatus, RosterTone> = {
  running: 'run',
  passed: 'done',
  failed: 'red',
}

export interface PrChecksListProps {
  /** The sha every run in this list is keyed to. */
  sha: string
  /** The overall rollup — drives the aggregate line's tone. */
  status: CiStatus
  /** The rollup line itself ("1 running · 2 passed") — worded upstream, never re-derived
   * here from `runs`. */
  aggregate: string
  runs: readonly CiRun[]
  className?: string
}

/**
 * Molecule: the remote-origin GitHub Actions checks for one sha, each row deep-linking to
 * its run.
 *
 * Deliberately origin-labelled — this is NOT the local Checks card (`CheckOutput`/
 * `BranchChecksCard`), which is Argo's own captured output for the same tree.
 */
export function PrChecksList({
  sha,
  status,
  aggregate,
  runs,
  className,
}: PrChecksListProps): React.JSX.Element {
  return (
    <CiCard
      className={className}
      heading={
        <>
          <Text variant="tag" className="text-muted-foreground">
            CI
          </Text>
          <Text variant="tag" className="normal-case tracking-normal text-foreground-faint">
            · GitHub Actions ·
          </Text>
          <Text variant="code-inline" className="normal-case text-foreground-soft">
            {sha}
          </Text>
        </>
      }
      trailing={
        <Text variant="meta" className={cn('tabular-nums', `text-tone-${AGGREGATE_TONE[status]}`)}>
          {aggregate}
        </Text>
      }
    >
      <ul>
        {runs.map((run) => {
          const { icon, tone } = CI_RUN_PRESENTATION[run.status]
          return (
            <li
              key={run.name}
              className="flex items-center gap-gap border-inset-hair/60 border-t px-inset py-snug first:border-t-0"
            >
              <StatusIcon icon={icon} tone={tone} />
              <Text variant="code-inline" className="normal-case text-foreground-soft">
                {run.name}
              </Text>
              {run.note !== undefined && (
                <Text variant="meta" className="text-tone-red">
                  {run.note}
                </Text>
              )}
              <Text variant="meta" className="ml-auto shrink-0 tabular-nums text-foreground-faint">
                {run.duration}
              </Text>
              <Button variant="ghost" size="sm" className="shrink-0 text-primary">
                open
                <ArrowSquareOutIcon aria-hidden />
              </Button>
            </li>
          )
        })}
      </ul>
    </CiCard>
  )
}
