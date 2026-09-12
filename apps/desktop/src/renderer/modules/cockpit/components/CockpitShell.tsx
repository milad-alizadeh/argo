import { PanelLeftIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { Button } from '../../../components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../components/ui/resizable'
import { sizeFromToken } from '../../../components/ui/size-from-token'
import { CockpitNavigationRail } from './CockpitNavigationRail'

type CockpitShellProps = {
  rail?: ReactNode
  sidebar: ReactNode
  children: ReactNode
}

export function CockpitShell({ rail, sidebar, children }: CockpitShellProps) {
  const sidebarPanelRef = usePanelRef()
  const sidebarDefaultWidth = sizeFromToken('--size-cockpit-sidebar-default')
  const sidebarMaximumWidth = sizeFromToken('--size-cockpit-sidebar-max')
  const contentMinimumWidth = sizeFromToken('--size-cockpit-content-min')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const synchronizeSidebarCollapsed = () => {
    setIsSidebarCollapsed(sidebarPanelRef.current?.isCollapsed() ?? false)
  }

  const toggleSidebar = () => {
    if (isSidebarCollapsed) {
      sidebarPanelRef.current?.resize(sidebarDefaultWidth)
      synchronizeSidebarCollapsed()
      return
    }

    sidebarPanelRef.current?.collapse()
    synchronizeSidebarCollapsed()
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-background">
      <aside className="w-(--size-navigation-rail) shrink-0 border-r border-border/60">
        {rail ?? <CockpitNavigationRail />}
      </aside>
      <ResizablePanelGroup
        orientation="horizontal"
        className="relative min-w-0 flex-1"
        onLayoutChanged={synchronizeSidebarCollapsed}
      >
        <div className="absolute top-0 left-3 z-10 flex h-(--size-chrome-bar) items-center">
          <Button
            aria-label={isSidebarCollapsed ? 'Open Sessions sidebar' : 'Collapse Sessions sidebar'}
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <PanelLeftIcon />
          </Button>
        </div>
        <ResizablePanel
          id="cockpit-sidebar"
          collapsible
          collapsedSize={0}
          defaultSize={sidebarDefaultWidth}
          minSize={sidebarDefaultWidth}
          maxSize={sidebarMaximumWidth}
          panelRef={sidebarPanelRef}
        >
          <aside className="h-full overflow-hidden bg-sidebar">{sidebar}</aside>
        </ResizablePanel>
        <ResizableHandle className={isSidebarCollapsed ? 'bg-transparent' : 'bg-border/60'} />
        <ResizablePanel id="cockpit-content" minSize={contentMinimumWidth}>
          <div className="relative h-full min-w-0 overflow-hidden bg-background">{children}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
