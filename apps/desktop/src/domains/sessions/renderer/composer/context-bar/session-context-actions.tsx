import { useTranslation } from 'react-i18next'
import { MenuDropdownTrigger } from '@/platform/renderer/components/dropdown-trigger'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/platform/renderer/components/ui/dropdown-menu'

export function SessionContextActions({
  canCompact,
  canHandoff,
  isCompacting,
  isHandingOff,
  onCompact,
  onHandoff,
}: {
  canCompact: boolean
  canHandoff: boolean
  isCompacting: boolean
  isHandingOff: boolean | undefined
  onCompact: (() => Promise<boolean>) | undefined
  onHandoff: (() => Promise<boolean>) | undefined
}) {
  const { t } = useTranslation('sessions')
  return (
    <DropdownMenu>
      <MenuDropdownTrigger
        aria-label={t('composer.contextActions')}
        className="shrink-0"
        icon="context-actions"
        iconOnly
        label={t('composer.contextActions')}
      />
      <DropdownMenuContent align="end" side="top" className="w-max">
        <DropdownMenuItem
          aria-label={t('composer.compactAction')}
          disabled={!canCompact || isCompacting}
          onClick={() => void onCompact?.()}
        >
          <Icon className="text-muted-foreground" name="compact" />
          {t('composer.compactShort')}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={t('composer.handoffAction')}
          disabled={!canHandoff || isHandingOff}
          onClick={() => void onHandoff?.()}
        >
          <Icon className="text-muted-foreground" name="handoff" />
          {t('handoff.title')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
