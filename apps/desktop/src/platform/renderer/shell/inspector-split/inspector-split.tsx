import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
} from 'react'
import { AppPageHeader, useInAppShell } from '../../app/components/app-shell'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable'
import { readCssSize, resolveCssLength } from '../../lib/read-css-size'
import { useFocusModality } from '../../lib/use-focus-modality'
import { cn } from '../../lib/utils'
import { PaneHeaderActiveContext } from '../components/pane-header-context'
import { InspectorToggles } from './inspector-toggles'
import { type InspectorSizes, useInspectorPanels } from './use-inspector-panels'

export type InspectorSplitProps = {
  // Names the panels and their controls: `Collapse ${noun} inspector`, `Expand ${noun} sidebar`.
  noun: string
  workspace: ReactNode
  inspector: ReactNode
  // The middle pane owns this header, which resizes and collapses with its body.
  header?: ReactNode
  // What the inspector's top bar holds on the left, beside the toggles.
  bar?: ReactNode
  sizes: InspectorSizes
  defaultInspectorSize?: string
  // A change of this value opens a collapsed inspector, as choosing something to inspect does.
  reveal?: unknown
  defaultCollapsed?: boolean
}

const InspectorHeaderControlsContext = createContext<ReactNode>(null)

function inspectorDefaultSize(
  sizes: InspectorSizes,
  override: string | undefined,
): number | string {
  if (override === undefined) return readCssSize(sizes.inspector)
  // The library's explicit percentage strings are ratios, while CSS lengths resolve to pixels.
  const value = override.trim()
  return /^(?:\d+(?:\.\d+)?|\.\d+)%?$/u.test(value) ? value : resolveCssLength(value)
}

// The page that owns an inspector chooses where its controls belong. It normally places this in
// its own header, so the toggle consumes layout space instead of floating over another control.
export function InspectorHeaderControls() {
  return useContext(InspectorHeaderControlsContext)
}

function usePanelScrollTabStop(region: RefObject<HTMLElement | null>, hidden: boolean) {
  useLayoutEffect(() => {
    const scrollParent = region.current?.parentElement
    if (scrollParent) scrollParent.tabIndex = hidden ? -1 : 0
  }, [hidden, region])
}

function InspectorPanel({
  bar,
  controls,
  id,
  inspector,
  noun,
  panels,
  sizes,
  defaultCollapsed,
  defaultInspectorSize,
}: {
  bar: ReactNode
  controls: ReactNode
  id: string
  inspector: ReactNode
  noun: string
  panels: ReturnType<typeof useInspectorPanels>
  sizes: InspectorSizes
  defaultCollapsed: boolean
  defaultInspectorSize: string | undefined
}) {
  // The vendor scroll wrapper needs an explicit Tab stop only while its pane is open (#2623).
  usePanelScrollTabStop(panels.inspectorElement, panels.state === 'collapsed')
  return (
    <ResizablePanel
      id={`${id}-inspector`}
      inert={panels.state === 'collapsed'}
      collapsible
      collapsedSize={0}
      defaultSize={defaultCollapsed ? 0 : inspectorDefaultSize(sizes, defaultInspectorSize)}
      groupResizeBehavior="preserve-pixel-size"
      minSize={readCssSize(sizes.inspectorMin)}
      panelRef={panels.inspectorPanel}
      style={{ overflow: 'visible' }}
    >
      <aside
        aria-label={`${noun} inspector`}
        inert={panels.state === 'collapsed'}
        ref={panels.inspectorElement}
        data-hidden={panels.state === 'collapsed'}
        className="panel-stack panel-visibility @container"
      >
        <AppPageHeader
          data-component="InspectorHeader"
          sidebarControls={panels.state === 'expanded'}
        >
          <div className="no-drag-region flex min-w-0 flex-1 items-center">{bar}</div>
          <div className="no-drag-region flex shrink-0 items-center gap-(--spacing-shell-tight)">
            {controls}
          </div>
        </AppPageHeader>
        <div
          className="panel-sidebar panel-sidebar-end"
          data-sidebar-joined={panels.state === 'expanded'}
        >
          <div className="panel-stack" style={{ minWidth: readCssSize(sizes.inspectorMin) }}>
            {inspector}
          </div>
        </div>
      </aside>
    </ResizablePanel>
  )
}

function InspectorToggleSlot({
  noun,
  onToggle,
  onToggleExpanded,
  slotRef,
  state,
  visible,
}: {
  noun: string
  onToggle: () => void
  onToggleExpanded: () => void
  slotRef: RefObject<HTMLDivElement | null>
  state: 'open' | 'collapsed' | 'expanded'
  visible: boolean
}) {
  return (
    <div ref={slotRef} className="panel-control-motion" data-visible={visible} inert={!visible}>
      <div>
        <div className="flex w-max items-center gap-(--spacing-shell-tight)">
          <InspectorToggles
            noun={noun}
            onToggle={onToggle}
            onToggleExpanded={onToggleExpanded}
            state={state}
          />
        </div>
      </div>
    </div>
  )
}

function InspectorSplitPanels({
  bar,
  defaultCollapsed,
  defaultInspectorSize,
  id,
  inspector,
  noun,
  panels,
  sizes,
  onToggle,
  toggleSlotRef,
  workspace,
  header,
}: {
  bar: ReactNode
  defaultCollapsed: boolean
  defaultInspectorSize: string | undefined
  id: string
  inspector: ReactNode
  noun: string
  panels: ReturnType<typeof useInspectorPanels>
  sizes: InspectorSizes
  onToggle: () => void
  toggleSlotRef: RefObject<HTMLDivElement | null>
  workspace: ReactNode
  header: ReactNode
}) {
  const workspaceRegionRef = useRef<HTMLDivElement>(null)
  usePanelScrollTabStop(workspaceRegionRef, panels.state === 'expanded')
  return (
    <div
      data-component="InspectorSplit"
      data-state={panels.state}
      className="min-h-0 flex-1"
      ref={panels.splitElement}
    >
      <ResizablePanelGroup
        orientation="horizontal"
        className="panel-motion h-full overflow-visible!"
        onLayoutChanged={panels.synchronizeCollapsed}
      >
        <ResizablePanel
          id={`${id}-workspace`}
          inert={panels.state === 'expanded'}
          tabIndex={panels.state === 'expanded' ? -1 : 0}
          panelRef={panels.workspacePanel}
          collapsible
          collapsedSize={0}
          minSize={readCssSize(sizes.workspaceMin)}
          style={{ overflow: 'visible' }}
        >
          <div
            ref={workspaceRegionRef}
            inert={panels.state === 'expanded'}
            data-hidden={panels.state === 'expanded'}
            className="panel-stack panel-visibility @container"
          >
            <PaneHeaderActiveContext value={panels.state !== 'expanded'}>
              {header}
              {workspace}
            </PaneHeaderActiveContext>
          </div>
        </ResizablePanel>
        <ResizableHandle
          className={
            panels.state === 'open' ? 'panel-divider w-0 bg-transparent' : 'w-0 bg-transparent'
          }
        />
        <InspectorPanel
          bar={bar}
          controls={
            <InspectorToggleSlot
              noun={noun}
              onToggle={onToggle}
              onToggleExpanded={panels.toggleExpanded}
              state={panels.state === 'expanded' ? 'expanded' : 'open'}
              slotRef={toggleSlotRef}
              visible={panels.state !== 'collapsed'}
            />
          }
          defaultCollapsed={defaultCollapsed}
          defaultInspectorSize={defaultInspectorSize}
          id={id}
          inspector={inspector}
          noun={noun}
          panels={panels}
          sizes={sizes}
        />
      </ResizablePanelGroup>
    </div>
  )
}

function useInspectorToggleFocus({
  state,
  collapsedToggleRef,
  inspectorToggleRef,
}: {
  state: 'open' | 'collapsed' | 'expanded'
  collapsedToggleRef: RefObject<HTMLDivElement | null>
  inspectorToggleRef: RefObject<HTMLDivElement | null>
}) {
  const shouldRestoreToggleFocus = useRef(false)
  const requestFocus = () => {
    shouldRestoreToggleFocus.current =
      document.activeElement instanceof HTMLElement &&
      (collapsedToggleRef.current?.contains(document.activeElement) === true ||
        inspectorToggleRef.current?.contains(document.activeElement) === true)
  }
  useLayoutEffect(() => {
    if (!shouldRestoreToggleFocus.current) return
    const target = state === 'collapsed' ? collapsedToggleRef.current : inspectorToggleRef.current
    let frame: number
    const focusWhenVisible = () => {
      const button = target?.querySelector<HTMLElement>('[data-inspector-toggle]')
      if (button && getComputedStyle(button).visibility !== 'visible') {
        frame = requestAnimationFrame(focusWhenVisible)
        return
      }
      button?.focus()
      shouldRestoreToggleFocus.current = false
    }
    frame = requestAnimationFrame(focusWhenVisible)
    return () => cancelAnimationFrame(frame)
  }, [collapsedToggleRef, inspectorToggleRef, state])
  return requestFocus
}

// A workspace beside a resizable inspector that collapses to nothing or expands over the workspace.
export function InspectorSplit(props: InspectorSplitProps) {
  useFocusModality()
  const {
    noun,
    workspace,
    inspector,
    header,
    bar,
    sizes,
    defaultInspectorSize,
    reveal,
    defaultCollapsed = false,
  } = props
  const inAppShell = useInAppShell()
  const panels = useInspectorPanels(sizes, reveal, defaultCollapsed)
  const collapsedToggleRef = useRef<HTMLDivElement>(null)
  const inspectorToggleRef = useRef<HTMLDivElement>(null)
  const requestToggleFocus = useInspectorToggleFocus({
    state: panels.state,
    collapsedToggleRef,
    inspectorToggleRef,
  })
  const toggle = () => {
    requestToggleFocus()
    panels.toggle()
  }
  const collapsedControls = (
    <InspectorToggleSlot
      noun={noun}
      onToggle={toggle}
      onToggleExpanded={panels.toggleExpanded}
      slotRef={collapsedToggleRef}
      state="collapsed"
      visible={panels.state === 'collapsed'}
    />
  )
  return (
    <InspectorHeaderControlsContext.Provider value={collapsedControls}>
      <div className={cn('panel-stack', !inAppShell && 'panel-shell-layout relative')}>
        {!inAppShell && <div aria-hidden className="panel-shell-backing" />}
        <InspectorSplitPanels
          bar={bar}
          defaultCollapsed={defaultCollapsed}
          defaultInspectorSize={defaultInspectorSize}
          id={noun.toLowerCase()}
          inspector={inspector}
          noun={noun}
          panels={panels}
          sizes={sizes}
          onToggle={toggle}
          toggleSlotRef={inspectorToggleRef}
          workspace={workspace}
          header={header}
        />
      </div>
    </InspectorHeaderControlsContext.Provider>
  )
}
