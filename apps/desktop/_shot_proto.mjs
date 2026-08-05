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
  {
    waitUntil: 'commit',
    timeout: 90000,
  },
)
await page.waitForSelector('#storybook-root > *', { timeout: 90000 })
await page.waitForTimeout(1500)

// Story opens at variant A (index 1). Cycle with ArrowRight, shooting each.
const names = ['A-gutter', 'B-chapters', 'C-lens', 'D-strip', '0-shipped']
for (const name of names) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/${name}.png` })
  if (name === 'C-lens') {
    // extra shots: a lens applied, and the palette
    await page.getByLabel('only the rows that changed a file or produced a picture').click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${out}/C-lens-changed.png` })
    await page.getByLabel('everything observed, in order').click()
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${out}/C-lens-palette.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  await page.keyboard.press('ArrowRight')
}
await browser.close()
