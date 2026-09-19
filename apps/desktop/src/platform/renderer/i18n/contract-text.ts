// An IPC error reaches the screen as its code, and the renderer draws the words (#2130). The wire
// `message` stays English text for a developer reading a log, and no screen shows it once its
// domain owns a catalog.
import { useTranslation } from 'react-i18next'
import { i18n } from '@/platform/renderer/i18n/config'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'

// A lib file that is not itself a rendered component reads the current language this way, as
// `providerPresentation` does: it answers correctly, but subscribes nothing to a language change.
export function contractText(failure: ContractFailure): string {
  switch (failure.type) {
    case 'account.error':
      return i18n.t(`accounts:error.${failure.code}`)
    case 'ticket.error':
      return i18n.t(`tickets:error.${failure.code}`)
  }
}

// A component that draws a failure holds this instead, so it redraws on a language change.
export function useContractText(): (failure: ContractFailure) => string {
  useTranslation(['accounts', 'tickets'])
  return contractText
}
