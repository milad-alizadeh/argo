import { FolderGit2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Skeleton } from '../../../components/ui/skeleton'
import { AccountsDialog } from '../../accounts/components/accounts-dialog'
import { useAccountsDialog } from '../../accounts/state/use-accounts-dialog'
import { ConnectSourceFields, ConnectSourceForm } from '../components/connect-source-form'
import { TicketDeck } from '../components/ticket-deck'
import { TicketProblem } from '../components/ticket-problem'
import {
  type TicketsScreenProps,
  type TicketsView,
  useTicketsView,
} from '../hooks/use-tickets-view'

// The skeleton takes the backlog's own geometry, so the rows do not jump when they arrive.
function Loading({ label }: { label: string }) {
  return (
    <div aria-label={label} className="flex h-full min-h-0 flex-col" role="status">
      <span className="sr-only">{label}</span>
      <div className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-(--spacing-shell-inset)">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid max-w-md gap-(--spacing-shell-gutter) p-(--spacing-shell-inset)">
        {[0, 1, 2, 3].map((index) => (
          <div className="flex items-center gap-(--spacing-shell-item)" key={index}>
            <Skeleton className="h-3 w-(--size-ticket-key)" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

function NoProject() {
  const { t } = useTranslation('tickets')
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderGit2 aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('screen.noProject.title')}</EmptyTitle>
        <EmptyDescription>{t('screen.noProject.description')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function Body({ view }: { view: TicketsView }) {
  // The Accounts dialog draws this same form inline, so it stays the one copy on screen.
  const dialogOpen = useAccountsDialog((state) => state.open)
  switch (view.kind) {
    case 'no-project':
      return <NoProject />
    case 'loading':
      return <Loading label={view.label} />
    case 'problem':
      return <TicketProblem {...view} />
    case 'unconnected':
      return dialogOpen ? null : <ConnectSourceForm key={view.projectId} {...view} />
    case 'tickets':
      // A new Project starts with nothing selected, as the connect form starts empty.
      return <TicketDeck key={view.projectId} {...view} />
    default:
      return view satisfies never
  }
}

export function TicketsScreenView() {
  const screen = useTicketsView()
  const view = screen.view
  return (
    <>
      <TicketsScreen {...screen} />
      <AccountsDialog
        connect={
          view.kind === 'unconnected' ? (
            <ConnectSourceFields
              accountId={view.accountId}
              accounts={view.accounts}
              error={view.error}
              onConnectSource={view.onConnectSource}
              onSelectAccount={view.onSelectAccount}
              pending={view.pending}
              sources={view.sources}
            />
          ) : undefined
        }
      />
    </>
  )
}

export function TicketsScreen({ view }: TicketsScreenProps) {
  const { t } = useTranslation('tickets')
  return (
    <main aria-label={t('screen.label')} className="h-full min-h-0 bg-background">
      <Body view={view} />
    </main>
  )
}
