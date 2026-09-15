// Profiles one screen interaction on request (#2228) and prints what it cost as JSON.
//
//   bun run profile -- feed-scroll                  # the running dev instance (`bun run dev`)
//   bun run profile -- feed-scroll --packaged       # a seeded copy of the packaged app
//
// Options: --session <id> to open first, --runs N, --speed px/s, --distance px, --screenshots,
// --turns N and --transcript <file> for the packaged fixture, --out <dir> for the traces.
// Nothing here holds the real keyboard or mouse.
import { mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { idleFramePeriod, startRecording, stopRecording } from './frame-recorder'
import { summariseRun } from './run-summary'
import type { ProfileOptions, Scenario } from './scenario'
import { SCENARIOS } from './scenarios'
import { devTarget, packagedTarget, type Target } from './targets'
import { startTrace, stopTrace } from './trace-recorder'
import { summariseTrace } from './trace-summary'

// Chromium throttles a covered window to about one frame a second; above this the display did
// not set the pace and no reading from the run means anything.
const THROTTLED_PERIOD_MS = 40

function readArguments() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      packaged: { type: 'boolean', default: false },
      runs: { type: 'string', default: '3' },
      speed: { type: 'string', default: '6000' },
      distance: { type: 'string', default: '20000' },
      screenshots: { type: 'boolean', default: false },
      turns: { type: 'string', default: '300' },
      transcript: { type: 'string' },
      session: { type: 'string' },
      out: { type: 'string' },
    },
  })
  const name = positionals[0] ?? ''
  const scenario = SCENARIOS[name]
  if (!scenario)
    throw new Error(`Name a scenario: ${Object.keys(SCENARIOS).join(', ')}. Got "${name}".`)
  const options: ProfileOptions = {
    runs: Number(values.runs),
    speed: Number(values.speed),
    distance: Number(values.distance),
    screenshots: values.screenshots,
    turns: Number(values.turns),
    transcript: values.transcript ? path.resolve(values.transcript) : null,
    session: values.session ?? null,
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const out = values.out ?? path.join(os.tmpdir(), 'argo-profile', `${name}-${stamp}`)
  return { name, scenario, options, packaged: values.packaged, out }
}

async function profileOnce(
  target: Target,
  scenario: Scenario,
  run: { options: ProfileOptions; file: string },
) {
  const context = { page: target.page, cdp: target.cdp, options: run.options }
  const restore = await scenario.prepare(context)
  try {
    const periodMs = await idleFramePeriod(target.page)
    if (periodMs > THROTTLED_PERIOD_MS)
      throw new Error(`Frames arrive every ${Math.round(periodMs)}ms: the window is throttled.`)
    await startTrace(target.cdp, run.options.screenshots)
    await startRecording(target.page, scenario.coverage)
    await scenario.drive(context)
    const recording = await stopRecording(target.page)
    const trace = await stopTrace(target.cdp, run.file)
    return {
      ...summariseRun(recording, { periodMs, speed: run.options.speed }),
      trace: { file: run.file, ...summariseTrace(trace) },
    }
  } finally {
    await restore()
  }
}

const { name, scenario, options, packaged, out } = readArguments()
await mkdir(out, { recursive: true })
const target = packaged
  ? await packagedTarget(scenario, options)
  : await devTarget(scenario, options)
try {
  const runs = []
  for (let index = 1; index <= options.runs; index += 1)
    runs.push(
      await profileOnce(target, scenario, { options, file: path.join(out, `run-${index}.json`) }),
    )
  // Least of N: another process on the machine only ever makes a run slower.
  const best = [...runs].sort((a, b) => a.frames.dropped - b.frames.dropped)[0]
  const report = {
    scenario: name,
    target: packaged ? 'packaged' : 'dev',
    speedPxPerSecond: options.speed,
    runs: runs.map((run) => ({
      dropped: run.frames.dropped,
      p99Ms: run.frames.p99Ms,
      exposedFrames: run.blank.exposedFrames,
      worstExposedPx: run.blank.worstExposedPx,
      longFrames: run.longFrames.count,
      trace: run.trace.file,
    })),
    best,
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} finally {
  await target.close()
}
