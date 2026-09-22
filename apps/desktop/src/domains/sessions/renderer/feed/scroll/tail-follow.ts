import type { ReactVirtualizer } from '@tanstack/react-virtual'
import type { Virtualizer } from '@tanstack/virtual-core'
import { useCallback, useEffect, useRef, useState } from 'react'

const TAIL_THRESHOLD_PX = 80

// A disclosure the reader opens resizes a row under their eyes, not the tail. While its motion
// runs the Feed holds its start anchor, because TanStack's end anchor pins the bottom and slides
// the pressed control up the screen. `onRelease` rereads the reader's place once it settles.
export function useDisclosureHold(viewport: HTMLElement | null, onRelease: () => void) {
  const [holding, setHolding] = useState(false)
  const release = useRef(onRelease)
  useEffect(() => {
    release.current = onRelease
  }, [onRelease])
  useEffect(() => {
    if (viewport === null) return
    let generation = 0
    // Capture runs before the trigger's own handler, so the hold commits with the toggle.
    const onClick = (event: MouseEvent) => {
      const trigger =
        event.target instanceof Element ? event.target.closest('[aria-expanded]') : null
      if (trigger === null || !onScreen(trigger, viewport)) return
      generation += 1
      const pressed = generation
      setHolding(true)
      void motionSettled(viewport).then(() => {
        if (pressed !== generation) return
        setHolding(false)
        release.current()
      })
    }
    viewport.addEventListener('click', onClick, true)
    return () => {
      generation += 1
      viewport.removeEventListener('click', onClick, true)
    }
  }, [viewport])
  return holding
}

// A control pressed off screen (from the keyboard) keeps the rows the reader sees still instead,
// which the end anchor already does.
function onScreen(trigger: Element, viewport: HTMLElement) {
  const control = trigger.getBoundingClientRect()
  const view = viewport.getBoundingClientRect()
  return control.bottom > view.top && control.top < view.bottom
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

// Two frames for the panel's transition to start, then its end, then one frame for the last
// measure. A looping animation (a running spinner) never finishes, so it is not waited on.
async function motionSettled(viewport: HTMLElement) {
  await nextFrame()
  await nextFrame()
  const finite = viewport
    .getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
  await Promise.allSettled(finite.map((animation) => animation.finished))
  await nextFrame()
}

// Whether the Feed should track new rows as they arrive, and the state that decision rests on:
// whether the document has taken its opening position yet, and whether the reader is currently
// at the tail (unless a disclosure's own motion is holding the anchor still).
export function useFeedTailFollow(
  sessionId: string,
  { active, viewport }: { active: boolean; viewport: HTMLElement | null },
) {
  const [atLatest, setAtLatest] = useState(true)
  const [initiallyPositionedSessionId, setInitiallyPositionedSessionId] = useState<string | null>(
    null,
  )
  const latest = useRef<Virtualizer<HTMLElement, Element> | null>(null)
  const awaitingInitialPosition = initiallyPositionedSessionId !== sessionId
  const markInitiallyPositioned = useCallback(() => {
    setAtLatest(true)
    setInitiallyPositionedSessionId(sessionId)
  }, [sessionId])
  const onChange = useCallback(
    (instance: Virtualizer<HTMLElement, Element>) => {
      latest.current = instance
      // An inactive document measures 0x0, which reads as "at the end" and would lose the reader.
      if (awaitingInitialPosition || !active) return
      setAtLatest((current) => {
        const next = instance.isAtEnd(TAIL_THRESHOLD_PX)
        return current === next ? current : next
      })
    },
    [active, awaitingInitialPosition],
  )
  const holding = useDisclosureHold(viewport, () => {
    if (latest.current !== null) onChange(latest.current)
  })
  return {
    atLatest,
    awaitingInitialPosition,
    markInitiallyPositioned,
    onChange,
    shouldFollow: !holding && (awaitingInitialPosition || atLatest),
  }
}

// Offers the Session screen a Jump to latest action while the active Feed is away from its tail.
export function useJumpToLatest({
  active,
  onJumpToLatestChange,
  sessionId,
  tailFollow,
  virtualizer,
}: {
  active: boolean
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  sessionId: string
  tailFollow: ReturnType<typeof useFeedTailFollow>
  virtualizer: ReactVirtualizer<HTMLElement, Element>
}) {
  const jumpToLatest = useCallback(() => {
    virtualizer.scrollToEnd({ behavior: 'smooth' })
  }, [virtualizer])
  const offered = active && !tailFollow.awaitingInitialPosition && !tailFollow.atLatest
  useEffect(() => {
    onJumpToLatestChange(sessionId, offered ? jumpToLatest : null)
    return () => onJumpToLatestChange(sessionId, null)
  }, [jumpToLatest, offered, onJumpToLatestChange, sessionId])
}
