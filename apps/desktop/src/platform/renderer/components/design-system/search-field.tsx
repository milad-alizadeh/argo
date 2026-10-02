import { Command as CommandPrimitive } from 'cmdk'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { Icon } from '../icon/icon'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'

const searchGroupClassName =
  'min-w-0 flex-1 border-0 bg-transparent shadow-none focus-within:bg-muted dark:bg-transparent dark:focus-within:bg-muted'

export function SearchField(props: ComponentProps<typeof InputGroupInput>) {
  return (
    <InputGroup className={searchGroupClassName}>
      <InputGroupAddon>
        <Icon className="text-muted-foreground" name="search" />
      </InputGroupAddon>
      <InputGroupInput {...props} />
    </InputGroup>
  )
}

export function CommandSearchField({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="p-1">
      <InputGroup className={searchGroupClassName}>
        <InputGroupAddon>
          <Icon className="text-muted-foreground" name="search" />
        </InputGroupAddon>
        <CommandPrimitive.Input
          data-slot="input-group-control"
          className={cn(
            'w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
      </InputGroup>
    </div>
  )
}
