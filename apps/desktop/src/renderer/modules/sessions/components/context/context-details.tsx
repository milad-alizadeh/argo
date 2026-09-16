import { useEffect, useState } from 'react'

import {
  AUTO_COMPACT_LIMIT_MAX,
  AUTO_COMPACT_LIMIT_MIN,
} from '@/agents/codex/compaction/compaction'
import { useCodexAutoCompactThreshold } from '../../hooks/use-codex-auto-compact-threshold'
import { ClaudeContextComposition } from './claude-context-composition'

function contextZone(percentage: number) {
  if (percentage <= 20) return { label: 'Smart Zone', text: 'text-emerald-600' }
  if (percentage <= 40) return { label: 'Nearing Dumb Zone', text: 'text-amber-600' }
  return { label: 'Dumb Zone', text: 'text-red-600' }
}

// Codex is the only harness with a real lever: the threshold lives in the person's own
// `~/.codex/config.toml`, custom per machine and never committed (#1904). Claude Code offers no
// equivalent knob to write, so the control only appears for Codex.
function CodexAutoCompact({ capacityTokens }: { capacityTokens: number | null }) {
  const [threshold, setThreshold] = useCodexAutoCompactThreshold()
  const [thresholdInput, setThresholdInput] = useState(String(threshold))

  useEffect(() => {
    setThresholdInput(String(threshold))
  }, [threshold])

  return (
    <div className="grid gap-2.5 border-t pt-3">
      <div className="flex items-center justify-between gap-3 type-body">
        <span className="font-semibold">Auto-compact</span>
        <span className="text-muted-foreground">
          {capacityTokens === null
            ? `${Math.round(threshold / 1000)}k tokens`
            : `At ${Math.round((threshold / capacityTokens) * 100)}% of total`}
        </span>
      </div>
      <input
        aria-label="Auto-compact threshold"
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
        <span>Threshold</span>
        <span className="flex w-40 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-foreground">
          <input
            aria-label="Auto-compact threshold tokens"
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
          <span className="shrink-0 text-muted-foreground">tokens</span>
        </span>
      </label>
    </div>
  )
}

export function ContextDetails({
  capacityTokens,
  harness,
  percentage,
  usedTokens,
}: {
  capacityTokens: number | null
  harness: 'claude' | 'codex'
  percentage: number | null
  usedTokens: number
}) {
  const zone = contextZone(percentage ?? 0)
  const capacityReported = capacityTokens !== null && percentage !== null
  return (
    <>
      <div className="grid gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="type-title tabular-nums">
            {Math.round(usedTokens / 1000)}k{' '}
            <span className="type-body font-normal text-muted-foreground">
              {capacityReported ? `/ ${Math.round(capacityTokens / 1000)}k tokens` : 'tokens'}
            </span>
          </div>
          {capacityReported ? (
            <span className={`type-heading ${zone.text}`}>
              {percentage}% used · {zone.label}
            </span>
          ) : null}
        </div>
        {capacityReported ? (
          <>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-foreground/70"
                style={{ width: `${percentage}%` }}
              />
              <div className="absolute inset-y-0 w-px bg-card" style={{ left: '20%' }} />
            </div>
            <div className="flex justify-between type-body text-muted-foreground">
              <span>Working target · {Math.round(capacityTokens / 5_000) * 1000} tokens</span>
              <span>Current · {Math.round(usedTokens / 1000)}k tokens</span>
            </div>
          </>
        ) : (
          <p className="type-prose text-muted-foreground">
            This session did not report its context window.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 type-prose">
          <div>
            <div className="font-semibold text-foreground">Smart Zone · 0–20%</div>
            <p className="mt-1 text-muted-foreground">
              Focused context. Instructions and recent decisions remain easy to weigh.
            </p>
          </div>
          <div>
            <div className="font-semibold text-foreground">Dumb Zone · 40%+</div>
            <p className="mt-1 text-muted-foreground">
              History still fits, but noise and stale decisions weaken attention.
            </p>
          </div>
        </div>
        {capacityReported ? (
          <p className="type-prose text-muted-foreground">
            At this level, older context can compete with the current task. Compact before starting
            another substantial phase.
          </p>
        ) : null}
      </div>
      {harness === 'claude' ? <ClaudeContextComposition /> : null}
      {harness === 'codex' ? <CodexAutoCompact capacityTokens={capacityTokens} /> : null}
    </>
  )
}
