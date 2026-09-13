import { FolderGit2 } from 'lucide-react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Skeleton } from '../../../components/ui/skeleton'
import { AccountsDialog } from '../../accounts/components/AccountsDialog'
import { BindForm } from '../components/BindForm'
import { TicketDeck } from '../components/TicketDeck'
import { TicketProblem } from '../components/TicketProblem'
import { type TicketsScreenProps, type TicketsView, useTicketsView } from '../hooks/useTicketsView'

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
            <Skeleton className="h-3 w-(--size-ticket-number)" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

function NoProject() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderGit2 aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Select a Project to read its Tickets</EmptyTitle>
        <EmptyDescription>
          A Project reads its Tickets from the GitHub repository it is bound to.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function Body({ view }: { view: TicketsView }) {
  switch (view.kind) {
    case 'no-project':
      return <NoProject />
    case 'loading':
      return <Loading label={view.label} />
    case 'problem':
      return <TicketProblem {...view} />
    case 'unbound':
      return <BindForm key={view.projectId} {...view} />
    case 'tickets':
      // A new Project starts with nothing selected, as the bind form starts empty.
      return <TicketDeck key={view.projectId} {...view} />
    default:
      return view satisfies never
  }
}

export function TicketsScreenView() {
  return (
    <>
      <TicketsScreen {...useTicketsView()} />
      <AccountsDialog />
    </>
  )
}

export function TicketsScreen({ view }: TicketsScreenProps) {
  return (
    <main aria-label="Tickets" className="h-full min-h-0 bg-background">
      <Body view={view} />
    </main>
  )
}
