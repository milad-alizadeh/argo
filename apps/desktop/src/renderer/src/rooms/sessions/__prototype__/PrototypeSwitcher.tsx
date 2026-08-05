import { useEffect } from 'react'
import { CaretLeftIcon, CaretRightIcon, IconButton, Text } from '@/shared/components/ui'

// PROTOTYPE. The floating bar the skill mandates: high-contrast and obviously not part of the design
// being judged. `←`/`→` cycle, and it wraps.

export interface Variant {
  key: string
  name: string
  body: React.ReactNode
}

export function PrototypeSwitcher({
  variants,
  at,
  onGo,
}: {
  variants: readonly Variant[]
  at: number
  onGo: (index: number) => void
}): React.JSX.Element {
  const wrap = (delta: number): number => (at + delta + variants.length) % variants.length

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))
      if (typing) return
      if (event.key === 'ArrowLeft') onGo(wrap(-1))
      if (event.key === 'ArrowRight') onGo(wrap(1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const current = variants[at]
  return (
    <div className="pointer-events-auto fixed bottom-region left-1/2 z-50 flex -translate-x-1/2 items-center gap-snug rounded-full bg-foreground px-gap py-hair text-background shadow-2xl">
      <IconButton
        label="Previous variant"
        onClick={() => onGo(wrap(-1))}
        className="text-background hover:text-background"
      >
        <CaretLeftIcon className="icon-sm" />
      </IconButton>
      <Text variant="meta" className="whitespace-nowrap tabular-nums">
        {current?.key} — {current?.name}
      </Text>
      <IconButton
        label="Next variant"
        onClick={() => onGo(wrap(1))}
        className="text-background hover:text-background"
      >
        <CaretRightIcon className="icon-sm" />
      </IconButton>
    </div>
  )
}
