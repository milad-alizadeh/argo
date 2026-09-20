import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from 'playwright-core'
import { renderStateConfig } from './render-desktop-state-config.mts'

const story = process.env.STORYBOOK_STATE ?? 'desktop-appsurface--default'
const storybookUrl = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006'
const render = renderStateConfig(story)
const outputDir = path.resolve(process.cwd(), '../../docs/designs/renders')
const outFile = path.resolve(outputDir, render.outputName)

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  })

  await page.goto(`${storybookUrl}/iframe.html?id=${story}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(render.selector, { timeout: 10000 })

  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }',
  })

  await page.screenshot({ path: outFile, fullPage: false })
  console.log(outFile)
  await page.close()
} finally {
  await browser.close()
}
