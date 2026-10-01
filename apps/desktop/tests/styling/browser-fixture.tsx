import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import '../../src/platform/renderer/styles/globals.css'

export function mountSpecimen(content: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  flushSync(() => root.render(content))
  return {
    container,
    cleanup: () => {
      root.unmount()
      container.remove()
      document.documentElement.classList.remove('dark')
    },
  }
}

export function metrics(element: Element) {
  const style = getComputedStyle(element)
  return {
    size: style.fontSize,
    lineHeight: style.lineHeight,
    weight: style.fontWeight,
    tracking: style.letterSpacing,
  }
}
