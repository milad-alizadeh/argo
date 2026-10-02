import type { Combobox as ComboboxPrimitive } from '@base-ui/react'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { ComboboxInput } from '../ui/combobox'
import { CommandItem } from '../ui/command'

export function SearchablePickerInput({
  className,
  disabled = false,
  triggerLabel,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Input> & { triggerLabel: string }) {
  return (
    <ComboboxInput
      {...props}
      className={cn('w-auto', className)}
      disabled={disabled}
      triggerProps={{ 'aria-label': triggerLabel, tabIndex: -1 }}
    />
  )
}

export function SearchablePickerItem({ className, ...props }: ComponentProps<typeof CommandItem>) {
  return <CommandItem className={cn('data-selected:bg-accent', className)} {...props} />
}
