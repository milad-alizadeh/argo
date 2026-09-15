import { useEffect, useRef, useState } from 'react'

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
