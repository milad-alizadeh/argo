import { type RefObject, useLayoutEffect, useState } from 'react'

export function useComposerFadeHeight(composerElement: RefObject<HTMLElement | null>) {
  const [fadeHeight, setFadeHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const element = composerElement.current
    const contextBar = element?.querySelector<HTMLElement>('[data-component="SessionContextBar"]')
    if (element === null || contextBar === null || contextBar === undefined) return
    const measure = () => {
      const nextHeight =
        contextBar.getBoundingClientRect().bottom - element.getBoundingClientRect().top
      setFadeHeight((previous) => (previous === nextHeight ? previous : nextHeight))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observer.observe(contextBar)
    measure()
    return () => observer.disconnect()
  }, [composerElement])

  return fadeHeight
}
