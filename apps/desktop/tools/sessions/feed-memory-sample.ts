// Memory of the renderer after a forced GC, so a sample shows what is held rather than not yet collected.
import { execFileSync } from 'node:child_process'
import type { ElectronApplication, Page } from 'playwright-core'

export type MemorySample = {
  label: string
  heapUsedMb: number
  heapTotalMb: number
  domNodes: number
  listeners: number
  documents: number
  workingSetMb: number
  footprintMb: number | null
}

const MB_PER_UNIT = { KB: 1 / 1024, MB: 1, GB: 1024 }

// macOS `footprint` reports what Activity Monitor shows as the process memory.
function footprintMb(pid: number) {
  try {
    const out = execFileSync('footprint', ['-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const match = out.match(/Footprint:\s*([\d.]+)\s*(KB|MB|GB)/)
    if (!match) return null
    const value = Number(match[1])
    return Math.round(value * MB_PER_UNIT[match[2] as keyof typeof MB_PER_UNIT])
  } catch {
    return null
  }
}

export async function sample(
  label: string,
  page: Page,
  application: ElectronApplication,
): Promise<MemorySample> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.enable')
  for (let pass = 0; pass < 3; pass += 1) await cdp.send('HeapProfiler.collectGarbage')
  await page.waitForTimeout(500)
  const usage = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number; totalSize: number }
  const counters = (await cdp.send('Memory.getDOMCounters')) as {
    documents: number
    nodes: number
    jsEventListeners: number
  }
  await cdp.detach()
  const pid = await application.evaluate(({ webContents }) =>
    webContents.getAllWebContents()[0].getOSProcessId(),
  )
  return {
    label,
    heapUsedMb: Math.round(usage.usedSize / 1048576),
    heapTotalMb: Math.round(usage.totalSize / 1048576),
    domNodes: counters.nodes,
    listeners: counters.jsEventListeners,
    documents: counters.documents,
    workingSetMb: await processWorkingSetMb(application),
    footprintMb: footprintMb(pid),
  }
}

export async function processWorkingSetMb(application: ElectronApplication) {
  const kilobytes = await application.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .filter((metric) => metric.type === 'Renderer' || metric.type === 'Tab')
      .reduce((total, metric) => total + (metric.memory?.workingSetSize ?? 0), 0),
  )
  return Math.round(kilobytes / 1024)
}

export function printSamples(label: string, samples: MemorySample[]) {
  console.log(`\n${label} after forced GC`)
  console.log(
    'sample | heapUsedMb | heapTotalMb | domNodes | listeners | documents | workingSetMb | footprintMb',
  )
  for (const one of samples) {
    console.log(
      [
        one.label,
        one.heapUsedMb,
        one.heapTotalMb,
        one.domNodes,
        one.listeners,
        one.documents,
        one.workingSetMb,
        one.footprintMb ?? '-',
      ].join(' | '),
    )
  }
}
