import { type RefObject, useLayoutEffect, useState } from 'react'

export function useComposerFadeTop({
  composerElement,
  workspaceElement,
}: {
  composerElement: RefObject<HTMLElement | null>
  workspaceElement: RefObject<HTMLElement | null>
}) {
  const [fadeTop, setFadeTop] = useState<number | null>(null)

  useLayoutEffect(() => {
    const composer = composerElement.current
    const workspace = workspaceElement.current
    if (composer === null || workspace === null) return
    const measure = () => {
      const nextTop = composer.getBoundingClientRect().top - workspace.getBoundingClientRect().top
      setFadeTop((previous) => (previous === nextTop ? previous : nextTop))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(composer)
    observer.observe(workspace)
    measure()
    return () => observer.disconnect()
  }, [composerElement, workspaceElement])

  return fadeTop
}
