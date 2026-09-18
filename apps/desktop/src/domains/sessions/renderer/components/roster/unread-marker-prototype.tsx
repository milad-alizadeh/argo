import { useSearchParams } from 'react-router'
import { Loader } from '../../../../../platform/renderer/components/loader'

export type UnreadMarkerPrototypeVariant = 'A'

export function unreadMarkerPrototypeVariant(value: string | null) {
  if (window.argo !== undefined && window.argo.development === null) return null
  return value === 'A' ? value : null
}

export function useUnreadMarkerPrototypeVariant() {
  const [searchParams] = useSearchParams()
  return unreadMarkerPrototypeVariant(searchParams.get('variant'))
}

export function UnreadMarkerPrototypeSwitcher() {
  const variant = useUnreadMarkerPrototypeVariant()
  if (variant === null) return null
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-foreground/15 bg-foreground px-4 py-2 text-center text-background shadow-lg type-meta">
      Square track
      <span className="block opacity-70">blue is unread · motion is running</span>
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
  return <Loader aria-hidden={true} className="ml-auto" size="meta" />
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
