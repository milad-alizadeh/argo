import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import type { TicketProblemProps } from '../lib'

export function TicketProblem({ icon, title, description, alert, actions }: TicketProblemProps) {
  return (
    <EmptyState
      actionClassName="flex-row justify-center"
      action={actions.map((action) => (
        <Button
          key={action.label}
          onClick={action.onClick}
          variant={action.primary ? 'default' : 'ghost'}
        >
          {action.label}
        </Button>
      ))}
      description={description}
      media={<Icon name={icon} />}
      mediaClassName={alert ? 'text-status-danger' : undefined}
      role={alert ? 'alert' : undefined}
      title={title}
    />
  )
}
