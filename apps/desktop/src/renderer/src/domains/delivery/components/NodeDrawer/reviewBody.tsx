import type { LifecycleNodeState } from '@shared'
import { ArrowBendDownRightIcon, Button, CheckIcon, Status, Text } from '@/shared/components/ui'
import type { ReviewDrawerData, ReviewRoundView } from '../nodeDrawerModel'
import { GrowRow } from './drawerControls'

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

export function reviewBody(
  state: LifecycleNodeState,
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
