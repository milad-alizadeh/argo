/**
 * The harness's host. Three jobs beyond serving files.
 *
 * `?delay=` on `/image.png` and `/font.ttf` holds the response back, so the image and web-font
 * arms wait on a real resource load through the real network stack rather than on a `setTimeout`
 * pretending to be one. A simulated wait would measure the simulation.
 *
 * `/font.ttf` serves a real system face, chosen so its metrics differ from the sans-serif
 * fallback the arm falls back to. A synthetic font would not reflow anything, and the reflow is
 * the whole finding.
 *
 * `POST /results` writes the run to disk. The browser is where the numbers are produced and the
 * repo is where they have to end up, and this is the shortest path between them that does not
 * involve a human copying a console.
 *
 * Run: `bun serve.ts` then open http://localhost:8793/
 */

import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { png } from './png'

const DIR = new URL('.', import.meta.url).pathname
const PORT = 8793

/**
 * A face that is present on every macOS and metrically unlike the sans-serif fallback.
 *
 * Courier New is first for the second reason, not the first. Georgia was tried and measured a
 * ZERO height delta against `-apple-system` — both give 48px for the arm's paragraph at 600px,
 * so the swap reflowed nothing and the sample proved nothing about late faces. Courier New
 * moves the same paragraph to 62px. That the choice matters this much is itself reported: a
 * fallback whose metrics match the real face makes the reflow disappear.
 */
const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Courier New.ttf',
  '/System/Library/Fonts/Supplemental/Georgia.ttf',
  '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
]

const fontPath = FONT_CANDIDATES.find((p) => existsSync(p))

/** A 240x120 PNG, generated so the rig carries no binary fixture and no typo. */
const IMAGE = new Uint8Array(png(240, 120))

const delayOf = (url: URL): number => Math.max(0, Number(url.searchParams.get('delay') ?? 0) || 0)
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/results') {
      const body = await request.text()
      const partial = url.searchParams.get('arms') === 'async'
      const out = join(DIR, partial ? 'results-async.json' : 'results.json')
      writeFileSync(out, body)
      console.log(`wrote ${out} (${body.length} bytes)`)
      return new Response('ok')
    }

    if (url.pathname === '/image.png') {
      await sleep(delayOf(url))
      return new Response(IMAGE, {
        headers: { 'content-type': 'image/png', 'cache-control': 'no-store' },
      })
    }

    if (url.pathname === '/font.ttf') {
      if (!fontPath) return new Response('no system face found', { status: 404 })
      await sleep(delayOf(url))
      return new Response(Bun.file(fontPath), {
        headers: { 'content-type': 'font/ttf', 'cache-control': 'no-store' },
      })
    }

    const name = url.pathname === '/' ? 'harness.html' : url.pathname.slice(1)
    const file = Bun.file(join(DIR, name))
    if (!(await file.exists())) return new Response('not found', { status: 404 })
    return new Response(file, { headers: { 'cache-control': 'no-store' } })
  },
})

console.log(`serving ${DIR} on http://localhost:${PORT}/  (font: ${fontPath ?? 'MISSING'})`)
