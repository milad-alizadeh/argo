import { useTranslation } from 'react-i18next'
import { providerPresentation } from '@/domains/accounts/renderer'
import type { ConnectionSummary } from '@/domains/tickets/contract/contract'
import { ConnectionStatusMark } from '../connection/connection-status-mark'

export type TicketsSidebarAccountFootProps = {
  connection: ConnectionSummary | null
  onManageAccounts: () => void
}

// The foot names the Account this Project reads through; with no Connection it opens the Accounts.
export function TicketsSidebarAccountFoot({
  connection,
  onManageAccounts,
}: TicketsSidebarAccountFootProps) {
  const { t } = useTranslation('tickets')
  return (
    <footer className="shrink-0 border-t border-border/60 p-(--spacing-shell-item)">
      <button
        className="flex w-full items-center gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left type-meta text-muted-foreground hover:bg-muted"
        onClick={onManageAccounts}
        type="button"
      >
        {connection ? (
          <ConnectionStatusMark state={connection.state}>
            {t('sidebar.readThrough', {
              name: providerPresentation(connection.provider).name,
              login: connection.login ?? t('sidebar.noAccount'),
            })}
          </ConnectionStatusMark>
        ) : (
          <span className="min-w-0 flex-1 truncate">{t('sidebar.accounts')}</span>
        )}
      </button>
    </footer>
  )
}
