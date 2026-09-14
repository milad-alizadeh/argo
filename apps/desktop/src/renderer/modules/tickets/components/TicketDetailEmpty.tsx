import { Ticket } from 'lucide-react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'

export function TicketDetailEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Ticket aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Select a Ticket</EmptyTitle>
        <EmptyDescription>Its description, children and blockers show here.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
