import type { RibbonNodeState } from '@shared'
import { CheckIcon, GitPullRequestIcon, Text } from '@/components/ui'
import { DelegatedRow, GateAction, GrowRow } from './drawerControls'

export function prBody(
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
