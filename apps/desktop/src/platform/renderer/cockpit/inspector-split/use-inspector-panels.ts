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

function useInspectorReadiness({
  defaultCollapsed,
  element,
  state,
}: {
  defaultCollapsed: boolean
  element: RefObject<HTMLElement | null>
  state: InspectorState
}) {
  const [isInspectorReady, setIsInspectorReady] = useState(!defaultCollapsed)
  const synchronizeReady = useCallback(() => {
    const width = element.current?.getBoundingClientRect().width ?? 0
    setIsInspectorReady(width > 0)
  }, [element])
  useLayoutEffect(() => {
    if (state === 'collapsed' || element.current === null) return
    const observer = new ResizeObserver(synchronizeReady)
    observer.observe(element.current)
    synchronizeReady()
    return () => observer.disconnect()
  }, [element, state, synchronizeReady])
  return { isInspectorReady, synchronizeReady, setIsInspectorReady }
}

function useOpenInspector({
  inspectorPanel,
  reveal,
  setIsInspectorReady,
  sizes,
  splitElement,
  stateRef,
  updateState,
  workspacePanel,
  constrainedExpansion,
  expandedWidth,
}: {
  inspectorPanel: ReturnType<typeof usePanelRef>
  reveal: unknown
  setIsInspectorReady: (ready: boolean) => void
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
    setIsInspectorReady(true)
    if (shouldExpand) workspacePanel.current?.collapse()
    inspectorPanel.current?.expand()
    inspectorPanel.current?.resize(readCssSize(sizes.inspector))
    updateState(shouldExpand ? 'expanded' : 'open')
  }
  const opener = useRef(open)
  opener.current = open
  useLayoutEffect(() => {
    if (reveal != null && stateRef.current === 'collapsed') opener.current()
  }, [reveal, stateRef])
  return open
}

function useInspectorToggles({
  constrainedExpansion,
  expandedWidth,
  expandWorkspace,
  inspectorPanel,
  open,
  setIsInspectorReady,
  splitElement,
  state,
  updateState,
  workspacePanel,
}: {
  constrainedExpansion: RefObject<boolean>
  expandedWidth: RefObject<number>
  expandWorkspace: () => void
  inspectorPanel: ReturnType<typeof usePanelRef>
  open: () => void
  setIsInspectorReady: (ready: boolean) => void
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
      setIsInspectorReady(false)
      inspectorPanel.current?.collapse()
      updateState('collapsed')
    },
    toggleExpanded: () => {
      const expanded = state === 'expanded'
      constrainedExpansion.current = !expanded
      expandedWidth.current = splitElement.current?.getBoundingClientRect().width ?? 0
      workspacePanel.current?.[expanded ? 'expand' : 'collapse']()
      updateState(expanded ? 'open' : 'expanded')
    },
  }
}

function useSynchronizeCollapsed({
  inspectorPanel,
  setIsInspectorReady,
  synchronizeReady,
  stateRef,
  updateState,
  workspacePanel,
}: {
  inspectorPanel: ReturnType<typeof usePanelRef>
  setIsInspectorReady: (ready: boolean) => void
  synchronizeReady: () => void
  stateRef: RefObject<InspectorState>
  updateState: (state: InspectorState) => void
  workspacePanel: ReturnType<typeof usePanelRef>
}) {
  return useCallback(() => {
    if (inspectorPanel.current?.isCollapsed()) {
      if (stateRef.current !== 'collapsed') return
      setIsInspectorReady(false)
      updateState('collapsed')
    } else {
      synchronizeReady()
      updateState(workspacePanel.current?.isCollapsed() ? 'expanded' : 'open')
    }
  }, [inspectorPanel, setIsInspectorReady, stateRef, synchronizeReady, updateState, workspacePanel])
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
  const readiness = useInspectorReadiness({ defaultCollapsed, element: inspectorElement, state })
  const updateState = (next: InspectorState) => {
    stateRef.current = next
    setState(next)
  }
  return {
    constrainedExpansionRef,
    expandedWidthRef,
    inspectorElement,
    inspectorPanel,
    readiness,
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
    expandedWidthRef,
    inspectorPanel,
    readiness: { isInspectorReady, setIsInspectorReady, synchronizeReady },
    splitElement,
    state,
    stateRef,
    updateState,
    workspacePanel,
    sizes,
  } = panels
  useRestoreWorkspaceOnResize({
    constrainedExpansion: constrainedExpansionRef,
    expandedWidth: expandedWidthRef,
    inspectorMinimum: sizes.inspectorMin,
    splitElement,
    stateRef,
    updateState,
    workspaceMinimum: sizes.workspaceMin,
    workspacePanel,
  })
  const open = useOpenInspector({
    constrainedExpansion: constrainedExpansionRef,
    expandedWidth: expandedWidthRef,
    inspectorPanel,
    reveal,
    setIsInspectorReady,
    sizes,
    splitElement,
    stateRef,
    updateState,
    workspacePanel,
  })
  const toggles = useInspectorToggles({
    constrainedExpansion: constrainedExpansionRef,
    expandedWidth: expandedWidthRef,
    expandWorkspace: () => workspacePanel.current?.expand(),
    inspectorPanel,
    open,
    setIsInspectorReady,
    splitElement,
    state,
    updateState,
    workspacePanel,
  })
  const synchronizeCollapsed = useSynchronizeCollapsed({
    inspectorPanel,
    setIsInspectorReady,
    stateRef,
    synchronizeReady,
    updateState,
    workspacePanel,
  })
  return { isInspectorReady, synchronizeCollapsed, ...toggles }
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
