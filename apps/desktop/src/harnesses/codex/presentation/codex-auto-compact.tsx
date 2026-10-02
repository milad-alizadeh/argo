import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

function AutoCompactControl({
  capacityTokens,
  threshold,
  setThreshold,
}: {
  capacityTokens: number | null
  threshold: number
  setThreshold: (limit: number) => void
}) {
  const { t } = useTranslation('sessions')
  const [thresholdInput, setThresholdInput] = useState(String(threshold))

  useEffect(() => {
    setThresholdInput(String(threshold))
  }, [threshold])

  return (
    <div className="grid gap-2.5 border-t pt-3">
      <div className="flex items-center justify-between gap-3 type-body">
        <span className="font-semibold">{t('composer.contextWindow.autoCompact')}</span>
        <span className="text-muted-foreground">
          {capacityTokens === null
            ? `${Math.round(threshold / 1000)}k tokens`
            : `At ${Math.round((threshold / capacityTokens) * 100)}% of total`}
        </span>
      </div>
      <input
        aria-label={t('composer.contextWindow.thresholdLabel')}
        className="h-1.5 w-full cursor-pointer accent-foreground"
        max="95"
        min="40"
        onChange={(event) => {
          if (capacityTokens === null) return
          const nextThreshold = Math.round((capacityTokens * Number(event.target.value)) / 100)
          setThreshold(nextThreshold)
        }}
        step="5"
        type="range"
        value={capacityTokens === null ? 40 : Math.round((threshold / capacityTokens) * 100)}
      />
      <label className="flex items-center justify-between gap-3 type-body text-muted-foreground">
        <span>{t('composer.contextWindow.threshold')}</span>
        <span className="flex w-40 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-foreground">
          <input
            aria-label={t('composer.contextWindow.thresholdTokens')}
            className="min-w-0 flex-1 bg-transparent tabular-nums outline-none"
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
      </label>
    </div>
  )
}
