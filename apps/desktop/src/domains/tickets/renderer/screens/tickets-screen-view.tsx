import { useTranslation } from 'react-i18next'
import { AccountsDialog, useAccountsDialog } from '@/domains/accounts/renderer'
import { AppPageSurface } from '@/platform/renderer/app/components/app-shell'
import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Skeleton } from '@/platform/renderer/components/ui/skeleton'
import { ConnectSourceFields, ConnectSourceForm } from '../connection'
import { TicketDeck } from '../detail'
import { type TicketsScreenProps, type TicketsView, useTicketsView } from '../hooks'
import { TicketProblem } from '../status'

// The skeleton takes the backlog's own geometry, so the rows do not jump when they arrive.
function Loading({ label }: { label: string }) {
  return (
    <div aria-label={label} className="flex h-full min-h-0 flex-col" role="status">
      <span className="sr-only">{label}</span>
      <div className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border px-(--spacing-shell-inset)">
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
    <EmptyState
      description={t('screen.noProject.description')}
      media={<Icon name="repository" />}
      title={t('screen.noProject.title')}
    />
  )
}

function Body({ view }: { view: TicketsView }) {
  // The Accounts dialog draws this same form inline, so it stays the one copy on screen.
  const { open: dialogOpen } = useAccountsDialog()
  switch (view.kind) {
    case 'no-project':
      return (
        <AppPageSurface>
          <NoProject />
        </AppPageSurface>
      )
    case 'loading':
      return (
        <AppPageSurface>
          <Loading label={view.label} />
        </AppPageSurface>
      )
    case 'problem':
      return (
        <AppPageSurface>
          <TicketProblem {...view} />
        </AppPageSurface>
      )
    case 'unconnected':
      return dialogOpen ? null : (
        <AppPageSurface>
          <ConnectSourceForm key={view.projectId} {...view} />
        </AppPageSurface>
      )
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
    <main aria-label={t('screen.label')} className="screen-layout">
      <Body view={view} />
    </main>
  )
}
