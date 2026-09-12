import { useState, type ReactNode } from 'react'
import { PanelLeftIcon } from 'lucide-react'
import { usePanelRef } from 'react-resizable-panels'

import { Button } from '../../../components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../components/ui/resizable'
import { CockpitNavigationRail } from './CockpitNavigationRail'

const COCKPIT_SIDEBAR_DEFAULT_WIDTH = 336
const COCKPIT_SIDEBAR_MIN_WIDTH = 336
const COCKPIT_SIDEBAR_MAX_WIDTH = 460
type CockpitShellProps = {
  rail?: ReactNode
  sidebar: ReactNode
  children: ReactNode
}

export function CockpitShell({ rail, sidebar, children }: CockpitShellProps) {
  const sidebarPanelRef = usePanelRef()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    if (isSidebarCollapsed) {
      sidebarPanelRef.current?.resize(COCKPIT_SIDEBAR_DEFAULT_WIDTH)
      setIsSidebarCollapsed(false)
      return
    }

    sidebarPanelRef.current?.collapse()
    setIsSidebarCollapsed(true)
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <aside className="w-(--size-navigation-rail) shrink-0 border-r border-border/60">
        {rail ?? <CockpitNavigationRail />}
      </aside>
      <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
        <ResizablePanel
          id="cockpit-sidebar"
          collapsible
          collapsedSize={0}
          defaultSize={COCKPIT_SIDEBAR_DEFAULT_WIDTH}
          minSize={COCKPIT_SIDEBAR_MIN_WIDTH}
          maxSize={COCKPIT_SIDEBAR_MAX_WIDTH}
          panelRef={sidebarPanelRef}
          onResize={(size) => setIsSidebarCollapsed(size.inPixels === 0)}
        >
          <aside className="h-full overflow-hidden bg-sidebar">{sidebar}</aside>
        </ResizablePanel>
        <ResizableHandle className="bg-border/60" />
        <ResizablePanel id="cockpit-content" minSize={360}>
          <div className="relative h-full min-w-0 overflow-hidden bg-background">
            {isSidebarCollapsed ? (
              <div className="absolute top-3 left-3 z-10">
              <Button
                aria-label="Open cockpit sidebar"
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
              >
                <PanelLeftIcon />
              </Button>
              </div>
            ) : null}
            {children}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
