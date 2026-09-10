// Startup and idle evidence for the PACKAGED cockpit (#1863, ceilings from #1736).
//
//   bun run measure:cockpit -- [runs]
//
// #1736 fixed one reference Mac, an absolute frame budget of 8.33 ms and an idle p99 ceiling of
// 12.5 ms, and the FAIL line as the MEDIAN of five interleaved runs. So this launches the shipped
// app that many times and reports the median, rather than the best or the last.
//
// An idle `requestAnimationFrame` delta is the DISPLAY's period, not the cost of a frame: an idle
// cockpit schedules no work, so the loop simply runs at vsync and cannot read below it. The budget
// is therefore taken from the display this run used and compared against 1.5 times it, which is the
// ratio #1736's 12.5 ms holds to its 120 Hz reference panel. Only a run on that panel is JUDGED:
// anywhere else the verdict is `unjudged` and the exit code is zero, because a period the display
// cannot go below is a fact about the display and not a missed budget. The judged run is the
// human's, on the reference Mac.
//
// The window is shown: Chromium throttles a hidden one down to one frame a second, and a frame
// reading taken from that measures the throttle. Nothing here holds the real keyboard or mouse.
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { chooseThen, show, waitForCockpit } from './cockpit-driver'
import { firstPaint, frameDeltas, median, percentile, processLoad } from './cockpit-metrics'
import { launch, prepare } from './project-proof-fixture'

const RUNS = Number(process.argv[2] ?? 5)
if (!Number.isInteger(RUNS) || RUNS < 1) {
  throw new Error(`the run count must be a whole number of at least 1, not ${process.argv[2]}`)
}
// Long enough for the window to stop settling before the frame loop starts sampling it.
const FRAME_SETTLE_MS = 1000
// 12.5 ms over the 8.33 ms budget of #1736's reference panel.
const CEILING_RATIO = 1.5
const REFERENCE_HZ = 120

function verdictName(judged, withinCeiling) {
  if (!judged) return 'unjudged'
  return withinCeiling ? 'pass' : 'fail'
}

async function measure(fixture) {
  const started = Date.now()
  const application = await launch(fixture)
  try {
    const page = await application.firstWindow()
    await waitForCockpit(page)
    // The registered Project is opened and drawn: startup is not over until the deck answers.
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.getAttribute('data-state') === 'selected',
      '[data-component="ProjectDeck"] [data-state]',
    )
    const startupMs = Date.now() - started
    await show(application)
    const display = await application.evaluate(
      ({ BrowserWindow, screen }) =>
        screen.getDisplayMatching(BrowserWindow.getAllWindows()[0].getBounds()).displayFrequency,
    )
    const paintMs = await firstPaint(page)
    await new Promise((resolve) => setTimeout(resolve, FRAME_SETTLE_MS))
    const deltas = await frameDeltas(page)
    const load = await processLoad(application)
    const budgetMs = 1000 / display
    return {
      startupMs,
      paintMs: Number(paintMs.toFixed(1)),
      displayHz: Math.round(display),
      budgetMs: Number(budgetMs.toFixed(2)),
      frameP50: Number(percentile(deltas, 0.5).toFixed(2)),
      frameP99: Number(percentile(deltas, 0.99).toFixed(2)),
      dropped: deltas.filter((delta) => delta > budgetMs * CEILING_RATIO).length,
      frames: deltas.length,
      ...load,
    }
  } finally {
    await application.close()
  }
}

const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-cockpit-measure-')))
try {
  const fixture = await prepare(root)
  // The first launch registers the Project; every measured launch then reopens it, which is the
  // startup this ticket is about.
  const first = await launch(fixture)
  const page = await first.firstWindow()
  await waitForCockpit(page)
  await chooseThen({ application: first, page, fixture }, fixture.beta, {
    button: 'Open Project…',
    state: 'selected',
  })
  await first.close()

  const runs = []
  for (let index = 0; index < RUNS; index += 1) runs.push(await measure(fixture))
  const summarise = (key) => median(runs.map((run) => run[key]))
  const ceilingMs = Number((summarise('budgetMs') * CEILING_RATIO).toFixed(2))
  const displayHz = summarise('displayHz')
  const judged = displayHz === REFERENCE_HZ
  const withinCeiling = summarise('frameP99') <= ceilingMs
  const evidence = {
    // The comparison is the p99 ceiling. A dropped frame is reported beside it rather than judged:
    // one frame in three seconds is what another process on the machine costs, and #1736 set a
    // percentile line for exactly that reason. The comparison is published only where it means
    // something, so an unjudged run carries no field that reads as a pass.
    verdict: verdictName(judged, withinCeiling),
    ...(judged ? { withinCeiling } : {}),
    runs: runs.length,
    displayHz,
    referenceHz: REFERENCE_HZ,
    idleCeilingMs: ceilingMs,
    median: {
      startupMs: summarise('startupMs'),
      paintMs: summarise('paintMs'),
      frameP50: summarise('frameP50'),
      frameP99: summarise('frameP99'),
      dropped: summarise('dropped'),
      cpuPercent: summarise('cpuPercent'),
      memoryMb: summarise('memoryMb'),
    },
    samples: runs,
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`)
  if (evidence.verdict === 'fail') process.exitCode = 1
} finally {
  await rm(root, { recursive: true, force: true })
}
