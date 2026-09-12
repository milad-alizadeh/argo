import { useState } from 'react'
import { PanelRightIcon } from 'lucide-react'
import { usePanelRef } from 'react-resizable-panels'

import { Button } from '../../../components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../components/ui/resizable'

const SESSION_INSPECTOR_DEFAULT_WIDTH = 224
const SESSION_INSPECTOR_MIN_WIDTH = 200

type SessionScreenViewProps = {
  sessionLocation: string
  sessionTitle: string
}

export function SessionScreenView({ sessionLocation, sessionTitle }: SessionScreenViewProps) {
  const inspectorPanelRef = usePanelRef()
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false)

  const toggleInspector = () => {
    if (isInspectorCollapsed) {
      inspectorPanelRef.current?.resize(SESSION_INSPECTOR_DEFAULT_WIDTH)
      setIsInspectorCollapsed(false)
      return
    }

    inspectorPanelRef.current?.collapse()
    setIsInspectorCollapsed(true)
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header aria-label="Session header" className="flex h-(--size-chrome-bar) shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4">
        <div className="min-w-0 flex-1 overflow-hidden">
          <h1 className="truncate text-heading font-medium text-foreground">{sessionTitle}</h1>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
            <span className="truncate font-mono">{sessionLocation}</span>
          </div>
        </div>
        {isInspectorCollapsed ? (
          <Button
            aria-label="Open Session inspector"
            variant="secondary"
            size="icon-sm"
            className="translate-x-1.25"
            onClick={toggleInspector}
          >
            <PanelRightIcon />
          </Button>
        ) : null}
      </header>
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id="session-workspace" minSize={360}>
          <div className="flex h-full min-h-0 flex-col">
            <section aria-label="Session feed" className="min-h-0 flex-1" />
            <section aria-label="Session composer" className="shrink-0 border-t border-border/60" />
          </div>
        </ResizablePanel>
        <ResizableHandle className="bg-border/60" />
        <ResizablePanel
          id="session-inspector"
          collapsible
          collapsedSize={0}
          defaultSize={SESSION_INSPECTOR_DEFAULT_WIDTH}
          minSize={SESSION_INSPECTOR_MIN_WIDTH}
          panelRef={inspectorPanelRef}
          onResize={(size) => setIsInspectorCollapsed(size.inPixels === 0)}
        >
          <aside aria-label="Session inspector" className="h-full">
            <header className="flex h-(--size-chrome-bar) items-center justify-between border-b border-border/60 bg-sidebar px-3">
              <span aria-hidden="true" />
              <Button
                aria-label="Collapse Session inspector"
                variant="secondary"
                size="icon-sm"
                onClick={toggleInspector}
              >
                <PanelRightIcon />
              </Button>
            </header>
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
