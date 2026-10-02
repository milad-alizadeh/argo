import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RangeField } from '@/platform/renderer/components/design-system/range-field'
import { Input } from '@/platform/renderer/components/ui/input'
import { Slider } from '@/platform/renderer/components/ui/slider'
import { AUTO_COMPACT_LIMIT_MAX, AUTO_COMPACT_LIMIT_MIN } from '../auto-compact-limit'
import { useCodexAutoCompactLimit } from './use-codex-auto-compact-limit'

// The threshold lives in the person's own `config.toml`, custom per machine and never committed (#1904).
export function CodexAutoCompact({ capacityTokens }: { capacityTokens: number | null }) {
  const { limit, write } = useCodexAutoCompactLimit()
  if (limit === null) return null
  return (
    <AutoCompactControl capacityTokens={capacityTokens} threshold={limit} setThreshold={write} />
  )
}

export function AutoCompactControl({
  capacityTokens,
  threshold,
  setThreshold,
}: {
  capacityTokens: number | null
  threshold: number
  setThreshold: (limit: number) => void
}) {
  const { t } = useTranslation('sessions')
  const labelId = useId()
  const thresholdLabelId = useId()
  const [thresholdInput, setThresholdInput] = useState(String(threshold))

  useEffect(() => {
    setThresholdInput(String(threshold))
  }, [threshold])

  return (
    <RangeField
      labelId={labelId}
      className="grid gap-2.5 border-t pt-3"
      label={
        <span className="type-body font-semibold">{t('composer.contextWindow.autoCompact')}</span>
      }
      description={
        <span className="type-body text-muted-foreground">
          {capacityTokens === null
            ? `${Math.round(threshold / 1000)}k tokens`
            : `At ${Math.round((threshold / capacityTokens) * 100)}% of total`}
        </span>
      }
    >
      <div>
        <span className="sr-only" id={thresholdLabelId}>
          {t('composer.contextWindow.thresholdLabel')}
        </span>
        <Slider
          aria-labelledby={thresholdLabelId}
          max={95}
          min={40}
          onValueChange={(nextValue) => {
            if (capacityTokens === null) return
            const percent = Array.isArray(nextValue) ? nextValue[0] : nextValue
            const nextThreshold = Math.round((capacityTokens * percent) / 100)
            setThreshold(nextThreshold)
          }}
          step={5}
          value={[capacityTokens === null ? 40 : Math.round((threshold / capacityTokens) * 100)]}
        />
      </div>
      <div className="flex items-center justify-between gap-3 type-body text-muted-foreground">
        <span>{t('composer.contextWindow.threshold')}</span>
        <span className="flex w-40 items-center gap-2 text-foreground">
          <Input
            aria-label={t('composer.contextWindow.thresholdTokens')}
            className="min-w-0 flex-1 tabular-nums"
            max={AUTO_COMPACT_LIMIT_MAX}
            min={AUTO_COMPACT_LIMIT_MIN}
            onBlur={() => {
              const nextThreshold = Math.min(
                AUTO_COMPACT_LIMIT_MAX,
                Math.max(AUTO_COMPACT_LIMIT_MIN, Number(thresholdInput) || threshold),
              )
              setThreshold(nextThreshold)
            }}
            onChange={(event) => setThresholdInput(event.target.value)}
            step="1000"
            type="number"
            value={thresholdInput}
          />
          <span className="shrink-0 text-muted-foreground">
            {t('composer.contextWindow.tokens')}
          </span>
        </span>
      </div>
    </RangeField>
  )
}
