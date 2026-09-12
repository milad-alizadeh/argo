import { Maximize2Icon, PanelRightIcon } from 'lucide-react'
import type { Session } from '../types'
import { AgentsRail } from './AgentsRail'

export function SessionInspector({
  session,
  onCollapse,
}: {
  session: Session
  onCollapse: () => void
}) {
  return (
    <aside
      aria-label="Session inspector"
      className="session-page__inspector"
      data-component="SessionInspector"
    >
      <header className="session-page__inspector-head" data-component="InspectorHead">
        <span className="flex-1" />
        <button aria-label="Expand inspector" className="session-page__icon-button" type="button">
          <Maximize2Icon aria-hidden="true" />
        </button>
        <button
          aria-label="Hide inspector"
          className="session-page__icon-button"
          onClick={onCollapse}
          type="button"
        >
          <PanelRightIcon aria-hidden="true" />
        </button>
      </header>
      <AgentsRail session={session} />
    </aside>
  )
}
