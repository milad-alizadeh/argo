import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { ConnectionSummary } from '@/domains/tickets/contract/contract'

const STATE_MARK: Record<ConnectionSummary['state'], string> = {
  ready: 'bg-active',
  'account-expired': 'bg-danger',
  'account-revoked': 'bg-danger',
  'account-unreadable': 'bg-danger',
  'account-missing': 'bg-transparent shadow-state-outline',
}

type ConnectionStatusMarkProps = { state: ConnectionSummary['state']; children: ReactNode }

// The dot shows the state; its words follow the label in text, so the state is never a colour alone.
export function ConnectionStatusMark({ state, children }: ConnectionStatusMarkProps) {
  const { t } = useTranslation('tickets')
  return (
    <>
      <span
        aria-hidden="true"
        className={`size-(--size-state-dot) shrink-0 rounded-full ${STATE_MARK[state]}`}
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="sr-only">{t(`connection.state.${state}`)}</span>
    </>
  )
}
