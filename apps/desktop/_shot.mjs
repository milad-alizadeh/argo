import { chromium } from 'playwright'

const out = process.argv[2]
const stories = [
  ['embedded', 'sessions-activity-mediarow--embedded'],
  ['from-disk', 'sessions-activity-mediarow--from-disk'],
  ['undecodable', 'sessions-activity-mediarow--file-gone'],
  ['on-demand', 'sessions-activity-mediarow--decode-on-demand'],
  ['thrice', 'sessions-activity-mediarow--same-path-thrice'],
  ['pane', 'sessions-activity--two-pane'],
]
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 1100 },
  deviceScaleFactor: 2,
})
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
for (const [name, id] of stories) {
  await page.goto(`http://localhost:6006/iframe.html?id=${id}&viewMode=story`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForSelector('#storybook-root > *', { timeout: 25000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
}
await browser.close()
