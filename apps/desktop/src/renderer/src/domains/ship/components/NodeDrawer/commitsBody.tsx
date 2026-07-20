import type { LifecycleNodeState } from '@shared'
import {
  ArrowClockwiseIcon,
  Button,
  CheckIcon,
  GearIcon,
  GitCommitIcon,
  Status,
  Text,
} from '@/shared/components/ui'
import { CheckOutput } from '../CheckOutput'
import type { CommitsDrawerData } from '../nodeDrawerModel'
import { GrowRow } from './drawerControls'

function commitsStageBody(
  state: LifecycleNodeState,
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
export function commitsBody(
  state: LifecycleNodeState,
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
