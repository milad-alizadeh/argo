import { useTranslation } from 'react-i18next'
import type { Harness } from '@/harnesses/harness'
import { HARNESS_PRESENTATIONS, harnessLabel } from '@/harnesses/presentation-registry'
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

export function UsagePopover({ harness }: { harness: Harness }) {
  const { t } = useTranslation('sessions')
  const usage = HARNESS_PRESENTATIONS[harness].planUsage
  const primaryPercentage = usage[0]?.percentage ?? 0
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={`Usage ${primaryPercentage}%`}
            className="shrink-0 gap-1.5 px-2"
            size="sm"
            variant="ghost"
          />
        }
      >
        <Icon className="text-muted-foreground" name="usage-meter" />
        <span className="inline-flex items-center gap-1">
          {t('composer.allowance.label')}{' '}
          <span className="tabular-nums text-muted-foreground">{primaryPercentage}%</span>
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>
            {t('composer.allowance.title', { harness: harnessLabel(harness) })}
          </PopoverTitle>
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
