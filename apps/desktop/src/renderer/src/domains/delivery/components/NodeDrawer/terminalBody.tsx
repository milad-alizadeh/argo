import { Button, CaretRightIcon, GitPullRequestIcon, Text } from '@/shared/components/ui'
import type { ClosedSummary, MergedSummary } from '../nodeDrawerModel'
import { GrowRow } from './drawerControls'

export function mergedBody(summary: MergedSummary): React.JSX.Element {
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
        <CaretRightIcon aria-hidden />
        Next ticket from main
      </Button>
    </>
  )
}

export function closedBody(summary: ClosedSummary): React.JSX.Element {
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
        <CaretRightIcon aria-hidden />
        New session from main
      </Button>
    </>
  )
}
