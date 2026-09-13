import { PanelLeftIcon } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { Button } from '../../../components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../components/ui/resizable'
import { readCssSize } from '../../../lib/read-css-size'
import { CockpitNavigationRail } from './CockpitNavigationRail'
import { ProjectSwitcher } from './ProjectSwitcher'

type CockpitShellProps = {
  rail?: ReactNode
  sidebar: ReactNode
  header?: ReactNode
  children: ReactNode
}

type SidebarHeaderProps = {
  header: ReactNode
  onToggle: () => void
  toggleRef: RefObject<HTMLButtonElement | null>
}

function SidebarHeader({ header, onToggle, toggleRef }: SidebarHeaderProps) {
  return (
    <header className="drag-region flex h-(--size-chrome-bar) shrink-0 items-center gap-(--spacing-shell-tight) border-b border-border/60 px-(--spacing-shell-gutter)">
      <Button
        aria-label="Collapse sidebar"
        variant="ghost"
        size="icon-sm"
        className="no-drag-region"
        ref={toggleRef}
        onClick={onToggle}
      >
        <PanelLeftIcon />
      </Button>
      <div className="no-drag-region ml-auto min-w-0">{header}</div>
    </header>
  )
}

export function CockpitShell({
  rail,
  sidebar,
  header = <ProjectSwitcher />,
  children,
}: CockpitShellProps) {
  const sidebarPanelRef = usePanelRef()
  const sidebarDefaultWidth = readCssSize('--size-cockpit-sidebar-default')
  const sidebarMaximumWidth = readCssSize('--size-cockpit-sidebar-max')
  const contentMinimumWidth = readCssSize('--size-cockpit-content-min')
  const sidebarToggleRef = useRef<HTMLButtonElement>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [shouldFocusSidebarToggle, setShouldFocusSidebarToggle] = useState(false)

  useEffect(() => {
    if (!shouldFocusSidebarToggle) return
    sidebarToggleRef.current?.focus()
    setShouldFocusSidebarToggle(false)
  }, [shouldFocusSidebarToggle])

  const synchronizeSidebarCollapsed = () => {
    setIsSidebarCollapsed(sidebarPanelRef.current?.isCollapsed() ?? false)
  }

  const toggleSidebar = () => {
    if (isSidebarCollapsed) {
      sidebarPanelRef.current?.resize(sidebarDefaultWidth)
      setIsSidebarCollapsed(false)
      setShouldFocusSidebarToggle(true)
      return
    }

    sidebarPanelRef.current?.collapse()
    setIsSidebarCollapsed(true)
    setShouldFocusSidebarToggle(true)
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
        {isSidebarCollapsed ? (
          <div className="absolute top-0 left-(--spacing-shell-gutter) z-20 flex h-(--size-chrome-bar) items-center gap-(--spacing-shell-tight)">
            <Button
              aria-label="Open sidebar"
              variant="ghost"
              size="icon-sm"
              ref={sidebarToggleRef}
              onClick={toggleSidebar}
            >
              <PanelLeftIcon />
            </Button>
            <div className="min-w-0">{header}</div>
          </div>
        ) : null}
        <ResizablePanel
          id="cockpit-sidebar"
          collapsible
          collapsedSize={0}
          defaultSize={sidebarDefaultWidth}
          minSize={sidebarDefaultWidth}
          maxSize={sidebarMaximumWidth}
          panelRef={sidebarPanelRef}
        >
          <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
            <SidebarHeader header={header} onToggle={toggleSidebar} toggleRef={sidebarToggleRef} />
            <div className="min-h-0 flex-1">{sidebar}</div>
          </aside>
        </ResizablePanel>
        <ResizableHandle className={isSidebarCollapsed ? 'bg-transparent' : 'bg-border/60'} />
        <ResizablePanel id="cockpit-content" minSize={contentMinimumWidth}>
          <div className="relative h-full min-w-0 overflow-hidden bg-background">{children}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
