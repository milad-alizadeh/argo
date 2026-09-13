import { useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { readCssSize } from '../../../lib/read-css-size'
import type { SessionInspectorState } from '../screens/SessionShell'

export function useSessionInspector() {
  const inspectorPanelRef = usePanelRef()
  const workspacePanelRef = usePanelRef()
  const [inspectorState, setInspectorState] = useState<SessionInspectorState>('open')

  const synchronizeInspectorCollapsed = () => {
    if (inspectorPanelRef.current?.isCollapsed()) {
      setInspectorState('collapsed')
      return
    }
    setInspectorState((state) => (state === 'expanded' ? state : 'open'))
  }

  const toggleInspector = () => {
    if (inspectorState === 'collapsed') {
      inspectorPanelRef.current?.expand()
      inspectorPanelRef.current?.resize(readCssSize('--size-session-inspector'))
      setInspectorState('open')
    } else {
      if (inspectorState === 'expanded') workspacePanelRef.current?.expand()
      inspectorPanelRef.current?.collapse()
      setInspectorState('collapsed')
    }
  }

  const toggleInspectorExpanded = () => {
    const expanded = inspectorState === 'expanded'
    workspacePanelRef.current?.[expanded ? 'expand' : 'collapse']()
    setInspectorState(expanded ? 'open' : 'expanded')
  }

  return {
    inspectorPanelRef,
    workspacePanelRef,
    inspectorState,
    synchronizeInspectorCollapsed,
    toggleInspector,
    toggleInspectorExpanded,
  }
}
