import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll, expect } from 'vitest'
import preview from './preview'

// Owning setProjectAnnotations makes this file the source of truth for project annotations, so
// @storybook/addon-vitest skips injecting its own. It loads only in the Vitest run — never in
// `storybook dev` — which is why the browser-only toMatchScreenshot matcher is safe here.
const project = setProjectAnnotations([
  preview,
  {
    // Screenshot every story after it renders; the baseline name is the stable story id.
    async afterEach({ canvasElement, id }) {
      // A story excludes a volatile region (terminal, live gauge) from the diff by marking it
      // [data-vrt-mask]; masked pixels are painted over before the comparison.
      const canvas = canvasElement as HTMLElement
      const mask = Array.from(canvas.querySelectorAll('[data-vrt-mask]'))
      await expect.element(canvas).toMatchScreenshot(id, { screenshotOptions: { mask } })
    },
  },
])

beforeAll(project.beforeAll)
