import type { ReactNode } from 'react'

import type { ConnectionSummary } from '@/core/tickets/contract'

const STATE_MARKS: Record<ConnectionSummary['state'], { mark: string; text: string }> = {
  ready: { mark: 'bg-active', text: 'Connected' },
  'account-expired': { mark: 'bg-warn', text: 'Sign-in expired' },
  'account-revoked': { mark: 'bg-danger', text: 'Access revoked' },
  'account-unreadable': { mark: 'bg-danger', text: 'Sign-in unreadable' },
  'account-missing': { mark: 'bg-transparent shadow-state-outline', text: 'Disconnected' },
}

type ConnectionStatusMarkProps = { state: ConnectionSummary['state']; children: ReactNode }

// The dot shows the state; its words follow the label in text, so the state is never a colour alone.
export function ConnectionStatusMark({ state, children }: ConnectionStatusMarkProps) {
  const { mark, text } = STATE_MARKS[state]
  return (
    <>
      <span
        aria-hidden="true"
        className={`size-(--size-state-dot) shrink-0 rounded-full ${mark}`}
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="sr-only">{text}</span>
    </>
  )
}
