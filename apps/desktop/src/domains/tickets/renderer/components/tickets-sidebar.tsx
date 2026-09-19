import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SignInNotice,
  type SignInNoticeProps,
} from '@/domains/accounts/renderer/components/sign-in-notice'
import { useAccounts, useDismissNotice } from '@/domains/accounts/renderer/hooks/use-accounts'
import { providerPresentation } from '@/domains/accounts/renderer/lib/providers'
import { openAccountsDialog } from '@/domains/accounts/renderer/state/use-accounts-dialog'
import { useSelectedProject } from '@/domains/projects/renderer/hooks/use-selected-project'
import type { ConnectionSummary } from '@/domains/tickets/contract/contract'
import { ConnectionStatusMark } from '@/domains/tickets/renderer/components/connection-status-mark'
import { TicketsSidebarHeader } from '@/domains/tickets/renderer/components/tickets-sidebar-header'
import { useConnection, useTicketList } from '@/domains/tickets/renderer/hooks/use-tickets'
import { uniqueTickets } from '@/domains/tickets/renderer/lib/backlog'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'

export type TicketsSidebarContentProps = {
  connection: ConnectionSummary | null
  // The open Tickets read so far, with a `+` while more pages remain.
  openCount: string | null
  notice: SignInNoticeProps | null
  onManageAccounts: () => void
}

type AccountFootProps = Pick<TicketsSidebarContentProps, 'connection' | 'onManageAccounts'>

// The foot names the Account this Project reads through; with no Connection it opens the Accounts.
function AccountFoot({ connection, onManageAccounts }: AccountFootProps) {
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

export function TicketsSidebarContent({
  connection,
  openCount,
  notice,
  onManageAccounts,
}: TicketsSidebarContentProps) {
  const { t } = useTranslation('tickets')
  const sidebar = useRef<HTMLElement>(null)
  // Dismissing the notice removes the control that dismissed it.
  useFocusRescue(sidebar, notice === null)
  return (
    <aside
      aria-label={t('sidebar.label')}
      className="flex h-full min-h-0 flex-col bg-sidebar"
      ref={sidebar}
    >
      <TicketsSidebarHeader connection={connection} />
      <nav
        aria-label={t('sidebar.views')}
        className="min-h-0 flex-1 overflow-y-auto p-(--spacing-shell-item)"
      >
        <div
          aria-current="page"
          className="flex items-center gap-(--spacing-shell-item) rounded-row bg-muted px-(--spacing-shell-item) py-(--spacing-shell-icon) type-body"
        >
          <span className="flex-1">{t('sidebar.allOpen')}</span>
          {openCount === null ? null : (
            <span className="font-mono type-meta text-faint">{openCount}</span>
          )}
        </div>
      </nav>
      {notice ? <SignInNotice {...notice} /> : null}
      <AccountFoot connection={connection} onManageAccounts={onManageAccounts} />
    </aside>
  )
}

export function TicketsSidebar() {
  const projectId = useSelectedProject()?.id ?? null
  const connection = useConnection(projectId).data ?? null
  const list = useTicketList(projectId, connection)
  const dismiss = useDismissNotice()
  const showNotice = useAccounts().data?.notice ?? false
  const opened = list.data ? uniqueTickets(list.data.pages).length : null
  return (
    <TicketsSidebarContent
      connection={connection}
      notice={
        showNotice
          ? { onConnect: openAccountsDialog, onDismiss: () => dismiss.mutate(undefined) }
          : null
      }
      onManageAccounts={openAccountsDialog}
      openCount={opened === null ? null : `${opened}${list.hasNextPage ? '+' : ''}`}
    />
  )
}
