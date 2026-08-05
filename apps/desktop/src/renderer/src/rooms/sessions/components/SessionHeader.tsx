import { Text } from '@/shared/components/ui'
import type { SessionHeaderModel } from '../interiorHeader'
import { ContextRing } from './ContextRing'
import { SessionMeta } from './SessionMeta'
import { SessionTabs } from './SessionTabs'

/**
 * Organism: the session's one header band — context ring left, the title with its meta line beside
 * it on the right, the two tabs on the line below where the meta used to sit.
 *
 * One band, not a header plus a tab strip: folding the tabs in is the space win, and left-aligning
 * them under the title puts them directly over the content they switch. It carries **no action
 * buttons and no `⋯` menu** — renaming happens in the terminal, archiving is a status transition,
 * and relaunching is not a concept — so the band is glance-only.
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
    <>
      <header
        data-component="SessionHeader"
        className="flex items-center gap-region px-plane pt-plane"
      >
        <ContextRing percentage={header.contextPercent} />
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          <div className="flex min-w-0 items-baseline justify-between gap-region">
            {/* `display`, not `title`: a session's name is the plane's own line, the one thing above
                the dense ladder here. Set light and wide, it stops competing with the rows below it. */}
            <Text as="h2" variant="display" className="min-w-0 truncate text-foreground-bright">
              {header.title}
            </Text>
            <SessionMeta
              status={header.status}
              segments={header.meta}
              intent={header.intent}
              onOpenIntent={onOpenIntent}
            />
          </div>
          <SessionTabs className="self-start" />
        </div>
      </header>
      {/* The band closes over the panes rather than letting them run into it. A tapered hair, not a
          ruled line: the scene's edges are light falling off. */}
      <span aria-hidden className="mx-plane shrink-0 rule-taper" />
    </>
  )
}
