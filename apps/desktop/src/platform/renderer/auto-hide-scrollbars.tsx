import { type ReactNode, useEffect } from 'react'

const SCROLLBAR_IDLE_DELAY_MS = 700
const SCROLLBAR_FADE_DURATION_MS = 300

export function AutoHideScrollbars({ children }: { children: ReactNode }) {
  useEffect(() => {
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
    const fades = new Map<HTMLElement, Animation>()
    const reveal = (element: HTMLElement) => {
      fades.get(element)?.cancel()
      fades.delete(element)
      clearTimeout(timers.get(element))
      element.setAttribute('data-scrollbar-active', '')
      timers.set(
        element,
        setTimeout(() => {
          const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          if (!reducedMotion) {
            const fade = element.animate(
              [{ '--scrollbar-visibility': '1' }, { '--scrollbar-visibility': '0' }],
              { duration: SCROLLBAR_FADE_DURATION_MS, easing: 'ease-out' },
            )
            fades.set(element, fade)
            fade.onfinish = () => fades.delete(element)
          }
          element.removeAttribute('data-scrollbar-active')
          timers.delete(element)
        }, SCROLLBAR_IDLE_DELAY_MS),
      )
    }
    const onScroll = (event: Event) => {
      const target = event.target === document ? document.scrollingElement : event.target
      if (!(target instanceof HTMLElement)) return
      if (
        target !== document.documentElement &&
        target !== document.body &&
        !target.hasAttribute('tabindex')
      )
        target.tabIndex = 0
      reveal(target)
      const scrollArea = target.closest<HTMLElement>('[data-slot="scroll-area"]')
      if (scrollArea && scrollArea !== target) reveal(scrollArea)
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      for (const fade of fades.values()) fade.cancel()
      for (const [element, timer] of timers) {
        clearTimeout(timer)
        element.removeAttribute('data-scrollbar-active')
      }
    }
  }, [])
  return children
}
