// Where the renderer's main thread spent a trace: self time per trace event, the layouts script
// forced, and the JavaScript functions the CPU sampler caught most often. Enough to name a
// bottleneck without opening the trace; the trace itself is there for the rest.
import { shortSource } from './frame-recorder'
import type { TraceEvent, TraceFile } from './trace-recorder'

const TOP = 12
// A layout or style pass nested inside one of these was forced by script mid-frame.
const SCRIPT_EVENTS = new Set([
  'FunctionCall',
  'EventDispatch',
  'FireAnimationFrame',
  'TimerFire',
  'RunMicrotasks',
  'v8.callFunction',
])
const LAYOUT_EVENTS = new Set(['Layout', 'UpdateLayoutTree'])
const SAMPLER_NOISE = new Set(['(idle)', '(program)', '(root)'])

type CallFrame = { functionName: string; url: string; lineNumber: number }
type ProfileNode = { id: number; callFrame: CallFrame }
type ProfileData = {
  cpuProfile?: { nodes?: ProfileNode[]; samples?: number[] }
  timeDeltas?: number[]
}

const milliseconds = (microseconds: number) => Math.round(microseconds / 100) / 10

function top(totals: Map<string, number>) {
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, microseconds]) => ({ name, ms: milliseconds(microseconds) }))
}

// The page's main thread is the busiest `CrRendererMain`; DevTools and helper pages barely run.
function rendererMain(events: TraceEvent[]) {
  const mains = events.filter(
    (event) => event.name === 'thread_name' && event.args?.name === 'CrRendererMain',
  )
  const busy = (candidate: TraceEvent) =>
    events.filter((event) => event.pid === candidate.pid && event.tid === candidate.tid).length
  const main = mains.sort((a, b) => busy(b) - busy(a))[0]
  if (!main) throw new Error('The trace holds no renderer main thread.')
  return { pid: main.pid, tid: main.tid }
}

const end = (event: TraceEvent) => event.ts + (event.dur ?? 0)

const forcedByScript = (event: TraceEvent, open: TraceEvent[]) =>
  LAYOUT_EVENTS.has(event.name) && open.some((frame) => SCRIPT_EVENTS.has(frame.name))

// An event's self time is its duration less the time of the events nested directly inside it.
function selfTotals(complete: TraceEvent[], inner: Map<TraceEvent, number>) {
  const totals = new Map<string, number>()
  for (const event of complete) {
    const self = Math.max(0, (event.dur ?? 0) - (inner.get(event) ?? 0))
    totals.set(event.name, (totals.get(event.name) ?? 0) + self)
  }
  return totals
}

function selfTimes(events: TraceEvent[]) {
  const complete = events
    .filter((event) => event.ph === 'X' && event.dur !== undefined)
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0))
  const inner = new Map<TraceEvent, number>()
  const open: TraceEvent[] = []
  const forced = { count: 0, microseconds: 0 }
  for (const event of complete) {
    for (let last = open.at(-1); last && end(last) <= event.ts; last = open.at(-1)) open.pop()
    const parent = open.at(-1)
    if (parent) inner.set(parent, (inner.get(parent) ?? 0) + (event.dur ?? 0))
    if (forcedByScript(event, open)) {
      forced.count += 1
      forced.microseconds += event.dur ?? 0
    }
    open.push(event)
  }
  return {
    byEvent: top(selfTotals(complete, inner)),
    forcedLayouts: { count: forced.count, ms: milliseconds(forced.microseconds) },
  }
}

function hotFunctions(events: TraceEvent[]) {
  const nodes = new Map<number, CallFrame>()
  const totals = new Map<string, number>()
  for (const event of events.filter((candidate) => candidate.name === 'ProfileChunk')) {
    const data = (event.args?.data ?? {}) as ProfileData
    for (const node of data.cpuProfile?.nodes ?? []) nodes.set(node.id, node.callFrame)
    const samples = data.cpuProfile?.samples ?? []
    samples.forEach((sample, index) => {
      const frame = nodes.get(sample)
      if (!frame || SAMPLER_NOISE.has(frame.functionName)) return
      const line = frame.lineNumber >= 0 ? `:${frame.lineNumber + 1}` : ''
      const name = `${frame.functionName || '(anonymous)'} ${shortSource(frame.url)}${line}`.trim()
      totals.set(name, (totals.get(name) ?? 0) + (data.timeDeltas?.[index] ?? 0))
    })
  }
  return top(totals)
}

export function summariseTrace(trace: TraceFile) {
  const events = Array.isArray(trace) ? trace : trace.traceEvents
  const { pid, tid } = rendererMain(events)
  const main = events.filter((event) => event.pid === pid && event.tid === tid)
  return {
    ...selfTimes(main),
    hotFunctions: hotFunctions(events.filter((event) => event.pid === pid)),
  }
}
