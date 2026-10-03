import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  createContext,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { type Layout, usePanelRef } from 'react-resizable-panels'
import { useInRouterContext } from 'react-router'
import { Icon } from '../../components/icon/icon'
import { Button } from '../../components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable'
import { useFocusModality } from '../../lib/use-focus-modality'
import { cn } from '../../lib/utils'
import { AppNavigationRail } from '../../shell/components/app-navigation-rail'
import { PaneHeaderActiveContext } from '../../shell/components/pane-header-context'
import { readShellPanelSizes } from '../../shell/components/read-shell-panel-sizes'
import { useSidebarToggleFocus } from '../../shell/components/use-sidebar-toggle-focus'

type AppShellProps = {
  rail?: ReactNode
  sidebar: ReactNode
  leftHeader: ReactNode
  footer?: ReactNode
  children: ReactNode
}

const LEFT_SIDEBAR_PANEL_ID = 'app-left-sidebar'

function SidebarToggle({
  collapsed,
  onToggle,
  toggleRef,
}: {
  collapsed: boolean
  onToggle: () => void
  toggleRef?: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation('app')
  return (
    <Button
      aria-label={collapsed ? t('shell.openSidebar') : t('shell.collapseSidebar')}
      className="no-drag-region"
      onClick={onToggle}
      ref={toggleRef}
      size="icon-sm"
      variant="ghost"
    >
      <Icon className="text-muted-foreground" name="panel-left" />
    </Button>
  )
}

const AppRail = memo(function AppRail({ rail }: Pick<AppShellProps, 'rail'>) {
  const inRouter = useInRouterContext()
  return (
    <div className="flex min-h-0 w-(--size-navigation-rail) shrink-0 flex-col">
      <div className="panel-window-chrome" />
      <div className="no-drag-region min-h-0 flex-1">
        {rail ?? (inRouter ? <AppNavigationRail /> : null)}
      </div>
    </div>
  )
})

type AppShellControls = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  sidebarToggleRef: RefObject<HTMLButtonElement | null>
}

const AppShellControlsContext = createContext<AppShellControls | null>(null)

export function useInAppShell() {
  return useContext(AppShellControlsContext) !== null
}

// Each page places its controls in the continuous shell bezel above its content pane.
export function AppPageHeader({
  children,
  className,
  sidebarControls = true,
  ...props
}: ComponentPropsWithoutRef<'header'> & { sidebarControls?: boolean }) {
  const controls = useContext(AppShellControlsContext)
  const headerActive = useContext(PaneHeaderActiveContext)
  return (
    <header
      data-component="AppMainHeader"
      className={cn('panel-window-chrome panel-gutter', className)}
      {...props}
    >
      {controls && sidebarControls ? (
        <div
          className="panel-control-motion"
          data-visible={controls.sidebarCollapsed}
          inert={!controls.sidebarCollapsed || !headerActive}
        >
          <div>
            <div className="w-max pr-(--spacing-shell-item)">
              <SidebarToggle
                collapsed
                onToggle={controls.toggleSidebar}
                toggleRef={
                  controls.sidebarCollapsed && headerActive ? controls.sidebarToggleRef : undefined
                }
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="no-drag-region flex min-w-0 flex-1 items-center">{children}</div>
    </header>
  )
}

// A page's header bar with its content on the rounded surface, as the Sessions workspace draws it.
export function AppPageSurface({
  children,
  header = <AppPageHeader />,
}: {
  children?: ReactNode
  header?: ReactNode
}) {
  return (
    <>
      {header}
      <div className="panel-content relative">
        <div className="panel-content-layout panel-stack @container relative">{children}</div>
      </div>
    </>
  )
}

const AppSidebarHeader = memo(function AppSidebarHeader({
  sidebarCollapsed,
  sidebarToggleRef,
  toggleSidebar,
  leftHeader,
}: AppShellControls & Pick<AppShellProps, 'leftHeader'>) {
  return (
    <header
      data-component="AppProjectHeader"
      className="panel-window-chrome panel-gutter gap-(--spacing-shell-tight)"
    >
      <SidebarToggle
        collapsed={false}
        onToggle={toggleSidebar}
        toggleRef={sidebarCollapsed ? undefined : sidebarToggleRef}
      />
      <div className="no-drag-region ml-auto min-w-0">{leftHeader}</div>
    </header>
  )
})

const AppSidebar = memo(function AppSidebar({
  sidebarRegionRef,
  sidebarCollapsed,
  sidebarToggleRef,
  toggleSidebar,
  leftHeader,
  sidebar,
}: AppShellControls &
  Pick<AppShellProps, 'sidebar' | 'leftHeader'> & {
    sidebarRegionRef: RefObject<HTMLElement | null>
  }) {
  return (
    <section
      data-component="AppSidebar"
      ref={sidebarRegionRef}
      inert={sidebarCollapsed}
      data-hidden={sidebarCollapsed}
      className="panel-stack panel-visibility @container"
    >
      <AppSidebarHeader
        sidebarCollapsed={sidebarCollapsed}
        sidebarToggleRef={sidebarToggleRef}
        toggleSidebar={toggleSidebar}
        leftHeader={leftHeader}
      />
      <aside role="presentation" className="panel-sidebar panel-sidebar-start">
        <div className="panel-stack min-w-(--size-shell-sidebar-min)">{sidebar}</div>
      </aside>
    </section>
  )
})

function appContentInsets(): CSSProperties {
  return {
    '--inset-shell-content-body': 'var(--spacing-shell-inset)',
  } as CSSProperties
}

function AppContent({
  children,
  sidebarCollapsed,
}: Pick<AppShellProps, 'children'> & { sidebarCollapsed: boolean }) {
  return (
    <section
      data-component="AppContent"
      data-sidebar-state={sidebarCollapsed ? 'collapsed' : 'open'}
      className="panel-stack @container"
      style={appContentInsets()}
    >
      {children}
    </section>
  )
}

function useShellSidebar() {
  useFocusModality()
  const sizes = readShellPanelSizes()
  const sidebarPanelRef = usePanelRef()
  const sidebarToggleRef = useRef<HTMLButtonElement>(null)
  const sidebarRegionRef = useRef<HTMLElement>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const requestToggleFocus = useSidebarToggleFocus(sidebarToggleRef, sidebarCollapsed)

  useEffect(() => {
    sidebarRegionRef.current?.setAttribute('tabindex', '0')
  }, [])

  const toggleSidebar = useCallback(() => {
    requestToggleFocus()
    if (sidebarCollapsed) {
      sidebarPanelRef.current?.resize(sizes.sidebarMinimum)
      setSidebarCollapsed(false)
      return
    }
    sidebarPanelRef.current?.collapse()
    setSidebarCollapsed(true)
  }, [requestToggleFocus, sidebarCollapsed, sidebarPanelRef, sizes.sidebarMinimum])
  const controls = useMemo(
    () => ({ sidebarCollapsed, toggleSidebar, sidebarToggleRef }),
    [sidebarCollapsed, toggleSidebar],
  )

  const synchronizeSidebarCollapsed = useCallback((layout: Layout) => {
    const size = layout[LEFT_SIDEBAR_PANEL_ID]
    if (size !== undefined) setSidebarCollapsed(size === 0)
  }, [])
  return { controls, sidebarPanelRef, sidebarRegionRef, sizes, synchronizeSidebarCollapsed }
}

// The rail and project header outlive the page outlet; page panes resize their own header and body.
export const AppShell = memo(function AppShell({
  rail,
  sidebar,
  leftHeader,
  footer,
  children,
}: AppShellProps) {
  const { controls, sidebarPanelRef, sidebarRegionRef, sizes, synchronizeSidebarCollapsed } =
    useShellSidebar()
  const { sidebarCollapsed, sidebarToggleRef, toggleSidebar } = controls

  return (
    <AppShellControlsContext.Provider value={controls}>
      <div data-component="AppShell" className="panel-frame">
        <div className="flex min-h-0 flex-1">
          <AppRail rail={rail} />
          <div className="panel-shell-layout relative flex min-w-0 flex-1">
            <div aria-hidden className="panel-shell-backing" />
            <ResizablePanelGroup
              className="panel-motion min-w-0 flex-1 overflow-visible!"
              onLayoutChange={synchronizeSidebarCollapsed}
              orientation="horizontal"
            >
              <ResizablePanel
                collapsible
                collapsedSize={0}
                defaultSize={sizes.sidebarDefault}
                id={LEFT_SIDEBAR_PANEL_ID}
                inert={sidebarCollapsed}
                maxSize={sizes.sidebarMaximum}
                minSize={sizes.sidebarMinimum}
                panelRef={sidebarPanelRef}
                style={{ overflow: 'visible' }}
              >
                <AppSidebar
                  sidebarRegionRef={sidebarRegionRef}
                  sidebarCollapsed={sidebarCollapsed}
                  sidebarToggleRef={sidebarToggleRef}
                  toggleSidebar={toggleSidebar}
                  leftHeader={leftHeader}
                  sidebar={sidebar}
                />
              </ResizablePanel>
              <ResizableHandle
                className={
                  sidebarCollapsed ? 'w-0 bg-transparent' : 'panel-divider w-0 bg-transparent'
                }
              />
              <ResizablePanel
                id="app-main"
                minSize={sizes.contentMinimum}
                style={{ overflow: 'visible' }}
              >
                <AppContent sidebarCollapsed={sidebarCollapsed}>{children}</AppContent>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </AppShellControlsContext.Provider>
  )
})
