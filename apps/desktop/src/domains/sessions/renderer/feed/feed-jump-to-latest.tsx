import { ArrowDown } from 'lucide-react'
import { Button } from '../../../../platform/renderer/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../platform/renderer/components/ui/tooltip'

export function FeedJumpToLatest({
  className,
  label,
  onClick,
}: {
  className?: string
  label: string
  onClick: () => void
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={label}
              className={`rounded-full ${className ?? ''}`}
              onClick={onClick}
              size="icon"
              type="button"
              variant="secondary"
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
