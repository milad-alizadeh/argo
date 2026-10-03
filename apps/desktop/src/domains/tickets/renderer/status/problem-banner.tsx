import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import type { TicketProblemProps } from '../lib'

// A failed read drawn above rows or a Ticket that are still shown from SQLite.
export function ProblemBanner({ icon, title, description, alert, actions }: TicketProblemProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-(--spacing-shell-item) border-b border-border px-(--spacing-shell-inset) py-(--spacing-shell-item)"
      role={alert ? 'alert' : undefined}
    >
      <span className="text-status-danger">
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-body">{title}</p>
        <p className="type-meta text-muted-foreground">{description}</p>
      </div>
      {actions.map((action) => (
        <Button
          key={action.label}
          onClick={action.onClick}
          size="sm"
          variant={action.primary ? 'default' : 'ghost'}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}
