// A Chrome trace of one scenario run, recorded on the page's own debugging session so the dev
// target and the packaged target take the same path. The file opens in DevTools and Perfetto.
import { writeFile } from 'node:fs/promises'
import type { CDPSession } from 'playwright-core'

// The DevTools Performance panel's own set, plus the CPU sampler.
const CATEGORIES = [
  '-*',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-v8.cpu_profiler',
  'blink.user_timing',
  'latencyInfo',
  'toplevel',
  'v8.execute',
]

const FILMSTRIP = 'disabled-by-default-devtools.screenshot'

export async function startTrace(cdp: CDPSession, screenshots: boolean) {
  const includedCategories = screenshots ? [...CATEGORIES, FILMSTRIP] : CATEGORIES
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories, recordMode: 'recordAsMuchAsPossible' },
    transferMode: 'ReturnAsStream',
  })
}

async function readStream(cdp: CDPSession, handle: string) {
  const parts: string[] = []
  for (;;) {
    const chunk = await cdp.send('IO.read', { handle })
    parts.push(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data)
    if (chunk.eof) break
  }
  await cdp.send('IO.close', { handle })
  return parts.join('')
}

export async function stopTrace(cdp: CDPSession, file: string) {
  const complete = new Promise<string>((resolve, reject) => {
    cdp.once('Tracing.tracingComplete', (event) => {
      if (event.stream) resolve(event.stream)
      else reject(new Error('Chromium finished the trace without a stream to read it from.'))
    })
  })
  await cdp.send('Tracing.end')
  const text = await readStream(cdp, await complete)
  await writeFile(file, text)
  return JSON.parse(text) as TraceFile
}

export type TraceEvent = {
  name: string
  ph: string
  pid: number
  tid: number
  ts: number
  dur?: number
  id?: string
  args?: Record<string, unknown>
}

export type TraceFile = { traceEvents: TraceEvent[] } | TraceEvent[]
