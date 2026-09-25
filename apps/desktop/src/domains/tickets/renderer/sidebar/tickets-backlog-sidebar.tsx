import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { SignInNotice, type SignInNoticeProps } from '@/domains/accounts/renderer'
import type { ConnectionSummary } from '@/domains/tickets/contract/contract'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import type { Backlog } from '../lib/backlog'
import { TicketList } from './ticket-list'
import { TicketsSidebarAccountFoot } from './tickets-sidebar-account-foot'
import { TicketsSidebarHeader } from './tickets-sidebar-header'

export type TicketsBacklogSidebarProps = {
  backlog: Backlog
  connection: ConnectionSummary | null
  notice: SignInNoticeProps | null
  onManageAccounts: () => void
  now: number
  onSelect: (key: string) => void
  selectedKey: string | null
}

// The shell owns this narrower backlog. The Ticket detail keeps the workspace, where long titles,
// body copy and relations have room; this uses the same row component as the relation popovers.
export function TicketsBacklogSidebar({
  backlog,
  selectedKey,
  onSelect,
  now,
  connection,
  notice,
  onManageAccounts,
}: TicketsBacklogSidebarProps) {
  const { t } = useTranslation('tickets')
  const sidebar = useRef<HTMLElement>(null)
  useFocusRescue(sidebar, notice === null)
  return (
    <aside
      aria-label={t('sidebar.label')}
      className="flex h-full min-h-0 flex-col bg-sidebar"
      ref={sidebar}
    >
      <TicketsSidebarHeader connection={connection} />
      <TicketList
        backlog={backlog}
        now={now}
        onSelect={onSelect}
        placement="sidebar"
        selectedKey={selectedKey}
      />
      {notice ? <SignInNotice {...notice} /> : null}
      <TicketsSidebarAccountFoot connection={connection} onManageAccounts={onManageAccounts} />
    </aside>
  )
}
