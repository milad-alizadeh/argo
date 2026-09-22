import { type ReactNode, useLayoutEffect } from 'react'
import { InspectorToggles } from '@/platform/renderer/cockpit/inspector-split/inspector-toggles'
import {
  type InspectorSizes,
  useInspectorPanels,
} from '@/platform/renderer/cockpit/inspector-split/use-inspector-panels'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/platform/renderer/components/ui/resizable'
import { readCssSize } from '@/platform/renderer/lib/read-css-size'
import { cn } from '@/platform/renderer/lib/utils'

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

function InspectorPanel({
  bar,
  id,
  inspector,
  noun,
  panels,
  sizes,
  defaultCollapsed,
  defaultInspectorSize,
}: {
  bar: ReactNode
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
        <header className="drag-region flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-sidebar px-(--spacing-shell-item)">
          <div className="no-drag-region flex min-w-0 flex-1 items-center">{bar}</div>
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
  return (
    <div
      data-component="InspectorSplit"
      data-state={panels.state}
      className="relative h-full min-h-0"
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
          defaultCollapsed={defaultCollapsed}
          defaultInspectorSize={defaultInspectorSize}
          id={id}
          inspector={inspector}
          noun={noun}
          panels={panels}
          sizes={sizes}
        />
      </ResizablePanelGroup>
      <InspectorToggles
        noun={noun}
        onToggle={panels.toggle}
        onToggleExpanded={panels.toggleExpanded}
        state={panels.state}
      />
    </div>
  )
}
