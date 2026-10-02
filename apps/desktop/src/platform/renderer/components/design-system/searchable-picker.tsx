import { Combobox as ComboboxPrimitive } from '@base-ui/react'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { ComboboxTrigger } from '../ui/combobox'
import { CommandItem } from '../ui/command'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group'

export function SearchablePickerInput({
  className,
  disabled = false,
  triggerLabel,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Input> & { triggerLabel: string }) {
  return (
    <InputGroup className={cn('w-auto', className)}>
      <ComboboxPrimitive.Input render={<InputGroupInput disabled={disabled} />} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          variant="ghost"
          render={<ComboboxTrigger />}
          tabIndex={-1}
          aria-label={triggerLabel}
          data-slot="input-group-button"
          className="data-pressed:bg-transparent"
          disabled={disabled}
        />
      </InputGroupAddon>
    </InputGroup>
  )
}

export function SearchablePickerItem({ className, ...props }: ComponentProps<typeof CommandItem>) {
  return <CommandItem className={cn('data-selected:bg-accent', className)} {...props} />
}
