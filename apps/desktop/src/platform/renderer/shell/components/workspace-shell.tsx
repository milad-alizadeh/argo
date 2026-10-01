import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePanelRef } from 'react-resizable-panels'
import { Icon } from '../../components/icon/icon'
import { Button } from '../../components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable'
import { readCssSize } from '../../lib/read-css-size'
import { AppNavigationRail } from './app-navigation-rail'

type WorkspaceShellProps = {
  rail?: ReactNode
  sidebar: ReactNode
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
}

type SidebarHeaderProps = {
  header: ReactNode
  onToggle: () => void
  toggleRef: RefObject<HTMLButtonElement | null>
}

type SidebarToggleProps = Pick<SidebarHeaderProps, 'onToggle' | 'toggleRef'>

function sidebarCollapsedState(current: boolean, panelCollapsed: boolean | undefined): boolean {
  return panelCollapsed ?? current
}

function SidebarHeader({ header, onToggle, toggleRef }: SidebarHeaderProps) {
  const { t } = useTranslation('app')
  return (
    <header
      data-component="WorkspaceSidebarHeader"
      className="drag-region flex h-(--size-chrome-bar) shrink-0 items-center gap-(--spacing-shell-tight) border-b border-border/60 px-(--spacing-shell-gutter)"
    >
      <Button
        aria-label={t('shell.collapseSidebar')}
        variant="ghost"
        size="icon-sm"
        className="no-drag-region"
        ref={toggleRef}
        onClick={onToggle}
      >
        <Icon name="panel-left" />
      </Button>
      <div className="no-drag-region ml-auto min-w-0">{header}</div>
    </header>
  )
}

function CollapsedSidebarControl({ onToggle, toggleRef }: SidebarToggleProps) {
  const { t } = useTranslation('app')
  return (
    <div
      data-component="WorkspaceCollapsedSidebarControl"
      className="no-drag-region absolute top-0 left-(--spacing-shell-gutter) z-20 flex h-(--size-chrome-bar) items-center"
    >
      <Button
        aria-label={t('shell.openSidebar')}
        variant="ghost"
        size="icon-sm"
        ref={toggleRef}
        onClick={onToggle}
      >
        <Icon name="panel-left" />
      </Button>
    </div>
  )
}

function WorkspaceSidebar({
  header,
  isCollapsed,
  onToggle,
  sidebar,
  toggleRef,
}: SidebarHeaderProps & { isCollapsed: boolean; sidebar: ReactNode }) {
  if (isCollapsed) return null
  return (
    // A layout wrapper only: the labelled landmark lives one level in, on the content it holds.
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
      <SidebarHeader header={header} onToggle={onToggle} toggleRef={toggleRef} />
      <div className="min-h-0 flex-1">{sidebar}</div>
    </div>
  )
}

function AppRail({ rail }: Pick<WorkspaceShellProps, 'rail'>) {
  return (
    <div className="flex min-h-0 w-(--size-navigation-rail) shrink-0 flex-col">
      <div
        data-component="AppRailChrome"
        className="drag-region h-(--size-chrome-bar) shrink-0 border-b border-border/60 bg-sidebar"
      />
      {/* A layout wrapper only: `AppNavigationRail` (or a story's `rail` override) is its own labelled `nav`. */}
      <div className="no-drag-region min-h-0 flex-1 border-r border-border/60">
        {rail ?? <AppNavigationRail />}
      </div>
    </div>
  )
}

function WorkspaceContent({
  isSidebarCollapsed,
  children,
}: {
  isSidebarCollapsed: boolean
  children: ReactNode
}) {
  return (
    <div
      data-component="WorkspaceContent"
      data-sidebar-state={isSidebarCollapsed ? 'collapsed' : 'open'}
      className={`relative h-full min-w-0 overflow-hidden bg-background ${
        isSidebarCollapsed
          ? '[--inset-shell-content-leading:calc(var(--size-navigation-control)_+_var(--spacing-shell-gutter))]'
          : '[--inset-shell-content-leading:0px]'
      }`}
    >
      {children}
    </div>
  )
}

export function WorkspaceShell({ rail, sidebar, header, footer, children }: WorkspaceShellProps) {
  const sidebarPanelRef = usePanelRef()
  const sidebarDefaultWidth = readCssSize('--size-shell-sidebar-default')
  const sidebarMinimumWidth = readCssSize('--size-shell-sidebar-min')
  const sidebarMaximumWidth = readCssSize('--size-shell-sidebar-max')
  const contentMinimumWidth = readCssSize('--size-shell-content-min')
  const sidebarToggleRef = useRef<HTMLButtonElement>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [shouldFocusSidebarToggle, setShouldFocusSidebarToggle] = useState(false)

  useEffect(() => {
    if (!shouldFocusSidebarToggle) return
    sidebarToggleRef.current?.focus()
    setShouldFocusSidebarToggle(false)
  }, [shouldFocusSidebarToggle])

  const synchronizeSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((current) =>
      sidebarCollapsedState(current, sidebarPanelRef.current?.isCollapsed()),
    )
  }, [sidebarPanelRef])

  const toggleSidebar = () => {
    if (isSidebarCollapsed) {
      sidebarPanelRef.current?.resize(sidebarMinimumWidth)
      setIsSidebarCollapsed(false)
      setShouldFocusSidebarToggle(true)
      return
    }

    sidebarPanelRef.current?.collapse()
    setIsSidebarCollapsed(true)
    setShouldFocusSidebarToggle(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="relative flex min-h-0 flex-1">
        <AppRail rail={rail} />
        <ResizablePanelGroup
          orientation="horizontal"
          className="relative min-w-0 flex-1"
          onLayoutChanged={synchronizeSidebarCollapsed}
        >
          {isSidebarCollapsed ? (
            <CollapsedSidebarControl onToggle={toggleSidebar} toggleRef={sidebarToggleRef} />
          ) : null}
          <ResizablePanel
            id="shell-sidebar"
            collapsible
            collapsedSize={0}
            defaultSize={sidebarDefaultWidth}
            minSize={sidebarMinimumWidth}
            maxSize={sidebarMaximumWidth}
            panelRef={sidebarPanelRef}
          >
            <WorkspaceSidebar
              header={header}
              isCollapsed={isSidebarCollapsed}
              onToggle={toggleSidebar}
              sidebar={sidebar}
              toggleRef={sidebarToggleRef}
            />
          </ResizablePanel>
          <ResizableHandle className={isSidebarCollapsed ? 'bg-transparent' : 'bg-border/60'} />
          <ResizablePanel id="shell-content" minSize={contentMinimumWidth}>
            <WorkspaceContent isSidebarCollapsed={isSidebarCollapsed}>{children}</WorkspaceContent>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  )
}
