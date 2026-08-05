import { useState } from 'react'
import type { PlanProgressModel } from '../sessionPlan'
import { delegateChapters } from './delegateFeeds'
import { FeedSurface } from './FeedSurface'
import type { Chapter } from './feedIndex'
import { allDelegates, SubagentChips, SubagentRail } from './SubagentPlacements'
import { type DelegateItem, SubagentScope } from './SubagentScope'

// PROTOTYPE — VARIANTS F1/F2/F3: the locked synthesis with the subagent announcement moved to one
// of three seats. F2 (the LEFT RAIL) is the locked one: the rail lists every agent on the surface —
// the main session first — and IS the scope switcher, standing in both scopes, so a delegate's feed
// and the way back are the same gesture. A delegate's scope renders through the SAME FeedSurface as
// the session: one feed grammar, whoever's feed it is.

export type Placement = 'chips' | 'rail' | 'seam'

export function VariantPlacements({
  chapters,
  plan,
  placement,
}: {
  chapters: readonly Chapter[]
  plan: PlanProgressModel | null
  placement: Placement
}): React.JSX.Element {
  const [scope, setScope] = useState<DelegateItem | null>(null)

  if (placement === 'rail') {
    const active = scope === null ? chapters : delegateChapters(scope)
    return (
      <div className="flex min-h-0 min-w-0 flex-1">
        <SubagentRail delegates={allDelegates(chapters)} scope={scope} onSelect={setScope} />
        <FeedSurface
          key={scope?.key ?? 'main'}
          chapters={active}
          plan={scope === null ? plan : null}
          onOpen={setScope}
        />
      </div>
    )
  }

  if (scope !== null) {
    return <SubagentScope item={scope} onBack={() => setScope(null)} />
  }

  const surface = (
    <FeedSurface
      chapters={chapters}
      plan={plan}
      seamDelegates={placement === 'seam'}
      onOpen={setScope}
    />
  )
  if (placement !== 'chips') return surface
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SubagentChips delegates={allDelegates(chapters)} onOpen={setScope} />
      {surface}
    </div>
  )
}
