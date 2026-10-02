import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { Icon, type IconName } from './icon/icon'
import { Button } from './ui/button'
import { DropdownMenuTrigger } from './ui/dropdown-menu'
import { PopoverTrigger } from './ui/popover'

type TriggerProps = Omit<
  ComponentProps<typeof Button>,
  'children' | 'size' | 'variant' | 'className'
> & {
  icon: IconName
  label: string
  appearance?: 'menu' | 'project' | 'workspace'
  iconOnly?: boolean
  className?: string
  'aria-label': string
}

function triggerButton({
  appearance = 'menu',
  iconOnly = false,
  className,
  ...props
}: TriggerProps) {
  const { icon: _icon, label: _label, ...buttonProps } = props
  const appearanceClasses = {
    menu: 'min-w-0',
    project: 'min-w-0 gap-(--spacing-shell-tight) border-0 pl-2 pr-(--spacing-shell-icon)',
    workspace:
      'max-w-full rounded-full border-border bg-(--color-session-composer) backdrop-blur-(--blur-session-composer) dark:border-border dark:bg-(--color-session-composer)',
  }[appearance]
  return (
    <Button
      className={cn(appearanceClasses, iconOnly && 'size-7 p-0', className)}
      size="sm"
      variant={appearance === 'workspace' ? 'outline' : 'ghost'}
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
