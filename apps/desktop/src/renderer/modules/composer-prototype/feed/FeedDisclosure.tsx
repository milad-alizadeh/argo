import { ChevronDownIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Task, TaskContent, TaskTrigger } from '@/components/ai-elements/task'

export function FeedDisclosure({
  children,
  defaultOpen = false,
  icon: Icon,
  label,
}: {
  children: ReactNode
  defaultOpen?: boolean
  icon: LucideIcon
  label: ReactNode
}) {
  return (
    <Task defaultOpen={defaultOpen} className="mb-0">
      <TaskTrigger
        title={typeof label === 'string' ? label : 'Skill invoked'}
        className="flex w-full items-center gap-2 py-1 text-(length:--text-control) text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon className="!size-(--size-icon-inline)" />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDownIcon className="!size-(--size-icon-inline) transition-transform group-data-[state=open]:rotate-180" />
      </TaskTrigger>
      <TaskContent className="[&>div]:mt-2 [&>div]:ml-1.5 [&>div]:space-y-2">
        {children}
      </TaskContent>
    </Task>
  )
}
