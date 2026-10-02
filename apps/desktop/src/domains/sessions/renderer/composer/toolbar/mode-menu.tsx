import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { modeChoices } from '../turn-configuration/turn-configuration'
import { composerMenuPopupRecipe, composerRichOptionRecipe } from './composer-menu-recipes'
import { ComposerMenuTrigger, ComposerMenuValue } from './composer-menu-trigger'
import type { TurnConfigurationControlProps } from './turn-configuration-menu'

// Extracted from the prototype's PermissionMenu (602bcce2); CONTEXT.md L2 · Session Mode.
export function ModeMenu({ choices, value, onChange }: TurnConfigurationControlProps) {
  const { t } = useTranslation('sessions')
  const modes = modeChoices(choices, value.model)
  const current = modes.find((mode) => mode.value === value.mode) ?? modes[0]
  return (
    <DropdownMenu>
      <ComposerMenuTrigger
        ariaLabel={t('composer.turnConfiguration.choosePermissionMode', {
          mode: current?.label,
        })}
      >
        <ComposerMenuValue
          icon={current === undefined ? null : <Icon name={current.icon} />}
          label={current?.label}
        />
      </ComposerMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        tabIndex={0}
        className={composerMenuPopupRecipe('p-1.5')}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 type-control text-muted-foreground">
            {t('composer.turnConfiguration.permissions', { harness: choices.label })}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current?.value ?? ''}
            onValueChange={(mode: string) => onChange({ ...value, mode })}
          >
            {modes.map((mode) => (
              <DropdownMenuRadioItem
                key={mode.value}
                value={mode.value}
                closeOnClick
                className={composerRichOptionRecipe.row}
              >
                <Icon name={mode.icon} className={composerRichOptionRecipe.icon} />
                <span className={composerRichOptionRecipe.content}>
                  <span className={composerRichOptionRecipe.label}>{mode.label}</span>
                  <span className={`${composerRichOptionRecipe.detail} text-muted-foreground`}>
                    {mode.detail}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
