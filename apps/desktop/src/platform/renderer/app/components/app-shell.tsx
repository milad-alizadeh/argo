import {
  type CSSProperties,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { usePanelRef } from 'react-resizable-panels'
import { CockpitNavigationRail } from '../../cockpit/components/cockpit-navigation-rail'
import { Icon } from '../../components/icon/icon'
import { Button } from '../../components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable'
import { readCssSize } from '../../lib/read-css-size'

type AppShellProps = {
  rail?: ReactNode
  sidebar: ReactNode
  leftHeader: ReactNode
  footer?: ReactNode
  children: ReactNode
}

function SidebarToggle({
  collapsed,
  onToggle,
  toggleRef,
}: {
  collapsed: boolean
  onToggle: () => void
  toggleRef: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation('cockpit')
  return (
    <Button
      aria-label={collapsed ? t('shell.openSidebar') : t('shell.collapseSidebar')}
      className="no-drag-region"
      onClick={onToggle}
      ref={toggleRef}
      size="icon-sm"
      variant="ghost"
    >
      <Icon name="panel-left" />
    </Button>
  )
}

function AppRail({ rail }: Pick<AppShellProps, 'rail'>) {
  return (
    <div className="flex min-h-0 w-(--size-navigation-rail) shrink-0 flex-col bg-sidebar">
      <div className="drag-region h-(--size-chrome-bar) shrink-0 border-b border-border/60" />
      <div className="min-h-0 flex-1 border-r border-border/60">
        {rail ?? <CockpitNavigationRail />}
      </div>
    </div>
  )
}

type AppShellControls = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  sidebarToggleRef: RefObject<HTMLButtonElement | null>
}

const AppShellControlsContext = createContext<AppShellControls | null>(null)

// Pages choose where their own header belongs. Sessions puts one over its workspace, while the
// inspector retains its own header; Tickets uses the full main-content width.
export function AppPageHeader({ children }: { children?: ReactNode }) {
  const controls = useContext(AppShellControlsContext)
  return (
    <header
      data-component="AppMainHeader"
      className="drag-region flex h-(--size-chrome-bar) shrink-0 items-center gap-(--spacing-shell-item) border-b border-border/60 bg-background px-(--spacing-shell-gutter)"
    >
      {controls?.sidebarCollapsed ? (
        <SidebarToggle
          collapsed
          onToggle={controls.toggleSidebar}
          toggleRef={controls.sidebarToggleRef}
        />
      ) : (
        <span aria-hidden="true" className="size-(--size-control) shrink-0" />
      )}
      <div className="no-drag-region flex min-w-0 flex-1 items-center">{children}</div>
    </header>
  )
}

function appContentInsets(): CSSProperties {
  return {
    '--inset-app-content-body': 'var(--spacing-shell-inset)',
    '--inset-cockpit-content-body': 'var(--spacing-shell-inset)',
  } as CSSProperties
}

function panelSizes() {
  return {
    sidebarDefault: readCssSize('--size-cockpit-sidebar-default'),
    sidebarMinimum: readCssSize('--size-cockpit-sidebar-min'),
    sidebarMaximum: readCssSize('--size-cockpit-sidebar-max'),
    contentMinimum: readCssSize('--size-cockpit-content-min'),
  }
}

// AppShell owns the persistent application rail and left sidebar. A page owns any split inside its
// main content, such as the Sessions workspace and inspector.
export function AppShell({ rail, sidebar, leftHeader, footer, children }: AppShellProps) {
  const sizes = panelSizes()
  const sidebarPanelRef = usePanelRef()
  const sidebarToggleRef = useRef<HTMLButtonElement>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    if (sidebarCollapsed) {
      sidebarPanelRef.current?.resize(sizes.sidebarMinimum)
      setSidebarCollapsed(false)
      return
    }
    sidebarPanelRef.current?.collapse()
    setSidebarCollapsed(true)
  }

  return (
    <AppShellControlsContext.Provider value={{ sidebarCollapsed, toggleSidebar, sidebarToggleRef }}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex min-h-0 flex-1">
          <AppRail rail={rail} />
          <ResizablePanelGroup
            className="min-w-0 flex-1"
            onLayoutChanged={() =>
              setSidebarCollapsed(sidebarPanelRef.current?.isCollapsed() ?? false)
            }
            orientation="horizontal"
          >
            <ResizablePanel
              collapsible
              collapsedSize={0}
              defaultSize={sizes.sidebarDefault}
              id="app-left-sidebar"
              maxSize={sizes.sidebarMaximum}
              minSize={sizes.sidebarMinimum}
              panelRef={sidebarPanelRef}
            >
              <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
                <header className="drag-region flex h-(--size-chrome-bar) shrink-0 items-center gap-(--spacing-shell-tight) border-b border-border/60 px-(--spacing-shell-gutter)">
                  <SidebarToggle
                    collapsed={false}
                    onToggle={toggleSidebar}
                    toggleRef={sidebarToggleRef}
                  />
                  <div className="no-drag-region ml-auto min-w-0">{leftHeader}</div>
                </header>
                <div className="min-h-0 flex-1">{sidebar}</div>
              </aside>
            </ResizablePanel>
            <ResizableHandle className={sidebarCollapsed ? 'bg-transparent' : 'bg-border/60'} />
            <ResizablePanel id="app-main" minSize={sizes.contentMinimum}>
              <section className="flex h-full min-h-0 min-w-0 flex-col" style={appContentInsets()}>
                {children}
              </section>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </AppShellControlsContext.Provider>
  )
}
