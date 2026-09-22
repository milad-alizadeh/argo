import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { ButtonGroup, ButtonGroupSeparator } from './ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Icon } from './icon'

// What each Harness's standing allow covers: Claude's gate remembers similar calls, Codex the Session.
const STANDING_ALLOW = { claude: 'permission.allowSimilar', codex: 'permission.allowAll' } as const

export type SessionHarness = keyof typeof STANDING_ALLOW
export type PermissionAnswer = 'allow' | 'allowForSession' | 'deny'

export function AllowButton({
  allowLabel,
  harness,
  disabled,
  onDecide,
}: {
  allowLabel: string
  harness: SessionHarness | undefined
  disabled: boolean
  onDecide: (decision: PermissionAnswer) => Promise<void>
}) {
  const { t } = useTranslation('sessions')
  if (harness === undefined) {
    return (
      <Button disabled={disabled} size="sm" onClick={() => void onDecide('allow')}>
        {allowLabel}
      </Button>
    )
  }
  return (
    <ButtonGroup>
      <Button disabled={disabled} size="sm" onClick={() => void onDecide('allow')}>
        {allowLabel}
      </Button>
      <ButtonGroupSeparator className="bg-primary-foreground/25" />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={<Button aria-label={t('permission.more')} size="icon-sm" />}
        >
          <Icon name="chevron-down" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-auto">
          <DropdownMenuItem onClick={() => void onDecide('allowForSession')}>
            {t(STANDING_ALLOW[harness])}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
