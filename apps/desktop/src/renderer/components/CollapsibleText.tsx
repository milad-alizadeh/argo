import { ChevronRightIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/renderer/components/ui/collapsible'
import { cn } from '@/renderer/lib/utils'

export function CollapsibleText({
  content,
  contentVariant = 'line',
  defaultOpen = false,
  icon: Icon,
  onOpenChange,
  open,
  title,
  titleType = 'type-body',
}: {
  content: ReactNode
  contentVariant?: 'line' | 'plain'
  defaultOpen?: boolean
  icon: LucideIcon
  onOpenChange?: (open: boolean) => void
  open?: boolean
  title: ReactNode
  // The typography role the trigger takes. A fold that sits inside a denser list asks for that
  // list's role, so its title does not read as the loudest thing on the panel.
  titleType?: string
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-0" onOpenChange={onOpenChange} open={open}>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center gap-2 py-1 text-muted-foreground transition-colors hover:text-foreground',
          titleType,
        )}
      >
        <Icon className="!size-(--size-icon-inline) shrink-0" />
        <span className="min-w-0 truncate">{title}</span>
        <ChevronRightIcon className="!size-(--size-icon-inline) shrink-0 transition-transform group-data-[panel-open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="type-body text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2">
        <div
          className={
            contentVariant === 'line'
              ? 'mt-2 ml-1.5 space-y-2 border-muted border-l-2 pl-4'
              : 'mt-2 space-y-2 pl-6'
          }
        >
          {content}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
