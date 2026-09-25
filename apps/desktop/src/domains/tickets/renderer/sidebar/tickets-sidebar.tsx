import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  openAccountsDialog,
  SignInNotice,
  type SignInNoticeProps,
} from '@/domains/accounts/renderer'
import type { ConnectionSummary } from '@/domains/tickets/contract/contract'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import { useTicketBacklogSidebar } from './ticket-backlog-sidebar-store'
import { TicketsBacklogSidebar } from './tickets-backlog-sidebar'
import { TicketsSidebarAccountFoot } from './tickets-sidebar-account-foot'
import { TicketsSidebarHeader } from './tickets-sidebar-header'

export type TicketsSidebarContentProps = {
  connection: ConnectionSummary | null
  // The open Tickets read so far, with a `+` while more pages remain.
  openCount: string | null
  notice: SignInNoticeProps | null
  onManageAccounts: () => void
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
      <TicketsSidebarAccountFoot connection={connection} onManageAccounts={onManageAccounts} />
    </aside>
  )
}

export function TicketsSidebar() {
  const sidebar = useTicketBacklogSidebar((state) => state.sidebar)
  if (sidebar) {
    return (
      <TicketsBacklogSidebar
        {...sidebar}
        connection={null}
        notice={null}
        now={Date.now()}
        onManageAccounts={openAccountsDialog}
      />
    )
  }
  return (
    <TicketsSidebarContent
      connection={null}
      notice={null}
      onManageAccounts={openAccountsDialog}
      openCount={null}
    />
  )
}
