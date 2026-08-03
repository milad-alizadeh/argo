import { PanelSplitter, Tabs, TabsContent, type TerminalAttach, Text } from '@/shared/components/ui'
import { INTERIOR_TABS, type InteriorTab, type SessionInteriorModel } from '../interiorModel'
import { isDockExpanded, SPINE, type SpineLayout } from '../useSpineLayout'
import { ActivityPane } from './ActivityPane'
import { Dock } from './Dock'
import { SessionHeader } from './SessionHeader'

/** Every callback the plane's regions raise, gathered so the room wires them once. */
export interface SessionPlaneHandlers {
  onSelectTab: (tab: InteriorTab) => void
  onResizeDock: (px: number) => void
  onResizeActivity: (px: number) => void
  onToggleDock: () => void
  onOpenIntent?: (number: number) => void
}

// The plane's ONE frosted surface — its regions are flat columns inside it, never a second glass
// layer. `plane`, not `plane-lit`: brightness marks the row you picked, not the surface you are
// already inside.
const GLASS_PLANE = 'plane flex min-w-0 flex-1 flex-col overflow-hidden'

// Narrowed rather than asserted: `Tabs` reports the raw string its own trigger carried, and the two
// tabs the interior has are right here to check it against.
const asInteriorTab = (value: string): InteriorTab | null =>
  INTERIOR_TABS.find((tab) => tab === value) ?? null

/**
 * Organism: the session plane — one continuous glass surface holding the header band, the selected
 * tab's body, and the always-on Dock.
 *
 * The tabs live inside the header band, so the `Tabs` root spans header and body: there is no tab
 * strip of its own anywhere in the plane. Delivery is a seam rather than a surface here — the review
 * pane is its own ticket — so the tab exists and says what it is waiting for instead of faking it.
 */
export function SessionPlane({
  interior,
  layout,
  attach,
  handlers,
}: {
  /** The interior's whole derived view-model. */
  interior: SessionInteriorModel
  /** The spine's splitter-driven px sizes, carried on the screen-local custom properties. */
  layout: SpineLayout
  /** Reaches the session's PTY, for the Dock. */
  attach?: TerminalAttach
  handlers: SessionPlaneHandlers
}): React.JSX.Element {
  return (
    <Tabs
      data-component="SessionPlane"
      value={interior.tab}
      onValueChange={(value) => {
        const tab = asInteriorTab(value)
        if (tab !== null) handlers.onSelectTab(tab)
      }}
      className={GLASS_PLANE}
    >
      <SessionHeader header={interior.header} onOpenIntent={handlers.onOpenIntent} />
      <TabsContent value="activity" className="flex min-h-0 min-w-0 flex-1">
        <ActivityPane
          activity={interior.activity}
          splitter={({ measure }) => (
            <PanelSplitter
              orientation="v"
              label="Activity width"
              size={layout.activity}
              measure={measure}
              min={SPINE.activity.min}
              max={SPINE.activity.max}
              onResize={handlers.onResizeActivity}
            />
          )}
        />
      </TabsContent>
      <TabsContent
        value="delivery"
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-region"
      >
        <Text variant="meta" className="text-foreground-faint">
          the review surface lands with its own ticket
        </Text>
      </TabsContent>
      <PanelSplitter
        orientation="h"
        invert
        label="Dock height"
        size={layout.dock}
        min={SPINE.dock.min}
        max={SPINE.dock.max}
        onResize={handlers.onResizeDock}
      />
      <Dock
        dock={interior.dock}
        expanded={isDockExpanded(layout.dock)}
        attach={attach}
        onToggleExpanded={handlers.onToggleDock}
      />
    </Tabs>
  )
}
