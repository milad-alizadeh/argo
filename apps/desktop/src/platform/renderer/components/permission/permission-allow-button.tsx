import { useTranslation } from 'react-i18next'
import type { Harness } from '@/harnesses/harness'
import type { HarnessPresentation } from '@/harnesses/harness-presentation'
import { HARNESS_PRESENTATIONS } from '@/harnesses/presentation-registry'
import { Icon } from '../icon/icon'
import { Button } from '../ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '../ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

const STANDING_ALLOW_LABELS = {
  'similar-calls': 'permission.allowSimilar',
  session: 'permission.allowAll',
} as const satisfies Record<HarnessPresentation['standingAllow'], string>

export type PermissionAnswer = 'allow' | 'allowForSession' | 'deny'

export function AllowButton({
  allowLabel,
  harness,
  disabled,
  onDecide,
}: {
  allowLabel: string
  harness: Harness | undefined
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
            {t(STANDING_ALLOW_LABELS[HARNESS_PRESENTATIONS[harness].standingAllow])}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
