// What the page itself saw while a scenario ran: one coverage reading per animation frame, and
// every long animation frame Chromium attributed to a script.
import type { Page } from 'playwright-core'
import { type CoverageReading, mergeRows, sampleCoverage } from './coverage-sample'

export type Coverage = { viewport: string; rows: string }

export type FrameSample = CoverageReading & { at: number }

export type LongFrame = {
  duration: number
  blockingDuration: number
  scripts: { source: string; invoker: string; duration: number; forcedLayoutMs: number }[]
}

export async function startRecording(page: Page, coverage: Coverage) {
  // The bundler renames a function and its callers together, so the two sources stay in step.
  const functions = [mergeRows, sampleCoverage].map((source) => source.toString()).join('\n')
  await page.evaluate(`window.argoSampleCoverage = (() => { ${functions}
    return ${sampleCoverage.name} })()`)
  await page.evaluate((coverage) => {
    const recording = { frames: [], longFrames: [], running: true }
    const tick = (at) => {
      if (!recording.running) return
      recording.frames.push({ at, ...window.argoSampleCoverage(coverage) })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    recording.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) recording.longFrames.push(entry.toJSON())
    })
    recording.observer.observe({ type: 'long-animation-frame' })
    window.argoProfileRecording = recording
  }, coverage)
}

export async function stopRecording(
  page: Page,
): Promise<{ frames: FrameSample[]; longFrames: LongFrame[] }> {
  const raw = await page.evaluate(() => {
    const recording = window.argoProfileRecording
    recording.running = false
    recording.observer.takeRecords().forEach((entry) => {
      recording.longFrames.push(entry.toJSON())
    })
    recording.observer.disconnect()
    window.argoProfileRecording = undefined
    return { frames: recording.frames, longFrames: recording.longFrames }
  })
  return {
    frames: raw.frames,
    longFrames: raw.longFrames.map((entry) => ({
      duration: entry.duration,
      blockingDuration: entry.blockingDuration,
      scripts: entry.scripts.map((script) => ({
        source: `${script.sourceFunctionName || '(anonymous)'} ${shortSource(script.sourceURL)}`,
        invoker: script.invoker,
        duration: script.duration,
        forcedLayoutMs: script.forcedStyleAndLayoutDuration,
      })),
    })),
  }
}

// A dev server URL carries its origin and a cache-busting query; neither helps a reader find code.
export function shortSource(url: string) {
  if (!url) return ''
  return url.replace(/^[a-z]+:\/\/[^/]*/, '').replace(/\?.*$/, '')
}

// The display's frame period, read from an idle stretch before the scenario starts to move.
export function idleFramePeriod(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const deltas: number[] = []
        let last = 0
        const tick = (at: number) => {
          if (last) deltas.push(at - last)
          last = at
          if (deltas.length < 60) requestAnimationFrame(tick)
          else resolve(deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)] ?? 0)
        }
        requestAnimationFrame(tick)
      }),
  )
}
