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
      // Plain expect(), NOT expect.element(): expect.element retries the assertion until it
      // passes, so a *permanent* "no reference screenshot" failure (a missing baseline in CI)
      // gets retried until the test timeout instead of failing fast. The matcher does its own
      // capture-stability retries regardless, so nothing is lost.
      await expect(canvas).toMatchScreenshot(id, { screenshotOptions: { mask } })
    },
  },
])

beforeAll(project.beforeAll)
