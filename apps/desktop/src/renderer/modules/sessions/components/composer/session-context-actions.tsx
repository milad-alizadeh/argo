import { GitFork, Minimize2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'

export function SessionContextActions({
  canCompact,
  canHandoff,
  isCompacting,
  isHandingOff,
  onCompact,
  onHandoff,
}: {
  canCompact: boolean
  canHandoff: boolean
  isCompacting: boolean
  isHandingOff: boolean | undefined
  onCompact: (() => Promise<boolean>) | undefined
  onHandoff: (() => Promise<boolean>) | undefined
}) {
  const actions = [
    {
      accessibleName: 'Compact context',
      icon: <Minimize2 />,
      label: 'Compact',
      onClick: onCompact,
      disabled: !canCompact || isCompacting,
      variant: 'secondary' as const,
    },
    {
      accessibleName: 'Handoff Session',
      icon: <GitFork />,
      label: 'Handoff',
      onClick: onHandoff,
      disabled: !canHandoff || isHandingOff,
      variant: 'outline' as const,
    },
  ]
  return (
    <>
      <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-border/60 pl-2 @[23rem]:hidden">
        {actions.map((action) => (
          <Button
            aria-label={action.accessibleName}
            disabled={action.disabled}
            key={action.label}
            onClick={() => void action.onClick?.()}
            size="icon-sm"
            type="button"
            variant={action.variant}
          >
            {action.icon}
          </Button>
        ))}
      </div>
      <div className="ml-auto hidden shrink-0 items-center gap-1 border-l border-border/60 pl-4 @[23rem]:flex">
        {actions.map((action) => (
          <Button
            aria-label={action.accessibleName}
            disabled={action.disabled}
            key={action.label}
            onClick={() => void action.onClick?.()}
            size="sm"
            type="button"
            variant={action.variant}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </>
  )
}
