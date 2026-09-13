import { useRef } from 'react'

import type { ConnectionSummary } from '@/core/tickets/contract'
import { useFocusRescue } from '../../../lib/focus-rescue'
import { SignInNotice, type SignInNoticeProps } from '../../accounts/components/SignInNotice'
import { useAccounts, useDismissNotice } from '../../accounts/hooks/useAccounts'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import { useSelectedProject } from '../../projects/hooks/useSelectedProject'
import { useConnection, useTicketList } from '../hooks/useTickets'
import { uniqueTickets } from '../lib/backlog'
import { ConnectionStatusMark } from './ConnectionStatusMark'
import { TicketsSidebarHeader } from './TicketsSidebarHeader'

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
  return (
    <footer className="shrink-0 border-t border-border/60 p-(--spacing-shell-item)">
      <button
        className="flex w-full items-center gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left type-meta text-muted-foreground hover:bg-muted"
        onClick={onManageAccounts}
        type="button"
      >
        {connection ? (
          <ConnectionStatusMark state={connection.state}>
            GitHub · {connection.login ?? 'no Account'}
          </ConnectionStatusMark>
        ) : (
          <span className="min-w-0 flex-1 truncate">GitHub Accounts</span>
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
  const sidebar = useRef<HTMLElement>(null)
  // Dismissing the notice removes the control that dismissed it.
  useFocusRescue(sidebar, notice === null)
  return (
    <aside
      aria-label="Tickets sidebar"
      className="flex h-full min-h-0 flex-col bg-sidebar"
      ref={sidebar}
    >
      <TicketsSidebarHeader scope={connection?.scope ?? null} />
      <nav
        aria-label="Ticket views"
        className="min-h-0 flex-1 overflow-y-auto p-(--spacing-shell-item)"
      >
        <h3 className="px-(--spacing-shell-item) py-(--spacing-shell-icon) type-label text-muted-foreground">
          Backlog
        </h3>
        <div
          aria-current="page"
          className="flex items-center gap-(--spacing-shell-item) rounded-row bg-muted px-(--spacing-shell-item) py-(--spacing-shell-icon) type-body"
        >
          <span className="flex-1">All open</span>
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
