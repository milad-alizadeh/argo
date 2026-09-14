// An IPC error reaches the screen as its code, and the renderer draws the words (#2130). The wire
// `message` stays English text for a developer reading a log, and no screen shows it once its
// domain owns a catalog.
import { useTranslation } from 'react-i18next'
import type { ContractFailure } from '../lib/query-client'

// A domain that has not moved its copy yet still draws the wire text. Each module's own pull
// request turns one of these branches into a catalog read, and the last one closes the fallback.
export function useContractText(): (failure: ContractFailure) => string {
  const { t } = useTranslation(['accounts'])
  return (failure) => {
    switch (failure.type) {
      case 'account.error':
        return t(`accounts:error.${failure.code}`)
      case 'ticket.error':
        return failure.message
    }
  }
}
