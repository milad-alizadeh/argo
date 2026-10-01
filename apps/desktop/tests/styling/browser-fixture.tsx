import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import sessionsCatalog from '@/domains/sessions/renderer/locales/en.json'
import { initializeRendererI18n } from '@/platform/renderer/i18n/i18n'
import appCatalog from '@/platform/renderer/shell/locales/app.json'
import '../../src/platform/renderer/styles/globals.css'

export async function initializeShellAndSessionLocales() {
  await initializeRendererI18n({
    catalogs: { app: appCatalog, sessions: sessionsCatalog },
    defaultNamespace: 'app',
    language: 'en',
  })
}

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

export function resetAppearanceDocument() {
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
}

export function drawnColor(value: string) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Missing canvas')
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  return Array.from(context.getImageData(0, 0, 1, 1).data)
}
