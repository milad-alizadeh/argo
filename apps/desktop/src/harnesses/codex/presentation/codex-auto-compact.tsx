import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RangeField, RangeSlider } from '@/platform/renderer/components/design-system/range-field'
import { Input } from '@/platform/renderer/components/ui/input'
import { AUTO_COMPACT_LIMIT_MAX, AUTO_COMPACT_LIMIT_MIN } from '../auto-compact-limit'
import { useCodexAutoCompactLimit } from './use-codex-auto-compact-limit'

function shouldNormalizeThresholdInput(
  enteredThreshold: number,
  nextThreshold: number,
  thresholdInput: string,
): boolean {
  return (
    Number.isFinite(enteredThreshold) &&
    enteredThreshold !== 0 &&
    String(nextThreshold) !== thresholdInput
  )
}

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
  const descriptionId = useId()
  const [thresholdInput, setThresholdInput] = useState(String(threshold))

  useEffect(() => {
    setThresholdInput(String(threshold))
  }, [threshold])

  return (
    <RangeField
      labelId={labelId}
      descriptionId={descriptionId}
      className="grid gap-2.5 border-t pt-3"
      label={
        <span className="type-body font-semibold">
          {t('composer.contextWindow.thresholdLabel')}
        </span>
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
        <RangeSlider
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          format={{ style: 'unit', unit: 'percent' }}
          max={95}
          min={40}
          onValueChange={(percent) => {
            if (capacityTokens === null) return
            const nextThreshold = Math.round((capacityTokens * percent) / 100)
            setThreshold(nextThreshold)
          }}
          step={5}
          value={capacityTokens === null ? 40 : Math.round((threshold / capacityTokens) * 100)}
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
              const enteredThreshold = Number(thresholdInput)
              const nextThreshold = Math.min(
                AUTO_COMPACT_LIMIT_MAX,
                Math.max(AUTO_COMPACT_LIMIT_MIN, enteredThreshold || threshold),
              )
              if (shouldNormalizeThresholdInput(enteredThreshold, nextThreshold, thresholdInput)) {
                setThresholdInput(String(nextThreshold))
              }
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
