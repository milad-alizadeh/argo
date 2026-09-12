import { useState } from 'react'
import { Expand, Minimize2, PanelRight } from 'lucide-react'
import { usePanelRef } from 'react-resizable-panels'

import { Button } from '../../../components/ui/button'
import { sizeFromToken } from '../../../components/ui/size-from-token'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../../components/ui/resizable'

export function SessionScreenView() {
  const inspectorPanelRef = usePanelRef()
  const workspacePanelRef = usePanelRef()
  const inspectorDefaultWidth = sizeFromToken('--size-session-inspector')
  const inspectorMinWidth = sizeFromToken('--size-session-inspector-min')
  const workspaceMinWidth = sizeFromToken('--size-session-workspace-min')
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [inspectorExpanded, setInspectorExpanded] = useState(false)

  const synchronizeInspectorCollapsed = () => {
    setInspectorCollapsed(inspectorPanelRef.current?.isCollapsed() ?? false)
  }

  const toggleInspector = () => {
    if (inspectorCollapsed) {
      inspectorPanelRef.current?.expand()
      inspectorPanelRef.current?.resize(inspectorDefaultWidth)
    } else inspectorPanelRef.current?.collapse()
    synchronizeInspectorCollapsed()
  }

  const toggleInspectorExpanded = () => {
    if (inspectorExpanded) workspacePanelRef.current?.expand()
    else workspacePanelRef.current?.collapse()
    setInspectorExpanded(!inspectorExpanded)
  }

  return (
    <main className="relative h-full min-h-0 overflow-hidden bg-background">
        <div className="absolute top-0 right-3 z-10 flex h-(--size-chrome-bar) items-center gap-1">
        {inspectorCollapsed ? null : (
          <Button
            aria-label={inspectorExpanded ? 'Restore Session sidebar' : 'Expand Session sidebar'}
            variant="ghost"
            size="icon-sm"
            onClick={toggleInspectorExpanded}
          >
            {inspectorExpanded ? <Minimize2 /> : <Expand />}
          </Button>
        )}
        <Button
          aria-label={inspectorCollapsed ? 'Open Session inspector' : 'Collapse Session inspector'}
          variant="secondary"
          size="icon-sm"
          onClick={toggleInspector}
        >
          <PanelRight />
        </Button>
      </div>
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full"
        onLayoutChanged={synchronizeInspectorCollapsed}
      >
        <ResizablePanel
          id="session-workspace"
          panelRef={workspacePanelRef}
          collapsible
          collapsedSize={0}
          minSize={workspaceMinWidth}
        >
          <div className="flex h-full min-h-0 flex-col">
            <header
              aria-label="Session header"
              className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-background px-3"
            >
              <span className="flex-1" />
            </header>
            <section aria-label="Session feed" className="min-h-0 flex-1" />
            <section aria-label="Session composer" className="shrink-0 border-t border-border/60" />
          </div>
        </ResizablePanel>
        <ResizableHandle className={inspectorCollapsed ? 'bg-transparent' : 'bg-border/60'} />
        <ResizablePanel
          id="session-inspector"
          collapsible
          collapsedSize={0}
          defaultSize={inspectorDefaultWidth}
          groupResizeBehavior="preserve-pixel-size"
          minSize={inspectorMinWidth}
          panelRef={inspectorPanelRef}
        >
          <aside aria-label="Session inspector" className="flex h-full min-h-0 flex-col bg-sidebar">
            <header className="h-(--size-chrome-bar) border-b border-border/60 bg-sidebar" />
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
