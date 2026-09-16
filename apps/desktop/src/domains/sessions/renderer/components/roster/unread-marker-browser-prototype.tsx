import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  UnreadMarkerPrototypeLeading,
  UnreadMarkerPrototypeTrailing,
  type UnreadMarkerPrototypeVariant,
  unreadMarkerPrototypeVariant,
} from './unread-marker-prototype'

const VARIANTS = [
  { key: 'A', name: 'Trailing beacon' },
  { key: 'B', name: 'Harness halo' },
  { key: 'C', name: 'Inline label' },
] as const

const BROWSER_ROWS = [
  { name: 'Refine the Session domain model', harness: 'C', detail: 'Codex · 2 min ago' },
  { name: 'Fix the settings layout', harness: 'C', detail: 'Claude Code · 8 min ago' },
  { name: 'Review the release workflow', harness: 'G', detail: 'Gemini · 24 min ago' },
] as const

function browserPrototypeVariant() {
  const query = window.location.hash.split('?')[1] ?? ''
  return unreadMarkerPrototypeVariant(new URLSearchParams(query).get('variant')) ?? 'A'
}

// PROTOTYPE: browser-only shell for reviewing the marker without Electron's preload bridge.
export function UnreadMarkerBrowserPrototype() {
  const [variant, setVariant] = useState<UnreadMarkerPrototypeVariant>(browserPrototypeVariant)
  const cycle = (step: number) => {
    const index = VARIANTS.findIndex((candidate) => candidate.key === variant)
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]
    if (next === undefined) return
    setVariant(next.key)
    window.history.replaceState(null, '', `#/sessions?variant=${next.key}`)
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  const selected = VARIANTS.find((candidate) => candidate.key === variant)
  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-[22rem] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4">
        <div className="mb-5 flex items-center justify-between px-2">
          <div>
            <p className="type-meta text-faint">PROJECT</p>
            <h1 className="type-body font-semibold">Argo</h1>
          </div>
          <button className="rounded-md border border-border px-2.5 py-1 type-meta" type="button">
            New Session
          </button>
        </div>
        <nav aria-label="Session status" className="mb-3 flex gap-1 px-1">
          {['Active', 'Unread', 'Archived', 'All'].map((label) => (
            <button
              className={`rounded-md px-2.5 py-1 type-meta ${label === 'Unread' ? 'bg-selected text-foreground' : 'text-faint'}`}
              key={label}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <section aria-label="Unread Sessions" className="space-y-1">
          {BROWSER_ROWS.map((row, index) => (
            <button
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left ${index === 0 ? 'bg-selected' : 'hover:bg-muted'}`}
              key={row.name}
              type="button"
            >
              <span aria-hidden className="relative mt-0.5 flex h-5 w-4 shrink-0 items-center">
                <UnreadMarkerPrototypeLeading variant={variant} />
                <span className="roster-harness-mark flex size-4 items-center justify-center rounded-sm bg-muted type-meta font-semibold">
                  {row.harness}
                </span>
                <span className="absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full bg-positive" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate type-body font-medium">{row.name}</span>
                  <UnreadMarkerPrototypeTrailing variant={variant} />
                  {variant === 'C' ? null : <span className="sr-only">Unread</span>}
                </span>
                <span className="mt-0.5 block type-meta text-faint">{row.detail}</span>
              </span>
            </button>
          ))}
        </section>
      </aside>
      <section className="flex min-w-0 flex-1 items-center justify-center bg-background p-12">
        <div className="max-w-md text-center">
          <p className="type-meta text-faint">UNREAD MARKER PROTOTYPE</p>
          <h2 className="mt-2 text-2xl font-semibold">{selected?.name}</h2>
          <p className="mt-2 type-body text-muted-foreground">
            Compare the marker against the existing harness and status marks in the Session list.
          </p>
        </div>
      </section>
      <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-foreground/15 bg-foreground px-2 py-1.5 text-background shadow-lg">
        <button
          aria-label="Previous unread marker variant"
          className="rounded-full p-1"
          onClick={() => cycle(-1)}
          type="button"
        >
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <span className="min-w-40 text-center type-meta">
          {selected?.key} · {selected?.name}
          <span className="block opacity-70">Use left and right arrows</span>
        </span>
        <button
          aria-label="Next unread marker variant"
          className="rounded-full p-1"
          onClick={() => cycle(1)}
          type="button"
        >
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    </main>
  )
}
