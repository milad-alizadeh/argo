import {
  type CSSProperties,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { usePanelRef } from 'react-resizable-panels'
import { useInRouterContext } from 'react-router'
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
  toggleRef?: RefObject<HTMLButtonElement | null>
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
  const inRouter = useInRouterContext()
  return (
    <div className="flex min-h-0 w-(--size-navigation-rail) shrink-0 flex-col">
      <div className="drag-region h-(--size-chrome-bar) shrink-0" />
      <div className="min-h-0 flex-1">{rail ?? (inRouter ? <CockpitNavigationRail /> : null)}</div>
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
      className="panel-header drag-region px-(--spacing-shell-gutter)"
    >
      {controls ? (
        <div
          className="panel-control-motion"
          data-visible={controls.sidebarCollapsed}
          inert={!controls.sidebarCollapsed}
        >
          <div>
            <div className="w-max pr-(--spacing-shell-item)">
              <SidebarToggle
                collapsed
                onToggle={controls.toggleSidebar}
                toggleRef={controls.sidebarCollapsed ? controls.sidebarToggleRef : undefined}
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="no-drag-region flex min-w-0 flex-1 items-center pl-[calc(var(--spacing-shell-icon)+var(--spacing-shell-tight))]">
        {children}
      </div>
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
  const sidebarRegionRef = useRef<HTMLElement>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    sidebarRegionRef.current?.setAttribute('tabindex', '0')
  }, [])

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
      <div className="panel-frame overflow-hidden">
        <div className="flex min-h-0 flex-1">
          <AppRail rail={rail} />
          <div className="panel-elevation mb-(--spacing-shell-inset) mr-(--spacing-shell-inset) flex min-w-0 flex-1">
            <ResizablePanelGroup
              className="panel-motion min-w-0 flex-1"
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
                <section ref={sidebarRegionRef} className="panel-frame panel-outer-start">
                  <header className="panel-header drag-region gap-(--spacing-shell-tight) px-(--spacing-shell-gutter)">
                    <div
                      className="panel-control-motion"
                      data-visible={!sidebarCollapsed}
                      inert={sidebarCollapsed}
                    >
                      <div>
                        <div className="w-max">
                          <SidebarToggle
                            collapsed={false}
                            onToggle={toggleSidebar}
                            toggleRef={sidebarCollapsed ? undefined : sidebarToggleRef}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="no-drag-region ml-auto min-w-0">{leftHeader}</div>
                  </header>
                  <div className="panel-body">{sidebar}</div>
                </section>
              </ResizablePanel>
              <ResizableHandle
                className={sidebarCollapsed ? 'w-0 bg-transparent' : 'panel-divider bg-transparent'}
              />
              <ResizablePanel id="app-main" minSize={sizes.contentMinimum}>
                <section
                  className={`panel-frame panel-outer-end ${sidebarCollapsed ? 'panel-outer-start' : 'panel-inner-start'}`}
                  style={appContentInsets()}
                >
                  {children}
                </section>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </AppShellControlsContext.Provider>
  )
}
