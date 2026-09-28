import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
} from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable'
import { readCssSize } from '../../lib/read-css-size'
import { cn } from '../../lib/utils'
import { InspectorToggles } from './inspector-toggles'
import { type InspectorSizes, useInspectorPanels } from './use-inspector-panels'

export type InspectorSplitProps = {
  // Names the panels and their controls: `Collapse ${noun} inspector`, `Expand ${noun} sidebar`.
  noun: string
  workspace: ReactNode
  inspector: ReactNode
  // What the inspector's top bar holds on the left, beside the toggles.
  bar?: ReactNode
  sizes: InspectorSizes
  defaultInspectorSize?: string
  // A change of this value opens a collapsed inspector, as choosing something to inspect does.
  reveal?: unknown
  defaultCollapsed?: boolean
}

const InspectorHeaderControlsContext = createContext<ReactNode>(null)

// The page that owns an inspector chooses where its controls belong. It normally places this in
// its own header, so the toggle consumes layout space instead of floating over another control.
export function InspectorHeaderControls() {
  return useContext(InspectorHeaderControlsContext)
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
  // react-resizable-panels draws its own `overflow: auto` wrapper one level above `<aside>`, and
  // gives that wrapper no way to take a prop, so the scrollable element's tab stop is set here by
  // hand once the wrapper exists (#2623: `scrollable-region-focusable`).
  useLayoutEffect(() => {
    const scrollParent = panels.inspectorElement.current?.parentElement
    if (scrollParent) scrollParent.tabIndex = 0
  }, [panels.inspectorElement])
  return (
    <ResizablePanel
      id={`${id}-inspector`}
      collapsible
      collapsedSize={0}
      defaultSize={defaultCollapsed ? 0 : (defaultInspectorSize ?? readCssSize(sizes.inspector))}
      groupResizeBehavior="preserve-pixel-size"
      minSize={readCssSize(sizes.inspectorMin)}
      panelRef={panels.inspectorPanel}
    >
      <aside
        aria-label={`${noun} inspector`}
        inert={panels.state === 'collapsed'}
        ref={panels.inspectorElement}
        className={cn(
          'panel-frame',
          panels.state !== 'expanded' && 'panel-inner-start',
          panels.state !== 'collapsed' && !panels.isInspectorReady && 'invisible',
        )}
      >
        <header className="panel-header drag-region gap-(--spacing-shell-tight) px-(--spacing-shell-gutter)">
          <div className="no-drag-region flex min-w-0 flex-1 items-center">{bar}</div>
          {controls ? (
            <div className="no-drag-region flex shrink-0 items-center gap-(--spacing-shell-tight)">
              {controls}
            </div>
          ) : null}
        </header>
        <div className="panel-body">{inspector}</div>
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
}) {
  return (
    <div
      data-component="InspectorSplit"
      data-state={panels.state}
      className="h-full min-h-0"
      ref={panels.splitElement}
    >
      <ResizablePanelGroup
        orientation="horizontal"
        className="panel-motion h-full"
        onLayoutChanged={panels.synchronizeCollapsed}
      >
        <ResizablePanel
          className={panels.state === 'collapsed' ? undefined : 'panel-inner-end'}
          id={`${id}-workspace`}
          panelRef={panels.workspacePanel}
          collapsible
          collapsedSize={0}
          minSize={readCssSize(sizes.workspaceMin)}
        >
          {workspace}
        </ResizablePanel>
        <ResizableHandle
          className={
            panels.state === 'open' ? 'panel-divider bg-transparent' : 'w-0 bg-transparent'
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

// A workspace beside a resizable inspector that collapses to nothing or expands over the workspace.
export function InspectorSplit(props: InspectorSplitProps) {
  const {
    noun,
    workspace,
    inspector,
    bar,
    sizes,
    defaultInspectorSize,
    reveal,
    defaultCollapsed = false,
  } = props
  const panels = useInspectorPanels(sizes, reveal, defaultCollapsed)
  const collapsedToggleRef = useRef<HTMLDivElement>(null)
  const inspectorToggleRef = useRef<HTMLDivElement>(null)
  const shouldRestoreToggleFocus = useRef(false)
  const toggle = () => {
    shouldRestoreToggleFocus.current =
      document.activeElement instanceof HTMLElement &&
      (collapsedToggleRef.current?.contains(document.activeElement) === true ||
        inspectorToggleRef.current?.contains(document.activeElement) === true)
    panels.toggle()
  }
  useLayoutEffect(() => {
    if (!shouldRestoreToggleFocus.current) return
    const target =
      panels.state === 'collapsed' ? collapsedToggleRef.current : inspectorToggleRef.current
    target?.querySelector<HTMLElement>('button')?.focus()
    shouldRestoreToggleFocus.current = false
  }, [panels.state])
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
      />
    </InspectorHeaderControlsContext.Provider>
  )
}
