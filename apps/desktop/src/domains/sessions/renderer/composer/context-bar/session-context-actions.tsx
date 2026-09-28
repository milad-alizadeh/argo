import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t('composer.contextActions')}
            className="shrink-0"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Icon name="context-actions" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="top" className="w-max">
        <DropdownMenuItem
          aria-label={t('composer.compactAction')}
          className="type-control"
          disabled={!canCompact || isCompacting}
          onClick={() => void onCompact?.()}
        >
          <Icon name="compact" />
          {t('composer.compactShort')}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={t('composer.handoffAction')}
          className="type-control"
          disabled={!canHandoff || isHandingOff}
          onClick={() => void onHandoff?.()}
        >
          <Icon name="handoff" />
          {t('handoff.title')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
