import { useLayoutEffect, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { readCssSize } from '../lib/read-css-size'

type InspectorState = 'open' | 'collapsed' | 'expanded'

// CSS size tokens, read at render so a token change moves the split.
export type InspectorSizes = { inspector: string; inspectorMin: string; workspaceMin: string }

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
  const [isInspectorReady, setIsInspectorReady] = useState(!defaultCollapsed)
  const updateState = (next: InspectorState) => {
    stateRef.current = next
    setState(next)
  }

  const open = () => {
    setIsInspectorReady(false)
    inspectorPanel.current?.expand()
    inspectorPanel.current?.resize(readCssSize(sizes.inspector))
    updateState('open')
  }
  const opener = useRef(open)
  opener.current = open
  useLayoutEffect(() => {
    if (reveal != null && stateRef.current === 'collapsed') opener.current()
  }, [reveal])
  useLayoutEffect(() => {
    if (state === 'collapsed') return
    const element = inspectorElement.current
    if (element === null) return
    const minimumWidth = readCssSize(sizes.inspectorMin)
    const showWhenSized = () => {
      if (element.getBoundingClientRect().width >= minimumWidth) setIsInspectorReady(true)
    }
    const observer = new ResizeObserver(showWhenSized)
    observer.observe(element)
    showWhenSized()
    return () => observer.disconnect()
  }, [sizes.inspectorMin, state])

  return {
    inspectorElement,
    inspectorPanel,
    workspacePanel,
    state,
    isInspectorReady,
    synchronizeCollapsed: () => {
      if (inspectorPanel.current?.isCollapsed()) {
        setIsInspectorReady(false)
        updateState('collapsed')
      } else updateState(stateRef.current === 'expanded' ? 'expanded' : 'open')
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
