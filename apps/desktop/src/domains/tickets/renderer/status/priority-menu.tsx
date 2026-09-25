import { useTranslation } from 'react-i18next'

import type { TicketPriority } from '@/domains/tickets/contract/contract'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { NO_PRIORITY_LABEL, PRIORITY_OPTIONS, PriorityIcon, priorityName } from './ticket-status'

export type PriorityMenuProps = {
  priority: TicketPriority | null
  named: boolean
  metadata?: boolean
  onChange: (priority: TicketPriority | null) => void
}

const NAMED_INSET = '-ml-[calc(--spacing(2)+var(--size-border))]'
const namedInset = (named: boolean, metadata: boolean) => {
  if (!named) return ''
  return metadata ? '' : NAMED_INSET
}
const priorityValue = (priority: TicketPriority | null) =>
  priority ? String(priority.level) : 'none'

export function PriorityMenu({ priority, named, metadata = false, onChange }: PriorityMenuProps) {
  const { t } = useTranslation('tickets')
  const choose = (value: unknown) => {
    const next = PRIORITY_OPTIONS.find((option) => priorityValue(option) === value)
    if (next !== undefined && priorityValue(next) !== priorityValue(priority)) onChange(next)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('priority.trigger', { priority: priorityName(priority) })}
        render={
          metadata ? (
            <Badge
              className={`relative z-10 @3xl:bg-transparent @3xl:text-muted-foreground ${namedInset(named, metadata)}`}
              render={<button type="button" />}
              size="default"
              variant="secondary"
            />
          ) : (
            <Button
              className={`relative z-10 shrink-0 type-meta text-muted-foreground ${namedInset(named, metadata)}`}
              size={named ? 'xs' : 'icon-xs'}
              variant="ghost"
            />
          )
        }
      >
        <PriorityIcon priority={priority} />
        {named ? priorityName(priority) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup onValueChange={choose} value={priorityValue(priority)}>
          {PRIORITY_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={priorityValue(option)} value={priorityValue(option)}>
              <PriorityIcon priority={option} />
              {option?.label ?? NO_PRIORITY_LABEL}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
