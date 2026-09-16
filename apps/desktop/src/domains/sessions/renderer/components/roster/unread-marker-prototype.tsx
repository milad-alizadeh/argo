import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

// PROTOTYPE: three unread marker structures on the existing /sessions route, switched by ?variant=.
const VARIANTS = [
  { key: 'A', name: 'Trailing beacon' },
  { key: 'B', name: 'Harness halo' },
  { key: 'C', name: 'Inline label' },
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
        <span className="block opacity-70">visible rows simulate unread</span>
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

export function UnreadMarkerPrototypeLeading({
  variant,
}: {
  variant: UnreadMarkerPrototypeVariant | null
}) {
  if (variant !== 'B') return null
  return (
    <span
      aria-hidden="true"
      className="absolute -inset-x-1 -inset-y-0.5 rounded-md ring-2 ring-[#3b82f6] dark:ring-[#60a5fa]"
    />
  )
}

export function UnreadMarkerPrototypeTrailing({
  variant,
}: {
  variant: UnreadMarkerPrototypeVariant | null
}) {
  if (variant === 'A') {
    return (
      <span
        aria-hidden="true"
        className="ml-auto size-2.5 shrink-0 rounded-full bg-[#3b82f6] shadow-[0_0_0_2px_var(--sidebar)] dark:bg-[#60a5fa]"
      />
    )
  }
  if (variant !== 'C') return null
  return (
    <span className="ml-auto shrink-0 rounded-full bg-[#3b82f6]/12 px-2 py-0.5 type-meta text-[#2563eb] dark:bg-[#60a5fa]/15 dark:text-[#93c5fd]">
      Unread
    </span>
  )
}
