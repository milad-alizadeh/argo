import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SignInNotice,
  type SignInNoticeProps,
  useOpenAccountsDialog,
} from '@/domains/accounts/renderer'
import type { ConnectionSummary } from '@/domains/tickets/contract/contract'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import { useTicketsView } from '../hooks/use-tickets-view'
import type { TicketWorkPath } from './ticket-work-path'
import { ticketWorkPath } from './ticket-work-path'
import { TicketWorkPathSidebar } from './ticket-work-path-sidebar'
import { TicketsSidebarAccountFoot } from './tickets-sidebar-account-foot'
import { TicketsSidebarHeader } from './tickets-sidebar-header'

export type TicketsSidebarContentProps = {
  connection: ConnectionSummary | null
  // The open Tickets read so far, with a `+` while more pages remain.
  openCount: string | null
  notice: SignInNoticeProps | null
  onManageAccounts: () => void
  workPath?: TicketWorkPath | null
  onSelectTicket?: (key: string) => void
}

export function TicketsSidebarContent({
  connection,
  openCount,
  notice,
  onManageAccounts,
  workPath = null,
  onSelectTicket = () => {},
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav aria-label={t('sidebar.views')} className="p-(--spacing-shell-item)">
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
        {workPath ? (
          <div className="border-t border-border/60 py-(--spacing-shell-section)">
            <TicketWorkPathSidebar onSelect={onSelectTicket} path={workPath} />
          </div>
        ) : null}
      </div>
      {notice ? <SignInNotice {...notice} /> : null}
      <TicketsSidebarAccountFoot connection={connection} onManageAccounts={onManageAccounts} />
    </aside>
  )
}

export function TicketsSidebar() {
  const { view } = useTicketsView()
  const planning =
    view.kind === 'tickets'
      ? { path: ticketWorkPath(view.backlog.tickets), onSelect: view.onSelect }
      : null
  const openAccountsDialog = useOpenAccountsDialog()
  return (
    <TicketsSidebarContent
      connection={null}
      notice={null}
      onManageAccounts={openAccountsDialog}
      onSelectTicket={planning?.onSelect}
      openCount={null}
      workPath={planning?.path}
    />
  )
}
