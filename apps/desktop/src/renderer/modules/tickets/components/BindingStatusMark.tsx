import type { ReactNode } from 'react'

import type { BindingSummary } from '@/core/tickets/contract'

const STATE_MARKS: Record<BindingSummary['state'], { mark: string; text: string }> = {
  ready: { mark: 'bg-active', text: 'Connected' },
  'account-revoked': { mark: 'bg-danger', text: 'Access revoked' },
  'account-unreadable': { mark: 'bg-danger', text: 'Sign-in unreadable' },
  'account-missing': { mark: 'bg-transparent shadow-state-outline', text: 'Disconnected' },
}

type BindingStatusMarkProps = { state: BindingSummary['state']; children: ReactNode }

// The dot shows the state; its words follow the label in text, so the state is never a colour alone.
export function BindingStatusMark({ state, children }: BindingStatusMarkProps) {
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
