import { type ReactNode, type RefObject, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePanelRef } from 'react-resizable-panels'
import { Icon } from '../../components/icon/icon'
import { Button } from '../../components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable'
import { readCssSize } from '../../lib/read-css-size'
import { AppNavigationRail } from './app-navigation-rail'
import { useSidebarToggleFocus } from './use-sidebar-toggle-focus'

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
  toggleRef?: RefObject<HTMLButtonElement | null>
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
      className="panel-window-chrome panel-gutter gap-(--spacing-shell-tight)"
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
  return (
    // A layout wrapper only: the labelled landmark lives one level in, on the content it holds.
    <div inert={isCollapsed} className="panel-frame panel-outer-start">
      <SidebarHeader
        header={header}
        onToggle={onToggle}
        toggleRef={isCollapsed ? undefined : toggleRef}
      />
      <div className="panel-body">{sidebar}</div>
    </div>
  )
}

function AppRail({ rail }: Pick<WorkspaceShellProps, 'rail'>) {
  return (
    <div className="flex min-h-0 w-(--size-navigation-rail) shrink-0 flex-col">
      <div data-component="AppRailChrome" className="panel-window-chrome" />
      {/* A layout wrapper only: `AppNavigationRail` (or a story's `rail` override) is its own labelled `nav`. */}
      <div className="no-drag-region min-h-0 flex-1">{rail ?? <AppNavigationRail />}</div>
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
      className={`panel-frame panel-outer-end relative ${
        isSidebarCollapsed
          ? 'panel-outer-start [--inset-shell-content-leading:calc(var(--size-navigation-control)_+_var(--spacing-shell-gutter)]'
          : 'panel-inner-start [--inset-shell-content-leading:var(--spacing-shell-gutter)]'
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
  const requestToggleFocus = useSidebarToggleFocus(sidebarToggleRef, isSidebarCollapsed)

  const synchronizeSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((current) =>
      sidebarCollapsedState(current, sidebarPanelRef.current?.isCollapsed()),
    )
  }, [sidebarPanelRef])

  const toggleSidebar = () => {
    requestToggleFocus()
    if (isSidebarCollapsed) {
      sidebarPanelRef.current?.resize(sidebarMinimumWidth)
      setIsSidebarCollapsed(false)
      return
    }

    sidebarPanelRef.current?.collapse()
    setIsSidebarCollapsed(true)
  }

  return (
    <div data-component="WorkspaceShell" className="panel-frame overflow-hidden">
      <div className="relative flex min-h-0 flex-1">
        <AppRail rail={rail} />
        <div className="panel-inset relative flex min-w-0 flex-1">
          <ResizablePanelGroup
            orientation="horizontal"
            className="panel-motion relative min-w-0 flex-1"
            onLayoutChanged={synchronizeSidebarCollapsed}
          >
            {isSidebarCollapsed ? (
              <CollapsedSidebarControl onToggle={toggleSidebar} toggleRef={sidebarToggleRef} />
            ) : null}
            <ResizablePanel
              id="shell-sidebar"
              inert={isSidebarCollapsed}
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
            <ResizableHandle
              className={isSidebarCollapsed ? 'w-0 bg-transparent' : 'panel-divider bg-transparent'}
            />
            <ResizablePanel id="shell-content" minSize={contentMinimumWidth}>
              <WorkspaceContent isSidebarCollapsed={isSidebarCollapsed}>
                {children}
              </WorkspaceContent>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  )
}
