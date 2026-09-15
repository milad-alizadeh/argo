import { ArrowDown } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'

export function FeedJumpToLatest({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={label}
              className="feed__jump-to-latest"
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
