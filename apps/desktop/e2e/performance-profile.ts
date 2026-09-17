import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestInfo } from '@playwright/test'
import type { CDPSession, Page } from 'playwright-core'

const PROFILE_ENVIRONMENT_VARIABLE = 'ARGO_E2E_PROFILE'
const CPU_PROFILE_CATEGORIES = [
  'blink',
  'devtools.timeline',
  'disabled-by-default-v8.cpu_profiler',
  'disabled-by-default-v8.cpu_profiler.hires',
  'renderer.scheduler',
  'v8.execute',
].join(',')

type ProfileEvent = Record<string, unknown>

type CaseTiming = {
  name: string
  wallTimeMs: number
}

type TraceStream = {
  stream: string
}

type TraceChunk = {
  data: string
  eof: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readTraceStream(value: unknown): TraceStream {
  if (isRecord(value) && typeof value.stream === 'string') return { stream: value.stream }
  throw new Error('Chromium finished the CPU trace without a stream.')
}

function readTraceChunk(value: unknown): TraceChunk {
  if (isRecord(value) && typeof value.data === 'string' && typeof value.eof === 'boolean') {
    return { data: value.data, eof: value.eof }
  }
  throw new Error('Chromium returned an invalid CPU trace chunk.')
}

function readTraceEvents(value: unknown): ProfileEvent[] {
  if (!isRecord(value) || !Array.isArray(value.traceEvents)) {
    throw new Error('Chromium returned an invalid CPU trace.')
  }
  return value.traceEvents.filter(isRecord)
}

async function readStream(session: CDPSession, stream: string) {
  let trace = ''
  let eof = false
  while (!eof) {
    const chunk = readTraceChunk(await session.send('IO.read', { handle: stream }))
    trace += chunk.data
    eof = chunk.eof
  }
  return readTraceEvents(JSON.parse(trace))
}

export function performanceProfileEnabled() {
  return process.env[PROFILE_ENVIRONMENT_VARIABLE] === '1'
}

// Keeps each renderer process's samples until the flow has restarted the app, then writes one
// Chrome trace that the existing hot-functions reader can inspect.
export class FlowPerformanceProfile {
  readonly #flow: string
  readonly #root: Promise<string>
  readonly #events: ProfileEvent[] = []
  readonly #timings: CaseTiming[] = []
  #session: CDPSession | undefined
  #completion: Promise<TraceStream> | undefined

  constructor(flow: string) {
    this.#flow = flow
    this.#root = mkdtemp(path.join(os.tmpdir(), `argo-${flow}-profile-`))
  }

  async start(page: Page) {
    if (this.#session) return
    const session = await page.context().newCDPSession(page)
    this.#completion = new Promise((resolve) => {
      session.once('Tracing.tracingComplete', (result) => resolve(readTraceStream(result)))
    })
    await session.send('Tracing.start', {
      categories: CPU_PROFILE_CATEGORIES,
      transferMode: 'ReturnAsStream',
    })
    this.#session = session
  }

  async stop() {
    const session = this.#session
    const completion = this.#completion
    this.#session = undefined
    this.#completion = undefined
    if (!session || !completion) return
    try {
      await session.send('Tracing.end')
      const { stream } = await completion
      this.#events.push(...(await readStream(session, stream)))
    } finally {
      await session.detach().catch(() => undefined)
    }
  }

  recordCase(testInfo: TestInfo) {
    this.#timings.push({ name: testInfo.title, wallTimeMs: testInfo.duration })
  }

  async write() {
    await this.stop()
    const root = await this.#root
    const trace = path.join(root, `${this.#flow}-cpu-trace.json`)
    const timings = path.join(root, `${this.#flow}-timings.json`)
    await Promise.all([
      writeFile(trace, JSON.stringify({ traceEvents: this.#events })),
      writeFile(timings, JSON.stringify({ cases: this.#timings }, null, 2)),
    ])
    console.log(`${this.#flow} CPU trace: ${trace}`)
    console.log(`${this.#flow} timings: ${timings}`)
    console.log(`Read hot functions: jq -r -f scripts/profiling/hot-functions.jq ${trace}`)
  }
}
