import { useState } from 'react'

import { ClaudeContextComposition } from './ClaudeContextComposition'

function contextZone(percentage: number) {
  if (percentage <= 20) return { label: 'Smart Zone', text: 'text-emerald-600' }
  if (percentage <= 40) return { label: 'Nearing Dumb Zone', text: 'text-amber-600' }
  return { label: 'Dumb Zone', text: 'text-red-600' }
}

export function ContextDetails({
  harness,
  percentage,
  usedTokens,
}: {
  harness: 'claude' | 'codex'
  percentage: number
  usedTokens: number
}) {
  const [threshold, setThreshold] = useState(160_000)
  const [thresholdInput, setThresholdInput] = useState('160000')
  const zone = contextZone(percentage)
  return (
    <>
      <div className="grid gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="type-title font-semibold tabular-nums">
            {Math.round(usedTokens / 1000)}k{' '}
            <span className="type-body font-normal text-muted-foreground">/ 200k tokens</span>
          </div>
          <span className={`type-heading font-medium ${zone.text}`}>
            {percentage}% used · {zone.label}
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-foreground/70"
            style={{ width: `${percentage}%` }}
          />
          <div className="absolute inset-y-0 w-px bg-card" style={{ left: '20%' }} />
        </div>
        <div className="flex justify-between type-body text-muted-foreground">
          <span>Working target · 40k tokens</span>
          <span>Current · {Math.round(usedTokens / 1000)}k tokens</span>
        </div>
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
        <p className="type-prose text-muted-foreground">
          At this level, older context can compete with the current task. Compact before starting
          another substantial phase.
        </p>
      </div>
      {harness === 'claude' ? <ClaudeContextComposition /> : null}
      <div className="grid gap-2.5 border-t pt-3">
        <div className="flex items-center justify-between gap-3 type-body">
          <span className="font-semibold">Auto-compact</span>
          <span className="text-muted-foreground">
            At {Math.round((threshold / 200_000) * 100)}% of total
          </span>
        </div>
        <input
          aria-label="Auto-compact threshold"
          className="h-1.5 w-full cursor-pointer accent-foreground"
          max="95"
          min="40"
          onChange={(event) => {
            const nextThreshold = Math.round((200_000 * Number(event.target.value)) / 100)
            setThreshold(nextThreshold)
            setThresholdInput(String(nextThreshold))
          }}
          step="5"
          type="range"
          value={Math.round((threshold / 200_000) * 100)}
        />
        <label className="flex items-center justify-between gap-3 type-body text-muted-foreground">
          <span>Threshold</span>
          <span className="flex w-40 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-foreground">
            <input
              aria-label="Auto-compact threshold tokens"
              className="min-w-0 flex-1 bg-transparent tabular-nums outline-none"
              max="190000"
              min="80000"
              onBlur={() => {
                const nextThreshold = Math.min(
                  190_000,
                  Math.max(80_000, Number(thresholdInput) || threshold),
                )
                setThreshold(nextThreshold)
                setThresholdInput(String(nextThreshold))
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
    </>
  )
}
