import { Expand, Minimize2, PanelRight } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { readCssSize } from '../lib/read-css-size'
import { Button } from './ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable'

type InspectorState = 'open' | 'collapsed' | 'expanded'

// CSS size tokens, read at render so a token change moves the split.
type InspectorSizes = { inspector: string; inspectorMin: string; workspaceMin: string }

export type InspectorSplitProps = {
  // Names the panels and their controls: `Collapse ${noun} inspector`, `Expand ${noun} sidebar`.
  noun: string
  workspace: ReactNode
  inspector: ReactNode
  // What the inspector's top bar holds on the left, beside the toggles.
  bar?: ReactNode
  sizes: InspectorSizes
  // A change of this value opens a collapsed inspector, as choosing something to inspect does.
  reveal?: unknown
  defaultCollapsed?: boolean
}

function useInspectorPanels(sizes: InspectorSizes, reveal: unknown, defaultCollapsed: boolean) {
  const inspectorPanel = usePanelRef()
  const workspacePanel = usePanelRef()
  const [state, setState] = useState<InspectorState>(defaultCollapsed ? 'collapsed' : 'open')

  const open = () => {
    inspectorPanel.current?.expand()
    inspectorPanel.current?.resize(readCssSize(sizes.inspector))
    setState('open')
  }
  const opener = useRef(open)
  opener.current = open
  useEffect(() => {
    if (reveal != null && inspectorPanel.current?.isCollapsed()) opener.current()
  }, [reveal, inspectorPanel])

  return {
    inspectorPanel,
    workspacePanel,
    state,
    synchronizeCollapsed: () => {
      if (inspectorPanel.current?.isCollapsed()) setState('collapsed')
      else setState((current) => (current === 'expanded' ? current : 'open'))
    },
    toggle: () => {
      if (state === 'collapsed') return open()
      if (state === 'expanded') workspacePanel.current?.expand()
      inspectorPanel.current?.collapse()
      setState('collapsed')
    },
    toggleExpanded: () => {
      const expanded = state === 'expanded'
      workspacePanel.current?.[expanded ? 'expand' : 'collapse']()
      setState(expanded ? 'open' : 'expanded')
    },
  }
}

type TogglesProps = {
  noun: string
  state: InspectorState
  onToggle: () => void
  onToggleExpanded: () => void
}

function InspectorToggles({ noun, state, onToggle, onToggleExpanded }: TogglesProps) {
  const expanded = state === 'expanded'
  return (
    <div className="absolute top-0 right-(--spacing-shell-gutter) z-20 flex h-(--size-chrome-bar) items-center gap-(--spacing-shell-tight)">
      {state === 'collapsed' ? (
        <Button
          aria-label={`Open ${noun} inspector`}
          variant="secondary"
          size="icon-sm"
          onClick={onToggle}
        >
          <PanelRight />
        </Button>
      ) : (
        <>
          <Button
            aria-label={expanded ? `Restore ${noun} sidebar` : `Expand ${noun} sidebar`}
            variant="ghost"
            size="icon-sm"
            onClick={onToggleExpanded}
          >
            {expanded ? <Minimize2 /> : <Expand />}
          </Button>
          <Button
            aria-label={`Collapse ${noun} inspector`}
            variant="secondary"
            size="icon-sm"
            onClick={onToggle}
          >
            <PanelRight />
          </Button>
        </>
      )}
    </div>
  )
}

// A workspace beside a resizable inspector that collapses to nothing or expands over the workspace.
export function InspectorSplit(props: InspectorSplitProps) {
  const { noun, workspace, inspector, bar, sizes, reveal, defaultCollapsed = false } = props
  const panels = useInspectorPanels(sizes, reveal, defaultCollapsed)
  const id = noun.toLowerCase()
  return (
    <div className="relative h-full min-h-0">
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
        <ResizablePanel
          id={`${id}-inspector`}
          collapsible
          collapsedSize={0}
          defaultSize={defaultCollapsed ? 0 : readCssSize(sizes.inspector)}
          groupResizeBehavior="preserve-pixel-size"
          minSize={readCssSize(sizes.inspectorMin)}
          panelRef={panels.inspectorPanel}
        >
          <aside
            aria-label={`${noun} inspector`}
            className="flex h-full min-h-0 flex-col bg-sidebar"
          >
            <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-sidebar px-(--spacing-shell-item)">
              {bar}
            </header>
            {inspector}
          </aside>
        </ResizablePanel>
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
