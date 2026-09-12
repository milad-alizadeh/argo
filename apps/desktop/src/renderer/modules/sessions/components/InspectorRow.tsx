import type { ReactNode } from 'react'
import type { SessionStatus } from '@/core/sessions/models'
import { SessionStateDot } from './SessionStatus'

export function InspectorRow({
  children,
  status,
  monospace = false,
  outlined = false,
}: {
  children: ReactNode
  status: SessionStatus
  monospace?: boolean
  outlined?: boolean
}) {
  return (
    <li className="session-page__inspector-row" data-component="InspectorRow">
      <span className={outlined ? 'session-page__outlined-dot' : undefined}>
        <SessionStateDot status={status} />
      </span>
      <span className={`truncate ${monospace ? 'font-mono' : ''}`}>{children}</span>
    </li>
  )
}
