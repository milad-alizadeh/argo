import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = '/private/tmp/claude-501/-Users-milad-Developer-argo/b12f6bd5-6979-45e2-b243-670b7a78b7c3/scratchpad/interface'
fs.mkdirSync(OUT, { recursive: true })

const stories = [
  'tickets-screen--backlog',
  'tickets-screen--folded-parent',
  'tickets-screen--linear-backlog',
  'tickets-ticket-detail--default',
  'tickets-ticket-detail--change-state',
  'tickets-ticket-detail--linear',
  'tickets-connect-source-form--switch-account',
  'tickets-sidebar--sign-in-notice',
  'tickets-screen--sign-in-notice',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } })
const logs = []
page.on('console', (msg) => {
  if (msg.type() === 'error') logs.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))

for (const id of stories) {
  logs.length = 0
  const url = `http://localhost:6211/iframe.html?id=${id}&viewMode=story`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${id}.png`, fullPage: true })
  if (logs.length) fs.writeFileSync(`${OUT}/${id}.errors.txt`, logs.join('\n'))
  console.log('captured', id)
}

// Dark appearance pass for a couple of key stories, if a toolbar/global toggle exists.
for (const id of ['tickets-screen--backlog', 'tickets-ticket-detail--default']) {
  const url = `http://localhost:6211/iframe.html?id=${id}&viewMode=story&globals=theme:dark`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${id}.dark.png`, fullPage: true })
  console.log('captured dark', id)
}

// Keyboard interaction: tab into the backlog, open a row's status menu with keys, escape.
{
  const url = `http://localhost:6211/iframe.html?id=tickets-screen--backlog&viewMode=story`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.screenshot({ path: `${OUT}/keyboard-tab-focus.png`, fullPage: true })
  const active = await page.evaluate(() => {
    const element = document.activeElement
    return element
      ? { tag: element.tagName, aria: element.getAttribute('aria-label'), cls: element.className }
      : null
  })
  fs.writeFileSync(`${OUT}/keyboard-tab-focus.json`, JSON.stringify(active, null, 2))
  console.log('active element', active)
}

// Focus a status trigger directly and open with keyboard.
{
  const url = `http://localhost:6211/iframe.html?id=tickets-screen--backlog&viewMode=story`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const trigger = page.locator('button[aria-label^="Status:"], button[aria-label*=":"]').first()
  const count = await page.locator('[aria-haspopup]').count()
  console.log('aria-haspopup count', count)
  await trigger.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/keyboard-status-open.png`, fullPage: true })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const focusedAfterEscape = await page.evaluate(() => {
    const element = document.activeElement
    return element ? { tag: element.tagName, aria: element.getAttribute('aria-label') } : null
  })
  fs.writeFileSync(`${OUT}/keyboard-status-escape.json`, JSON.stringify(focusedAfterEscape, null, 2))
  console.log('focus after escape', focusedAfterEscape)
}

await browser.close()
console.log('done')
