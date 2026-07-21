import {
  LIFECYCLE_KEYS,
  type LifecycleModel,
  type LifecycleNodeKey,
  type TerminalState,
} from '@shared'
import { cn } from '@/lib/utils'
import { GitMergeIcon, type IconAtom, ProhibitIcon, Text } from '@/shared/components/ui'
import { LifecycleNode } from './LifecycleNode'
import { PrAnchor } from './PrAnchor'

const TERMINAL_PRESENTATION: Record<TerminalState, { Icon: IconAtom; word: string; tone: string }> =
  {
    merged: { Icon: GitMergeIcon, word: 'Merged', tone: 'text-tone-landed' },
    closed: { Icon: ProhibitIcon, word: 'Closed', tone: 'text-muted-foreground' },
  }

export interface DeliveryLifecycleProps {
  /** The lifecycle's pre-derived render state (`shared/lifecycleModel.ts`) — `null` renders
   * nothing (R7: no lifecycle until the tree differs from base). Re-derives nothing: this is
   * the same model the Roster row reads, so the two can never disagree. */
  model: LifecycleModel | null
  /** Which node's drawer is showing, if any — a pointer `NodeDrawer` reads beside this. */
  openKey: LifecycleNodeKey | null
  /** The PR this session ships through, once one exists — `null` before `Create PR` runs,
   * and while terminal (the anchor still names what merged/closed). */
  pr: { num: number; ghUrl: string } | null
  className?: string
}

/**
 * Organism: the Delivery panel's header and the ONE home of delivery state — the five-node
 * strip, its terminal replacement once the PR lands or closes (R8), or nothing at all
 * before the tree has anything to deliver (R7).
 */
export function DeliveryLifecycle({
  model,
  openKey,
  pr,
  className,
}: DeliveryLifecycleProps): React.JSX.Element | null {
  if (!model) return null

  const anchor = pr && <PrAnchor prNum={pr.num} ghUrl={pr.ghUrl} />

  if (model.terminal) {
    const { Icon, word, tone } = TERMINAL_PRESENTATION[model.terminal]
    return (
      <section
        aria-label="Work"
        className={cn('flex items-stretch border-border border-b', className)}
      >
        <Text
          variant="row-strong"
          className={cn('inline-flex items-center gap-snug px-inset', tone)}
        >
          <Icon aria-hidden />
          {word}
        </Text>
        {anchor}
      </section>
    )
  }

  return (
    <section
      aria-label="Work"
      className={cn('flex items-stretch border-border border-b', className)}
    >
      <div className="flex flex-1 items-stretch divide-x divide-inset-hair overflow-x-auto">
        {LIFECYCLE_KEYS.map((key) => (
          <LifecycleNode
            key={key}
            nodeKey={key}
            state={model.nodes[key]}
            isHead={key === model.head}
            open={key === openKey}
            clickable={model.nodes[key] !== 'wait'}
          />
        ))}
      </div>
      {anchor}
    </section>
  )
}
