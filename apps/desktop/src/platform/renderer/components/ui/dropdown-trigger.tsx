import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { Icon, type IconName } from '../icon/icon'
import { Button } from './button'
import { DropdownMenuTrigger } from './dropdown-menu'
import { PopoverTrigger } from './popover'

type TriggerProps = Omit<ComponentProps<typeof Button>, 'children' | 'size'> & {
  icon: IconName
  label: string
  iconOnly?: boolean
  'aria-label': string
}

function triggerButton({ iconOnly = false, className, ...props }: TriggerProps) {
  const { icon: _icon, label: _label, ...buttonProps } = props
  return (
    <Button
      className={cn('min-w-0', iconOnly && 'size-7 p-0', className)}
      size="sm"
      {...buttonProps}
    />
  )
}

function TriggerContents({ icon, label, iconOnly = false }: TriggerProps) {
  return (
    <>
      <Icon name={icon} size="control" />
      {iconOnly ? null : (
        <>
          <span className="min-w-0 max-w-64 truncate font-medium">{label}</span>
          <Icon className="text-muted-foreground" name="chevron-down" size="control" />
        </>
      )}
    </>
  )
}

export function SearchableDropdownTrigger(props: TriggerProps) {
  return (
    <PopoverTrigger render={triggerButton(props)}>
      <TriggerContents {...props} />
    </PopoverTrigger>
  )
}

export function MenuDropdownTrigger(props: TriggerProps) {
  return (
    <DropdownMenuTrigger disabled={props.disabled} render={triggerButton(props)}>
      <TriggerContents {...props} />
    </DropdownMenuTrigger>
  )
}
