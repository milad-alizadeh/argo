// The readings themselves, kept beside each other so the units are declared once: milliseconds
// from `performance.now()` for a frame, whole percent and kilobytes from `app.getAppMetrics()`.
const IDLE_MS = 3000
const SETTLE_MS = 1000

export const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

export function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)]
}

// The window starts hidden, and a hidden window paints nothing, so the entry only exists once it
// is shown. Waiting for it is the difference between a first-draw reading and a zero.
export function firstPaint(page) {
  return page.evaluate(() => {
    const entry = () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
    return new Promise((resolve) => {
      if (entry()) return resolve(entry())
      const timer = setTimeout(() => resolve(0), 5000)
      new PerformanceObserver(() => {
        if (!entry()) return
        clearTimeout(timer)
        resolve(entry())
      }).observe({ type: 'paint', buffered: true })
    })
  })
}

// One idle window of `requestAnimationFrame` deltas. An idle cockpit schedules no work of its own,
// so what this reads is the cost of the compositor keeping the shell on screen.
export function frameDeltas(page) {
  return page.evaluate((duration) => {
    return new Promise((resolve) => {
      const deltas = []
      const start = performance.now()
      let last = start
      const tick = (now) => {
        deltas.push(now - last)
        last = now
        if (now - start < duration) requestAnimationFrame(tick)
        else resolve(deltas.slice(1))
      }
      requestAnimationFrame(tick)
    })
  }, IDLE_MS)
}

// `percentCPUUsage` is the share since the previous call, so the first call only opens the window
// this one closes.
export async function processLoad(application) {
  const read = () =>
    application.evaluate(({ app }) =>
      app.getAppMetrics().map((metric) => ({
        type: metric.type,
        cpu: metric.cpu.percentCPUUsage,
        memoryKb: metric.memory?.workingSetSize ?? 0,
      })),
    )
  await read()
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
  const metrics = await read()
  return {
    cpuPercent: Number(metrics.reduce((total, one) => total + one.cpu, 0).toFixed(2)),
    memoryMb: Number((metrics.reduce((t, one) => t + one.memoryKb, 0) / 1024).toFixed(1)),
  }
}
