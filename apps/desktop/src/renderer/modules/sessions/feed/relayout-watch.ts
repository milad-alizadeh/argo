// Calls `done` once every animation under `column` has finished. A close animation usually
// registers in the same commit, but Base UI documents a Chrome race where it registers a frame
// later (base-ui#3099), so the start events and a bounded timeout cover that case.
export function afterAnimations(column: HTMLElement, done: () => void) {
  let live = true
  let fallback = 0
  const awaitAll = (animations: Animation[]) => {
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (live) done()
    })
  }
  const stopListening = () => {
    column.removeEventListener('transitionrun', handleStart)
    column.removeEventListener('animationstart', handleStart)
    window.clearTimeout(fallback)
  }
  const handleStart = () => {
    stopListening()
    awaitAll(column.getAnimations({ subtree: true }))
  }
  const immediate = column.getAnimations({ subtree: true })
  if (immediate.length > 0) {
    awaitAll(immediate)
  } else {
    column.addEventListener('transitionrun', handleStart)
    column.addEventListener('animationstart', handleStart)
    fallback = window.setTimeout(handleStart, 500)
  }
  return () => {
    live = false
    stopListening()
  }
}

// Base UI collapses a closed panel in a React commit after its close animation ends, which can
// land after `finished` resolves, so any later change to the measured copy is read again.
export function watchMeasured(container: HTMLElement, reread: () => void) {
  let frame = 0
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(reread)
  })
  observer.observe(container, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  })
  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
  }
}
