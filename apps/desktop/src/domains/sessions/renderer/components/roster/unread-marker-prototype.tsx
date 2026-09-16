import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import './unread-marker-prototype.css'

// PROTOTYPE: three running markers beside a blue unread dot, switched by ?variant= on /sessions.
const VARIANTS = [
  { key: 'A', name: 'Comet' },
  { key: 'B', name: 'Signal sweep' },
  { key: 'C', name: 'Step diamond' },
] as const

export type UnreadMarkerPrototypeVariant = (typeof VARIANTS)[number]['key']

let rememberedVariant: UnreadMarkerPrototypeVariant | null = null

export function unreadMarkerPrototypeVariant(value: string | null) {
  if (window.argo !== undefined && window.argo.development === null) return null
  return VARIANTS.find((variant) => variant.key === value)?.key ?? null
}

export function useUnreadMarkerPrototypeVariant() {
  const [searchParams] = useSearchParams()
  return unreadMarkerPrototypeVariant(searchParams.get('variant'))
}

function useVariantSwitcher() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = unreadMarkerPrototypeVariant(searchParams.get('variant'))
  if (selected !== null) rememberedVariant = selected
  const current = selected ?? rememberedVariant
  const cycle = (step: number) => {
    const index = VARIANTS.findIndex((variant) => variant.key === current)
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]
    if (next === undefined) return
    const updated = new URLSearchParams(searchParams)
    updated.set('variant', next.key)
    setSearchParams(updated, { replace: true })
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        !(target instanceof HTMLElement) ||
        target.matches('input, textarea, [contenteditable="true"]')
      )
        return
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  useEffect(() => {
    if (selected !== null || current === null) return
    const updated = new URLSearchParams(searchParams)
    updated.set('variant', current)
    setSearchParams(updated, { replace: true })
  }, [current, searchParams, selected, setSearchParams])
  return { current, cycle }
}

export function UnreadMarkerPrototypeSwitcher() {
  const { current, cycle } = useVariantSwitcher()
  if (current === null) return null
  const variant = VARIANTS.find((candidate) => candidate.key === current)
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-foreground/15 bg-foreground px-2 py-1.5 text-background shadow-lg">
      <button
        aria-label="Previous unread marker variant"
        className="rounded-full p-1 hover:bg-background/15 focus-visible:ring-2 focus-visible:ring-background"
        onClick={() => cycle(-1)}
        type="button"
      >
        <ArrowLeft aria-hidden className="size-4" />
      </button>
      <span className="min-w-40 text-center type-meta">
        {variant?.key} · {variant?.name}
        <span className="block opacity-70">blue is unread · motion is running</span>
      </span>
      <button
        aria-label="Next unread marker variant"
        className="rounded-full p-1 hover:bg-background/15 focus-visible:ring-2 focus-visible:ring-background"
        onClick={() => cycle(1)}
        type="button"
      >
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </div>
  )
}

export function UnreadMarkerPrototypeRunning({
  running,
  variant,
}: {
  running: boolean
  variant: UnreadMarkerPrototypeVariant | null
}) {
  if (!running || variant === null) return null
  if (variant === 'A') return <span aria-hidden="true" className="running-comet" />
  if (variant === 'B') return <span aria-hidden="true" className="running-sweep" />
  return <span aria-hidden="true" className="running-step" />
}

export function unreadMarkerPrototypeDot(options: {
  blocked: boolean
  failed: boolean
  unread: boolean
}) {
  if (options.blocked) return 'bg-warn'
  if (options.failed) return 'bg-danger'
  return options.unread ? 'bg-plan shadow-[0_0_5px_var(--color-plan)]' : 'bg-idle'
}
