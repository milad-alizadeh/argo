import type { BindingSummary } from '@/core/tickets/contract'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import { useSelectedProject } from '../../projects/state/ProjectsContext'
import { useBinding, useTicketList } from '../hooks/useTickets'

const STATE_MARKS: Record<BindingSummary['state'], { mark: string; text: string }> = {
  ready: { mark: 'bg-active', text: 'Connected' },
  'account-revoked': { mark: 'bg-danger', text: 'Access revoked' },
  'account-unreadable': { mark: 'bg-danger', text: 'Sign-in unreadable' },
  'account-missing': { mark: 'bg-transparent shadow-state-outline', text: 'Disconnected' },
}

export type TicketsSidebarContentProps = {
  binding: BindingSummary | null
  openCount: number | null
  onManageAccounts: () => void
}

// The foot names the Account this Project reads through; with no Binding it opens the Accounts.
function AccountFoot({ binding, onManageAccounts }: Omit<TicketsSidebarContentProps, 'openCount'>) {
  const state = binding ? STATE_MARKS[binding.state] : null
  return (
    <footer className="shrink-0 border-t border-border/60 p-(--spacing-shell-item)">
      <button
        className="flex w-full items-center gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left type-meta text-muted-foreground hover:bg-muted"
        onClick={onManageAccounts}
        type="button"
      >
        {state ? (
          <span
            aria-hidden="true"
            className={`size-(--size-state-dot) shrink-0 rounded-full ${state.mark}`}
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          {binding ? `GitHub · ${binding.login ?? 'no Account'}` : 'GitHub Accounts'}
        </span>
        {state ? <span className="sr-only">{state.text}</span> : null}
      </button>
    </footer>
  )
}

export function TicketsSidebarContent({
  binding,
  openCount,
  onManageAccounts,
}: TicketsSidebarContentProps) {
  return (
    <aside aria-label="Tickets sidebar" className="flex h-full min-h-0 flex-col bg-sidebar">
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-(--spacing-shell-inset)">
        <h2 className="type-heading flex-1">Tickets</h2>
      </header>
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
      <AccountFoot binding={binding} onManageAccounts={onManageAccounts} />
    </aside>
  )
}

export function TicketsSidebar() {
  const projectId = useSelectedProject()?.id ?? null
  const binding = useBinding(projectId).data ?? null
  const list = useTicketList(projectId, binding)
  return (
    <TicketsSidebarContent
      binding={binding}
      onManageAccounts={openAccountsDialog}
      openCount={list.data?.length ?? null}
    />
  )
}
