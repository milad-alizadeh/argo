import { createContext, type ReactNode, useContext, useLayoutEffect } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable'
import { readCssSize } from '../../lib/read-css-size'
import { cn } from '../../lib/utils'
import { InspectorToggles } from './inspector-toggles'
import { type InspectorSizes, useInspectorPanels } from './use-inspector-panels'

export type InspectorSplitProps = {
  // Names the panels and their controls: `Collapse ${noun} inspector`, `Expand ${noun} sidebar`.
  noun: string
  workspace: ReactNode
  inspector: ReactNode
  // What the inspector's top bar holds on the left, beside the toggles.
  bar?: ReactNode
  sizes: InspectorSizes
  defaultInspectorSize?: string
  // A change of this value opens a collapsed inspector, as choosing something to inspect does.
  reveal?: unknown
  defaultCollapsed?: boolean
}

const InspectorHeaderControlsContext = createContext<ReactNode>(null)

// The page that owns an inspector chooses where its controls belong. It normally places this in
// its own header, so the toggle consumes layout space instead of floating over another control.
export function InspectorHeaderControls() {
  return useContext(InspectorHeaderControlsContext)
}

function InspectorPanel({
  bar,
  controls,
  id,
  inspector,
  noun,
  panels,
  sizes,
  defaultCollapsed,
  defaultInspectorSize,
}: {
  bar: ReactNode
  controls: ReactNode
  id: string
  inspector: ReactNode
  noun: string
  panels: ReturnType<typeof useInspectorPanels>
  sizes: InspectorSizes
  defaultCollapsed: boolean
  defaultInspectorSize: string | undefined
}) {
  // react-resizable-panels draws its own `overflow: auto` wrapper one level above `<aside>`, and
  // gives that wrapper no way to take a prop, so the scrollable element's tab stop is set here by
  // hand once the wrapper exists (#2623: `scrollable-region-focusable`).
  useLayoutEffect(() => {
    const scrollParent = panels.inspectorElement.current?.parentElement
    if (scrollParent) scrollParent.tabIndex = 0
  }, [panels.inspectorElement])
  return (
    <ResizablePanel
      id={`${id}-inspector`}
      collapsible
      collapsedSize={0}
      defaultSize={defaultCollapsed ? 0 : (defaultInspectorSize ?? readCssSize(sizes.inspector))}
      groupResizeBehavior="preserve-pixel-size"
      minSize={readCssSize(sizes.inspectorMin)}
      panelRef={panels.inspectorPanel}
    >
      <aside
        aria-label={`${noun} inspector`}
        ref={panels.inspectorElement}
        className={cn(
          'flex h-full min-h-0 flex-col bg-sidebar',
          (panels.state === 'collapsed' || !panels.isInspectorReady) && 'invisible',
        )}
      >
        <header className="drag-region flex h-(--size-chrome-bar) shrink-0 items-center gap-(--spacing-shell-tight) border-b border-border/60 bg-sidebar px-(--spacing-shell-item)">
          <div className="no-drag-region flex min-w-0 flex-1 items-center">{bar}</div>
          {controls ? (
            <div className="no-drag-region flex shrink-0 items-center gap-(--spacing-shell-tight)">
              {controls}
            </div>
          ) : null}
        </header>
        {inspector}
      </aside>
    </ResizablePanel>
  )
}

// A workspace beside a resizable inspector that collapses to nothing or expands over the workspace.
export function InspectorSplit(props: InspectorSplitProps) {
  const {
    noun,
    workspace,
    inspector,
    bar,
    sizes,
    defaultInspectorSize,
    reveal,
    defaultCollapsed = false,
  } = props
  const panels = useInspectorPanels(sizes, reveal, defaultCollapsed)
  const id = noun.toLowerCase()
  const toggles = (
    <InspectorToggles
      noun={noun}
      onToggle={panels.toggle}
      onToggleExpanded={panels.toggleExpanded}
      state={panels.state}
    />
  )
  return (
    <InspectorHeaderControlsContext.Provider value={panels.state === 'expanded' ? null : toggles}>
      <div
        data-component="InspectorSplit"
        data-state={panels.state}
        className="h-full min-h-0"
        ref={panels.splitElement}
      >
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full"
          onLayoutChanged={panels.synchronizeCollapsed}
        >
          <ResizablePanel
            id={`${id}-workspace`}
            panelRef={panels.workspacePanel}
            collapsible
            collapsedSize={0}
            minSize={readCssSize(sizes.workspaceMin)}
          >
            {workspace}
          </ResizablePanel>
          <ResizableHandle
            className={panels.state === 'collapsed' ? 'bg-transparent' : 'bg-border/60'}
          />
          <InspectorPanel
            bar={bar}
            controls={panels.state === 'expanded' ? toggles : null}
            defaultCollapsed={defaultCollapsed}
            defaultInspectorSize={defaultInspectorSize}
            id={id}
            inspector={inspector}
            noun={noun}
            panels={panels}
            sizes={sizes}
          />
        </ResizablePanelGroup>
      </div>
    </InspectorHeaderControlsContext.Provider>
  )
}
