import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { readCssSize } from '../lib/read-css-size'

type InspectorState = 'open' | 'collapsed' | 'expanded'

// CSS size tokens, read at render so a token change moves the split.
export type InspectorSizes = { inspector: string; inspectorMin: string; workspaceMin: string }

function useInspectorReadiness({
  defaultCollapsed,
  element,
  inspectorMin,
  state,
}: {
  defaultCollapsed: boolean
  element: RefObject<HTMLElement | null>
  inspectorMin: string
  state: InspectorState
}) {
  const [isInspectorReady, setIsInspectorReady] = useState(!defaultCollapsed)
  const synchronizeReady = useCallback(() => {
    const width = element.current?.getBoundingClientRect().width ?? 0
    setIsInspectorReady(width >= readCssSize(inspectorMin))
  }, [element, inspectorMin])
  useLayoutEffect(() => {
    if (state === 'collapsed' || element.current === null) return
    const observer = new ResizeObserver(synchronizeReady)
    observer.observe(element.current)
    synchronizeReady()
    return () => observer.disconnect()
  }, [element, state, synchronizeReady])
  return { isInspectorReady, synchronizeReady, setIsInspectorReady }
}

export function useInspectorPanels(
  sizes: InspectorSizes,
  reveal: unknown,
  defaultCollapsed: boolean,
) {
  const inspectorPanel = usePanelRef()
  const workspacePanel = usePanelRef()
  const inspectorElement = useRef<HTMLElement>(null)
  const [state, setState] = useState<InspectorState>(defaultCollapsed ? 'collapsed' : 'open')
  const stateRef = useRef<InspectorState>(defaultCollapsed ? 'collapsed' : 'open')
  const { isInspectorReady, setIsInspectorReady, synchronizeReady } = useInspectorReadiness({
    defaultCollapsed,
    element: inspectorElement,
    inspectorMin: sizes.inspectorMin,
    state,
  })
  const updateState = (next: InspectorState) => {
    stateRef.current = next
    setState(next)
  }

  const open = () => {
    setIsInspectorReady(true)
    inspectorPanel.current?.expand()
    inspectorPanel.current?.resize(readCssSize(sizes.inspector))
    updateState('open')
  }
  const opener = useRef(open)
  opener.current = open
  useLayoutEffect(() => {
    if (reveal != null && stateRef.current === 'collapsed') opener.current()
  }, [reveal])
  return {
    inspectorElement,
    inspectorPanel,
    workspacePanel,
    state,
    isInspectorReady,
    synchronizeCollapsed: () => {
      if (inspectorPanel.current?.isCollapsed()) {
        if (stateRef.current !== 'collapsed') return
        setIsInspectorReady(false)
        updateState('collapsed')
      } else {
        synchronizeReady()
        updateState(stateRef.current === 'expanded' ? 'expanded' : 'open')
      }
    },
    toggle: () => {
      if (state === 'collapsed') return open()
      if (state === 'expanded') workspacePanel.current?.expand()
      setIsInspectorReady(false)
      inspectorPanel.current?.collapse()
      updateState('collapsed')
    },
    toggleExpanded: () => {
      const expanded = state === 'expanded'
      workspacePanel.current?.[expanded ? 'expand' : 'collapse']()
      updateState(expanded ? 'open' : 'expanded')
    },
  }
}
