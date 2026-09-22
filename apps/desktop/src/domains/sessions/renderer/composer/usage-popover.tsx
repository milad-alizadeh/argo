import { useTranslation } from 'react-i18next'
import { HARNESSES } from '@/domains/sessions/renderer/harness/harnesses'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/platform/renderer/components/ui/popover'
import { Progress } from '@/platform/renderer/components/ui/progress'

const PLAN_USAGE = {
  claude: [
    { detail: 'Resets in 4 hr 5 min', label: '5-hour limit', percentage: 8 },
    { detail: 'Resets Saturday at 6:00 PM', label: 'Weekly, all models', percentage: 65 },
    { detail: 'Resets Saturday at 6:00 PM', label: 'Weekly, Opus', percentage: 12 },
  ],
  codex: [
    { detail: 'Resets Monday at 9:00 AM', label: 'Weekly', percentage: 54 },
    { detail: 'Resets October 1', label: 'Monthly', percentage: 31 },
  ],
} as const

export function UsagePopover({ harness }: { harness: 'claude' | 'codex' }) {
  const { t } = useTranslation('sessions')
  const usage = PLAN_USAGE[harness]
  const primaryPercentage = usage[0].percentage
  const harnessLabel = HARNESSES[harness].label
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={`Usage ${primaryPercentage}%`}
            className="shrink-0 gap-1.5 px-2 type-control"
            size="sm"
            variant="ghost"
          />
        }
      >
        <Icon name="usage-meter" />
        <span className="inline-flex items-center gap-1">
          {t('composer.allowance.label')}{' '}
          <span className="tabular-nums text-muted-foreground">{primaryPercentage}%</span>
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>{t('composer.allowance.title', { harness: harnessLabel })}</PopoverTitle>
          <PopoverDescription>{t('composer.allowance.description')}</PopoverDescription>
        </PopoverHeader>
        {usage.map((item) => (
          <div className="grid gap-1.5" key={item.label}>
            <div className="flex items-baseline gap-2">
              <span className="type-heading">{item.label}</span>
              <span className="ml-auto type-meta text-muted-foreground">{item.detail}</span>
              <span className="w-8 text-right type-meta tabular-nums">{item.percentage}%</span>
            </div>
            <Progress aria-label={item.label} value={item.percentage} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
