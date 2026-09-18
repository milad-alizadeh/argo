import { ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/renderer/components/ui/dropdown-menu'
import { InputGroupButton } from '@/renderer/components/ui/input-group'
import type { TurnSetupControlProps } from './run-setup-menu'

// Extracted from the prototype's PermissionMenu (602bcce2); CONTEXT.md L2 · Session Mode.
export function ModeMenu({ choices, value, onChange }: TurnSetupControlProps) {
  const current = choices.modes.find((mode) => mode.value === value.mode) ?? choices.modes[0]
  const CurrentIcon = current?.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton
            variant="ghost"
            className="shrink-0 type-control text-foreground"
            aria-label={`Choose permission mode: ${current?.label}`}
          />
        }
      >
        {CurrentIcon ? <CurrentIcon /> : null}
        <span className="hidden @[36rem]:inline">{current?.label}</span>
        <ChevronDown className="hidden text-muted-foreground @[36rem]:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-(--size-session-menu) p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 type-control text-muted-foreground">
            {choices.label} permissions
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value.mode}
            onValueChange={(mode: string) => onChange({ ...value, mode })}
          >
            {choices.modes.map((mode) => (
              <DropdownMenuRadioItem
                key={mode.value}
                value={mode.value}
                closeOnClick
                className="items-start rounded-md py-1.5 pr-8 pl-2"
              >
                <mode.icon className="mt-0.5 size-3.5" />
                <span className="grid gap-0.5">
                  <span className="type-heading">{mode.label}</span>
                  <span className="type-meta text-muted-foreground">{mode.detail}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
