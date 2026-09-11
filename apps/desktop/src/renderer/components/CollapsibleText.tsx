import { ChevronDownIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/renderer/components/ui/collapsible'

export function CollapsibleText({
  content,
  defaultOpen = false,
  icon: Icon,
  title,
}: {
  content: ReactNode
  defaultOpen?: boolean
  icon: LucideIcon
  title: ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-0">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 py-1 type-label text-muted-foreground transition-colors hover:text-foreground">
        <Icon className="!size-(--size-icon-inline) shrink-0" />
        <span className="min-w-0 truncate">{title}</span>
        <ChevronDownIcon className="!size-(--size-icon-inline) shrink-0 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2">
        <div className="mt-2 ml-1.5 space-y-2 border-muted border-l-2 pl-4">{content}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
