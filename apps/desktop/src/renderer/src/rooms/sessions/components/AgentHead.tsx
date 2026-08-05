import { cn } from '@/lib/utils'
import { ArrowBendDownRightIcon, CaretLeftIcon, Text } from '@/shared/components/ui'
import type { DisplayedAgentModel } from '../interiorActivity'
import { DISCLOSURE } from './rowRecipes'

/** The way back out of a delegate's feed. EXPLICIT, because switching agents replaced the pane rather
 * than scrolling it: there is no "up" to scroll to, so the only route back is a control that says so. */
function BackRow({ label, onBack }: { label: string; onBack: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onBack}
      className={cn(DISCLOSURE, 'flex items-center gap-snug self-start rounded-md')}
    >
      <Text aria-hidden variant="meta" className="text-primary">
        <CaretLeftIcon className="icon-sm" />
      </Text>
      <Text variant="meta" className="text-foreground-faint">
        back to {label}
      </Text>
    </button>
  )
}

/**
 * Organism: the head the detail pane wears while it is showing a DELEGATE's feed — whose work you are
 * reading, its one state word, what kind of thing it is, and the way back.
 *
 * Only a delegate gets one, and it sits OUTSIDE the scroller: a subagent's work is another agent's, so
 * the pane has to say whose it is for as long as you are in it, and a head you can scroll away from is
 * a head that stops answering the question at the moment a long feed makes it worth asking.
 *
 * A PLAIN name. The nav rows beside this feed are the surface's dotted channel; a dot here too would
 * make the head compete with the row that led you to it, and the word at its right edge tells the state
 * once.
 */
export function AgentHead({
  agent,
  onSelectAgent,
}: {
  /** The displayed agent. Its `head` is `null` at the root, where nothing is drawn. */
  agent: DisplayedAgentModel
  /** Show another agent's feed — here, the parent's. */
  onSelectAgent: (agentId: string) => void
}): React.JSX.Element | null {
  const { head, parent } = agent
  if (head === null) return null
  return (
    <div
      data-component="AgentHead"
      className="flex flex-col gap-tight border-b border-b-inset-hair px-region py-gap"
    >
      {parent !== null && <BackRow label={parent.label} onBack={() => onSelectAgent(parent.id)} />}
      <div className="flex items-baseline gap-snug">
        <Text aria-hidden variant="title" className="shrink-0 text-primary">
          <ArrowBendDownRightIcon className="icon-sm" />
        </Text>
        <Text
          as="h3"
          variant="title"
          className={cn(
            'min-w-0 flex-1 truncate',
            head.name === null ? 'text-foreground-faint' : 'text-foreground',
          )}
        >
          {head.name ?? 'a subagent the record did not name'}
        </Text>
        <Text variant="eyebrow" className="shrink-0 text-foreground-faint">
          {head.word}
        </Text>
      </div>
      {/* Assembled from what was observed and nothing else — an absent part dropped out in the
          derivation rather than reading empty here. Mono at its own case, NOT the uppercasing tag role:
          a path shouted back as `ROTATION.TS` is no longer the string that was observed. */}
      {head.meta.length > 0 && (
        <Text variant="prose" className="truncate font-mono text-foreground-faint">
          {head.meta.join(' · ')}
        </Text>
      )}
    </div>
  )
}
