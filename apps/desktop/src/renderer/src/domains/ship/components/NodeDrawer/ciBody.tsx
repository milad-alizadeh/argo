import type { LifecycleNodeState } from '@shared'
import { ArrowBendDownRightIcon, ArrowClockwiseIcon, Button, Text } from '@/shared/components/ui'
import type { CiDrawerData } from '../nodeDrawerModel'
import { PrChecksList } from '../PrChecksList'

export function ciBody(
  state: LifecycleNodeState,
  isHead: boolean,
  ci: CiDrawerData,
): React.JSX.Element {
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
      {/* R3: stale is a fact about the sha (`ci.sha !== head_sha`), already resolved into the
       * ribbon's own `state` for this node — read that instead of re-deriving it from `runs`. */}
      {state === 'stale' && (
        <Text variant="meta" className="text-tone-stale">
          superseded by a newer commit
        </Text>
      )}
    </>
  )
}
