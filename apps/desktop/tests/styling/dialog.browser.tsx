import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { SAMPLE_PICTURE } from '@/domains/sessions/renderer/feed/content/feed-samples'
import { ImageLightbox } from '@/domains/sessions/renderer/feed/content/image-lightbox'
import { THEMES } from '@/platform/contract/appearance'
import * as Registry from '@/platform/renderer/components/ui/dialog'
import { AppearanceDialog } from '@/platform/renderer/shell/components/appearance-dialog'
import {
  initializeShellAndSessionLocales,
  metrics,
  mountSpecimen,
  resetAppearanceDocument,
} from './browser-fixture'
import * as Pristine from './fixtures/pristine-dialog'

let cleanup = () => {}
afterEach(() => {
  cleanup()
  resetAppearanceDocument()
})
beforeAll(initializeShellAndSessionLocales)

function specimen(components: typeof Registry) {
  const { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } = components
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registry default</DialogTitle>
          <DialogDescription>Reviewed generated Dialog</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

function slot(name: string) {
  const element = document.querySelector(`[data-slot="dialog-${name}"]`)
  if (!element) throw new Error(`Missing Dialog ${name}`)
  return element
}

function snapshot() {
  const content = slot('content')
  const overlay = getComputedStyle(slot('overlay'))
  const style = getComputedStyle(content)
  const close = slot('close')
  const icon = close.querySelector('svg')
  if (!icon) throw new Error('Missing close icon')
  return {
    content: {
      ...metrics(content),
      font: style.fontFamily,
      background: style.backgroundColor,
      color: style.color,
      radius: style.borderRadius,
      padding: style.padding,
      ring: style.boxShadow,
    },
    title: { ...metrics(slot('title')), font: getComputedStyle(slot('title')).fontFamily },
    description: metrics(slot('description')),
    close: metrics(close),
    icon: { width: getComputedStyle(icon).width, height: getComputedStyle(icon).height },
    overlay: { background: overlay.backgroundColor, filter: overlay.backdropFilter },
  }
}

async function mount(content: ReactNode) {
  const mounted = mountSpecimen(content)
  cleanup = mounted.cleanup
  await expect.poll(() => document.querySelector('[data-slot="dialog-content"]')).not.toBeNull()
  await expect.poll(() => getComputedStyle(slot('content')).opacity).toBe('1')
  return mounted
}

async function baseline(theme: (typeof THEMES)[number], dark: boolean) {
  await page.viewport(1024, 720)
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', dark)
  await mount(specimen(Pristine))
  const defaults = snapshot()
  cleanup()
  document.documentElement.classList.toggle('dark', dark)
  return defaults
}

describe.each(THEMES)('%s Dialog', (theme) => {
  describe.each(['light', 'dark'])('%s reviewed Dialog defaults', (appearance) => {
    test('native registry Dialog matches its independent pristine generated comparator', async () => {
      const defaults = await baseline(theme, appearance === 'dark')
      await mount(specimen(Registry))
      expect(snapshot()).toEqual(defaults)
      expect(slot('content').closest('body')).toBe(document.body)
    })

    test('Appearance preserves Dialog typography, surface, spacing, overlay and close geometry', async () => {
      const defaults = await baseline(theme, appearance === 'dark')
      await mount(
        <AppearanceDialog
          state={{ theme, appearance: 'system', dark: appearance === 'dark', revision: 0 }}
          open
          onOpenChange={() => {}}
          onChoose={async () => true}
        />,
      )
      expect(snapshot()).toEqual(defaults)
      expect(getComputedStyle(slot('content')).maxWidth).toBe('448px')
    })

    test('media keeps registry title, description and control metrics in supported slots', async () => {
      const defaults = await baseline(theme, appearance === 'dark')
      const mounted = mountSpecimen(
        <ImageLightbox
          image={{
            source: SAMPLE_PICTURE,
            title: 'Media preview',
            alt: 'Reference',
            openLabel: 'Open preview',
          }}
        />,
      )
      cleanup = mounted.cleanup
      await userEvent.click(page.getByRole('button', { name: 'Open preview' }))
      await expect.poll(() => document.querySelector('[data-slot="dialog-content"]')).not.toBeNull()
      expect({
        ...metrics(slot('title')),
        font: getComputedStyle(slot('title')).fontFamily,
      }).toEqual(defaults.title)
      expect(metrics(slot('description'))).toEqual(defaults.description)
      expect(
        metrics(page.getByRole('button', { name: 'Close image preview', exact: true }).element()),
      ).toEqual(defaults.close)
      const content = getComputedStyle(slot('content'))
      expect(content.backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(content.borderRadius).toBe('0px')
      expect(slot('content').getBoundingClientRect().width).toBe(window.innerWidth)
      expect(slot('content').getBoundingClientRect().height).toBe(window.innerHeight)
      const overlay = getComputedStyle(slot('overlay'))
      expect(overlay.backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(overlay.backdropFilter).toBe('none')
    })
  })
})
