import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/platform/renderer/components/ui/collapsible'

const CONTENT_VARIANT_CLASS = {
  line: 'mt-2 ml-1.5 space-y-2 border-muted border-l-2 pl-4',
  plain: 'mt-2 space-y-2 pl-6',
  flush: 'mt-2 space-y-2',
} as const

export function CollapsibleText({
  content,
  contentVariant = 'line',
  defaultOpen = false,
  icon,
  onOpenChange,
  open,
  title,
}: {
  content: ReactNode
  contentVariant?: 'line' | 'plain' | 'flush'
  defaultOpen?: boolean
  icon: IconName
  onOpenChange?: (open: boolean) => void
  open?: boolean
  title: ReactNode
}) {
  const state = open === undefined ? { defaultOpen } : { open }

  return (
    <Collapsible {...state} className="mb-0" onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 py-1 type-body text-muted-foreground transition-colors hover:text-foreground">
        <Icon className="!size-(--size-icon-inline) shrink-0" name={icon} />
        <span className="min-w-0 truncate">{title}</span>
        <Icon
          name="chevron-right"
          className="!size-(--size-icon-inline) shrink-0 transition-transform group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden type-body text-popover-foreground outline-none transition-[height,opacity,transform] duration-200 ease-out data-[starting-style]:h-0 data-[starting-style]:-translate-y-2 data-[starting-style]:opacity-0 data-[ending-style]:h-0 data-[ending-style]:-translate-y-2 data-[ending-style]:opacity-0 motion-reduce:transition-none">
        <div className={CONTENT_VARIANT_CLASS[contentVariant]}>{content}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
