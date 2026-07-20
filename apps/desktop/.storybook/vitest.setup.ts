import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll, expect } from 'vitest'
import { page } from 'vitest/browser'
import preview from './preview'

// Owning setProjectAnnotations makes this file the source of truth for project annotations, so
// @storybook/addon-vitest skips injecting its own. It loads only in the Vitest run — never in
// `storybook dev` — which is why the browser-only toMatchScreenshot matcher is safe here.
const project = setProjectAnnotations([
  preview,
  {
    // Screenshot every story after it renders; the baseline name is the stable story id.
    async afterEach({ canvasElement, id }) {
      const canvas = canvasElement as HTMLElement
      // A story excludes a volatile region (terminal, live gauge) from the diff by marking it
      // [data-vrt-mask]; masked pixels are painted over before the comparison. Playwright's mask
      // wants Locators, not raw DOM nodes, so wrap each element.
      const mask = Array.from(canvas.querySelectorAll('[data-vrt-mask]')).map((el) =>
        page.elementLocator(el),
      )
      // Plain expect(), NOT expect.element(): the latter retries until it passes, so a missing
      // baseline (a permanent failure) hangs to the test timeout instead of reporting itself.
      await expect(canvas).toMatchScreenshot(id, { screenshotOptions: { mask } })
    },
  },
])

beforeAll(project.beforeAll)
