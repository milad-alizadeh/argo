import type { TicketProblemProps } from '@/domains/tickets/renderer/lib/problems'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'

export function TicketProblem({ icon, title, description, alert, actions }: TicketProblemProps) {
  return (
    <Empty className="h-full" role={alert ? 'alert' : undefined}>
      <EmptyHeader>
        <EmptyMedia className={alert ? 'text-danger' : undefined} variant="icon">
          <Icon name={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        {actions.map((action) => (
          <Button
            key={action.label}
            onClick={action.onClick}
            variant={action.primary ? 'default' : 'ghost'}
          >
            {action.label}
          </Button>
        ))}
      </EmptyContent>
    </Empty>
  )
}
