import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { readCssSize } from '../../lib/read-css-size'

type InspectorState = 'open' | 'collapsed' | 'expanded'

function useRestoreWorkspaceOnResize({
  constrainedExpansion,
  expandedWidth,
  inspectorMinimum,
  splitElement,
  stateRef,
  updateState,
  workspaceMinimum,
  workspacePanel,
}: {
  constrainedExpansion: RefObject<boolean>
  expandedWidth: RefObject<number>
  inspectorMinimum: string
  splitElement: RefObject<HTMLDivElement | null>
  stateRef: RefObject<InspectorState>
  updateState: (state: InspectorState) => void
  workspaceMinimum: string
  workspacePanel: ReturnType<typeof usePanelRef>
}) {
  useLayoutEffect(() => {
    const split = splitElement.current
    if (split === null) return
    const observer = new ResizeObserver(() => {
      if (stateRef.current !== 'expanded' || !constrainedExpansion.current) return
      const availableWidth = split.getBoundingClientRect().width
      const minimumSplitWidth = readCssSize(inspectorMinimum) + readCssSize(workspaceMinimum)
      if (availableWidth < minimumSplitWidth || availableWidth <= expandedWidth.current + 1) return
      workspacePanel.current?.expand()
      constrainedExpansion.current = false
      updateState('open')
    })
    observer.observe(split)
    return () => observer.disconnect()
  }, [
    constrainedExpansion,
    expandedWidth,
    inspectorMinimum,
    splitElement,
    stateRef,
    updateState,
    workspaceMinimum,
    workspacePanel,
  ])
}

// CSS size tokens, read at render so a token change moves the split.
export type InspectorSizes = { inspector: string; inspectorMin: string; workspaceMin: string }

function useOpenInspector({
  dismissedReveal,
  inspectorPanel,
  reveal,
  sizes,
  splitElement,
  stateRef,
  updateState,
  workspacePanel,
  constrainedExpansion,
  expandedWidth,
}: {
  dismissedReveal: RefObject<unknown>
  inspectorPanel: ReturnType<typeof usePanelRef>
  reveal: unknown
  sizes: InspectorSizes
  splitElement: RefObject<HTMLDivElement | null>
  stateRef: RefObject<InspectorState>
  updateState: (state: InspectorState) => void
  workspacePanel: ReturnType<typeof usePanelRef>
  constrainedExpansion: RefObject<boolean>
  expandedWidth: RefObject<number>
}) {
  const open = () => {
    const availableWidth = splitElement.current?.getBoundingClientRect().width ?? 0
    const minimumSplitWidth = readCssSize(sizes.inspectorMin) + readCssSize(sizes.workspaceMin)
    const shouldExpand = availableWidth < minimumSplitWidth
    constrainedExpansion.current = shouldExpand
    expandedWidth.current = availableWidth
    if (shouldExpand) workspacePanel.current?.collapse()
    inspectorPanel.current?.expand()
    inspectorPanel.current?.resize(readCssSize(sizes.inspector))
    updateState(shouldExpand ? 'expanded' : 'open')
  }
  const opener = useRef(open)
  opener.current = open
  useLayoutEffect(() => {
    // A session switch retires `reveal` to null and back (work-selection.ts); returning to the same
    // Session names the same reveal again, which must not read as a fresh pick if the reader already
    // dismissed it by collapsing the panel (#2852).
    if (reveal != null && reveal !== dismissedReveal.current && stateRef.current === 'collapsed')
      opener.current()
  }, [dismissedReveal, reveal, stateRef])
  return open
}

function useInspectorToggles({
  constrainedExpansion,
  dismissedReveal,
  expandedWidth,
  expandWorkspace,
  inspectorPanel,
  open,
  reveal,
  splitElement,
  state,
  updateState,
  workspacePanel,
}: {
  constrainedExpansion: RefObject<boolean>
  dismissedReveal: RefObject<unknown>
  expandedWidth: RefObject<number>
  expandWorkspace: () => void
  inspectorPanel: ReturnType<typeof usePanelRef>
  open: () => void
  reveal: unknown
  splitElement: RefObject<HTMLDivElement | null>
  state: InspectorState
  updateState: (state: InspectorState) => void
  workspacePanel: ReturnType<typeof usePanelRef>
}) {
  return {
    toggle: () => {
      if (state === 'collapsed') return open()
      if (state === 'expanded') {
        expandWorkspace()
        constrainedExpansion.current = false
      }
      dismissedReveal.current = reveal
      inspectorPanel.current?.collapse()
      updateState('collapsed')
    },
    toggleExpanded: () => {
      const expanded = state === 'expanded'
      constrainedExpansion.current = false
      expandedWidth.current = splitElement.current?.getBoundingClientRect().width ?? 0
      workspacePanel.current?.[expanded ? 'expand' : 'collapse']()
      updateState(expanded ? 'open' : 'expanded')
    },
  }
}

function useSynchronizeCollapsed({
  inspectorPanel,
  updateState,
  workspacePanel,
}: {
  inspectorPanel: ReturnType<typeof usePanelRef>
  updateState: (state: InspectorState) => void
  workspacePanel: ReturnType<typeof usePanelRef>
}) {
  return useCallback(() => {
    if (!inspectorPanel.current || !workspacePanel.current) return
    if (inspectorPanel.current.isCollapsed()) {
      updateState('collapsed')
    } else {
      updateState(workspacePanel.current?.isCollapsed() ? 'expanded' : 'open')
    }
  }, [inspectorPanel, updateState, workspacePanel])
}

function useInspectorPanelState(sizes: InspectorSizes, defaultCollapsed: boolean) {
  const inspectorPanel = usePanelRef()
  const workspacePanel = usePanelRef()
  const inspectorElement = useRef<HTMLElement>(null)
  const splitElement = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<InspectorState>(defaultCollapsed ? 'collapsed' : 'open')
  const stateRef = useRef<InspectorState>(defaultCollapsed ? 'collapsed' : 'open')
  const constrainedExpansionRef = useRef(false)
  const expandedWidthRef = useRef(0)
  const dismissedRevealRef = useRef<unknown>(null)
  const updateState = useCallback((next: InspectorState) => {
    stateRef.current = next
    setState(next)
  }, [])
  return {
    constrainedExpansionRef,
    dismissedRevealRef,
    expandedWidthRef,
    inspectorElement,
    inspectorPanel,
    splitElement,
    state,
    stateRef,
    updateState,
    workspacePanel,
    sizes,
  }
}

function useInspectorPanelControls({
  panels,
  reveal,
}: {
  panels: ReturnType<typeof useInspectorPanelState>
  reveal: unknown
}) {
  const {
    constrainedExpansionRef,
    dismissedRevealRef,
    expandedWidthRef,
    inspectorPanel,
    splitElement,
    state,
    stateRef,
    updateState,
    workspacePanel,
    sizes,
  } = panels
  const shared = {
    constrainedExpansion: constrainedExpansionRef,
    expandedWidth: expandedWidthRef,
    inspectorPanel,
    splitElement,
    stateRef,
    updateState,
    workspacePanel,
  }
  useRestoreWorkspaceOnResize({
    ...shared,
    inspectorMinimum: sizes.inspectorMin,
    workspaceMinimum: sizes.workspaceMin,
  })
  const open = useOpenInspector({
    ...shared,
    dismissedReveal: dismissedRevealRef,
    reveal,
    sizes,
  })
  const toggles = useInspectorToggles({
    ...shared,
    dismissedReveal: dismissedRevealRef,
    expandWorkspace: () => workspacePanel.current?.expand(),
    open,
    reveal,
    state,
  })
  const synchronizeCollapsed = useSynchronizeCollapsed({
    inspectorPanel,
    updateState,
    workspacePanel,
  })
  return { synchronizeCollapsed, ...toggles }
}

export function useInspectorPanels(
  sizes: InspectorSizes,
  reveal: unknown,
  defaultCollapsed: boolean,
) {
  const panels = useInspectorPanelState(sizes, defaultCollapsed)
  const controls = useInspectorPanelControls({ panels, reveal })
  return {
    inspectorElement: panels.inspectorElement,
    inspectorPanel: panels.inspectorPanel,
    splitElement: panels.splitElement,
    workspacePanel: panels.workspacePanel,
    state: panels.state,
    ...controls,
  }
}
