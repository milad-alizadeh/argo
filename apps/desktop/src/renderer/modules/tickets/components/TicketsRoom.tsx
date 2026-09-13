import { FolderGit2 } from 'lucide-react'
import { useRef } from 'react'

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty'
import { Skeleton } from '../../../components/ui/skeleton'
import { useFocusRescue } from '../../../lib/focus-rescue'
import { SignInNotice, type SignInNoticeProps } from '../../accounts/components/SignInNotice'
import { BindForm, type BindFormProps } from './BindForm'
import { BindingProblem, type BindingProblemProps } from './BindingProblem'
import { TicketDeck, type TicketDeckProps } from './TicketDeck'
import { TicketFailure, type TicketFailureProps } from './TicketFailure'

// Everything the Tickets room can show, resolved by the page before anything draws.
export type TicketsView =
  | { kind: 'no-project' }
  | { kind: 'loading'; label: string }
  | ({ kind: 'failure' } & TicketFailureProps)
  | ({ kind: 'unbound'; projectId: string } & BindFormProps)
  | ({ kind: 'binding-problem' } & BindingProblemProps)
  | ({ kind: 'tickets'; projectId: string } & TicketDeckProps)

export type TicketsRoomProps = { view: TicketsView; notice: SignInNoticeProps | null }

function Loading({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="grid gap-(--spacing-shell-inset) p-(--spacing-shell-region)"
      role="status"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <Skeleton className="h-4 w-2/3" key={index} />
      ))}
    </div>
  )
}

function NoProject() {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderGit2 aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Select a Project to read its Tickets</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

const centred = 'grid h-full place-items-center p-(--spacing-shell-region)'

function Body({ view }: { view: TicketsView }) {
  switch (view.kind) {
    case 'no-project':
      return <NoProject />
    case 'loading':
      return <Loading label={view.label} />
    case 'failure':
      return (
        <div className="p-(--spacing-shell-inset)">
          <TicketFailure {...view} />
        </div>
      )
    case 'unbound':
      return (
        <div className={centred}>
          <BindForm key={view.projectId} {...view} />
        </div>
      )
    case 'binding-problem':
      return (
        <div className={centred}>
          <BindingProblem {...view} />
        </div>
      )
    case 'tickets':
      // A new Project starts with nothing selected, as the bind form starts empty.
      return <TicketDeck key={view.projectId} {...view} />
    default:
      return view satisfies never
  }
}

export function TicketsRoom({ view, notice }: TicketsRoomProps) {
  const room = useRef<HTMLElement>(null)
  // Dismissing the notice removes the control that dismissed it.
  useFocusRescue(room, notice === null)
  return (
    <main aria-label="Tickets" className="flex h-full min-h-0 flex-col bg-background" ref={room}>
      {notice ? (
        <div className="shrink-0 p-(--spacing-shell-inset) pb-0">
          <SignInNotice {...notice} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <Body view={view} />
      </div>
    </main>
  )
}
