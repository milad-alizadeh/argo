import { Text } from '@/shared/components/ui'
import type { SessionHeaderModel } from '../interiorHeader'
import { ContextRing } from './ContextRing'
import { SessionMeta } from './SessionMeta'
import { SessionTabs } from './SessionTabs'

/**
 * Organism: the session's one header band — context ring left, title over its meta line, the two
 * tabs bottom-aligned right.
 *
 * One band, not a header plus a tab strip: folding the tabs in is the space win, and bottom-aligning
 * them is what makes them read as attached to their content. It carries **no action buttons and no
 * `⋯` menu** — renaming happens in the terminal, archiving is a status transition, and relaunching
 * is not a concept — so the band is glance-only.
 */
export function SessionHeader({
  header,
  onOpenIntent,
}: {
  /** The header's derived view-model. */
  header: SessionHeaderModel
  /** Open the linked Work Item, from the meta line's intent chip. */
  onOpenIntent?: (number: number) => void
}): React.JSX.Element {
  return (
    <header
      data-component="SessionHeader"
      className="flex items-end justify-between gap-region px-plane pt-plane"
    >
      <div className="flex min-w-0 items-center gap-region pb-inset">
        <ContextRing percentage={header.contextPercent} />
        <div className="flex min-w-0 flex-col gap-tight">
          <Text as="h2" variant="title" className="truncate text-foreground-bright">
            {header.title}
          </Text>
          <SessionMeta segments={header.meta} intent={header.intent} onOpenIntent={onOpenIntent} />
        </div>
      </div>
      <SessionTabs />
    </header>
  )
}
