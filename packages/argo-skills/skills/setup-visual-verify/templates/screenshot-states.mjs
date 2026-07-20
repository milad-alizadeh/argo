#!/usr/bin/env node
// Deterministic screenshots of UI states for visual verification.
// Usage: node scripts/screenshot-states.mjs <states.json> [out-dir]
// states.json: [{ "name": "status-row", "url": "http://localhost:6006/iframe.html?id=cockpit-statusrow--default&viewMode=story",
//                 "waitFor": ".status-row", "fullPage": false, "colorScheme": "dark" }]
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const [statesPath, outDir = 'screenshots'] = process.argv.slice(2)
if (!statesPath) {
  console.error('usage: screenshot-states.mjs <states.json> [out-dir]')
  process.exit(1)
}

const states = JSON.parse(await readFile(statesPath, 'utf8'))
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  for (const state of states) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
      colorScheme: state.colorScheme ?? 'light',
    })
    await page.goto(state.url, { waitUntil: 'networkidle' })
    if (state.waitFor) await page.waitForSelector(state.waitFor)
    // Freeze motion so identical states always produce identical pixels.
    await page.addStyleTag({
      content:
        '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }',
    })
    const file = path.join(outDir, `${state.name}.png`)
    await page.screenshot({ path: file, fullPage: state.fullPage ?? false })
    console.log(file)
    await page.close()
  }
} finally {
  await browser.close()
}
