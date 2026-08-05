import { chromium } from 'playwright'

const out = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1500, height: 950 },
  deviceScaleFactor: 2,
})
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
await page.goto(
  'http://localhost:6017/iframe.html?id=prototype-feed-navigation--variants&viewMode=story',
  { waitUntil: 'commit', timeout: 90000 },
)
await page.waitForSelector('#storybook-root > *', { timeout: 90000 })
await page.waitForTimeout(1500)

// Story opens at F1 (chips bar) — the new default.
await page.screenshot({ path: `${out}/F1-chips.png` })

// F2 — right rail.
await page.getByRole('button', { name: 'Next variant' }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/F2-rail.png` })

// F3 — seam chip: scroll the feed to the turn that spawned delegates so its seam is the stuck one.
await page.getByRole('button', { name: 'Next variant' }).click()
await page.waitForTimeout(800)
await page.evaluate(() => {
  const chip = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('subagents'),
  )
  const section = chip.closest('section')
  const root = section.closest('.overflow-y-auto')
  root.scrollTop = section.offsetTop - root.offsetTop + 40
})
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/F3-seam.png` })

// F3 with the dropdown open.
await page.locator('button', { hasText: 'subagents' }).first().click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/F3-seam-open.png` })

await browser.close()
