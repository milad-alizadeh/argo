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

// Story now opens at E (the synthesis).
await page.screenshot({ path: `${out}/E-top.png` })

// Scroll mid-way: sticky seam + gutter snap.
const feed = page.locator('[data-anchor]').first()
await feed.evaluate((el) => {
  el.closest('.overflow-y-auto').scrollTop = 2200
})
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/E-mid.png` })

// Bottom: shots turn with the thumbnail strip.
await feed.evaluate((el) => {
  const root = el.closest('.overflow-y-auto')
  root.scrollTop = root.scrollHeight
})
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/E-bottom.png` })

// Lightbox: click the first thumbnail.
await page.locator('img[alt*="header"], img[alt*="/tmp/argo-shots"]').first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/E-lightbox.png` })
await page.keyboard.press('Escape')
await page.mouse.click(200, 500)
await page.waitForTimeout(300)

// Subagent scope: scroll to the delegate rows and click one.
await page.locator('[data-component="SubagentRow"]').first().click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/E-subagent.png` })

await browser.close()
