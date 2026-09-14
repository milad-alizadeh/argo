// Calls `reread` on the frame after any change to the measured copy, until the returned stop runs.
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
