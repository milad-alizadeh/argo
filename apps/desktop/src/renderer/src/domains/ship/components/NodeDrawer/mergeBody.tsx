import type { RibbonNodeState } from '@shared'
import { CheckIcon, Text } from '@/shared/components/ui'
import { DelegatedRow, GateAction, GrowRow } from './drawerControls'

export function mergeBody(
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
