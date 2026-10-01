// Opens 1, 5 and 10 MB Claude histories in the Vite build (or the packaged app under
// ARGO_E2E_PACKAGED=1) and reports open, switch, Refresh and streaming cost: time, Feed IPC bytes,
// main-thread stalls, renderer long tasks and Feed row DOM updates, and memory.
// Then repeats switch and refresh, sampling memory after forced GC, to tell a leak from a peak.
// Run with `bun run measure:feed-history [--sizes=1,5,10] [--json=<file>]`; every gesture is
// in-page, so no real input device is used.
import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { type ElectronApplication, _electron as electron, type Page } from 'playwright-core'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/harnesses/claude/proof-protocol'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { applicationUnderTest, launchCommand } from '../../e2e/application-under-test'
import { prepare } from '../../e2e/sessions/fixtures/feed.fixture'
import { createMockSessionHarnessBackend } from '../../mocks/sessions/mock-session-harness-backend'
import { proofCwd } from '../../mocks/sessions/mock-transcript-files'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import {
  type AppendedTurn,
  buildHistory,
  type FeedHistory,
  historyPath,
  refreshTurn,
  writeHistory,
} from './feed-history-fixture'
import { type MemorySample, printSamples, processWorkingSetMb, sample } from './feed-memory-sample'
import {
  armDriftProbe,
  armFeedIpcProbe,
  drainDrift,
  drainFeedIpc,
  drainRendererProbes,
  instrumentPage,
  rendererHeapMb,
} from './feed-probes'

const SIZES = [
  { label: '1 MB', megabytes: 1 },
  { label: '5 MB', megabytes: 5 },
  { label: '10 MB', megabytes: 10 },
]
const STEP_TIMEOUT_MS = 60_000
const VIEWPORT = { width: 1440, height: 860 }
// The mock Claude streams this prompt's reply as 300 text deltas, 10 ms apart.
const STREAM_PROMPT = 'FeedStreamProbe: stream a long reply.'

function argumentValue(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null
}

type Fixture = Awaited<ReturnType<typeof prepare>>
type SessionIds = { history: string; other: string }

type StepResult = {
  step: string
  ms: number
  feedIpc: { bytes: number; messages: number }
  longTasks: { count: number; totalMs: number; maxMs: number }
  rowUpdates: number
  mainThreadDrift: { maxMs: number; overMs: number }
  rendererHeapMb: number | null
  processWorkingSetMb: number
}

type MeasureStepRequest = {
  step: string
  page: Page
  application: ElectronApplication
  action: () => Promise<void>
}

async function measureStep(request: MeasureStepRequest): Promise<StepResult> {
  const { step, page, application, action } = request
  console.log(`  measuring ${step}`)
  await Promise.all([drainRendererProbes(page), drainDrift(application), drainFeedIpc(application)])
  const started = Date.now()
  await action()
  const ms = Date.now() - started
  const [renderer, mainThreadDrift, feedIpc, heapMb, workingSetMb] = await Promise.all([
    drainRendererProbes(page),
    drainDrift(application),
    drainFeedIpc(application),
    rendererHeapMb(page),
    processWorkingSetMb(application),
  ])
  return {
    step,
    ms,
    feedIpc,
    longTasks: renderer.longTasks,
    rowUpdates: renderer.rowUpdates,
    mainThreadDrift,
    rendererHeapMb: heapMb,
    processWorkingSetMb: workingSetMb,
  }
}

function viewportOf(sessionId: string) {
  return `.feed__viewport[data-session="${sessionId}"]`
}

async function scrollToTail(page: Page, sessionId: string) {
  await page.evaluate((selector) => {
    const element = document.querySelector(selector)
    if (element) element.scrollTop = element.scrollHeight
  }, viewportOf(sessionId))
}

async function openAndReachTail(page: Page, sessionId: string, lastUuid?: string) {
  await page.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`).click()
  const viewport = viewportOf(sessionId)
  await page.waitForSelector(`${viewport} [data-feed-row]`, { timeout: STEP_TIMEOUT_MS })
  await scrollToTail(page, sessionId)
  if (lastUuid !== undefined) {
    await page.waitForSelector(`${viewport} [data-feed-row^="${lastUuid}"]`, {
      timeout: STEP_TIMEOUT_MS,
    })
  }
}

function printTable(label: string, rows: StepResult[]) {
  console.log(`\n${label}`)
  const header = [
    'step',
    'ms',
    'feedIpc(bytes/messages)',
    'longTasks(count/total/max ms)',
    'rowUpdates',
    'mainThreadStall(max/over16 ms)',
    'rendererHeapMb',
    'processWorkingSetMb',
  ]
  console.log(header.join(' | '))
  for (const row of rows) {
    console.log(
      [
        row.step,
        row.ms,
        `${row.feedIpc.bytes}/${row.feedIpc.messages}`,
        `${row.longTasks.count}/${row.longTasks.totalMs}/${row.longTasks.maxMs}`,
        row.rowUpdates,
        `${row.mainThreadDrift.maxMs}/${row.mainThreadDrift.overMs}`,
        row.rendererHeapMb ?? '-',
        row.processWorkingSetMb,
      ].join(' | '),
    )
  }
}

// The mock backend every Session proof runs against: both mock CLIs, and both transcript roots
// pointed at the fixture tree.
async function launchSession(root: string, fixture: Fixture) {
  const run = await createMockSessionHarnessBackend().start({ root, fixture })
  // The app discovers Claude under CLAUDE_CONFIG_DIR/projects and Codex under CODEX_HOME, so both
  // point into the root rather than at this machine's own Sessions.
  const claudeConfig = path.join(root, 'claude-config')
  const codexHome = path.join(root, 'codex-home')
  await Promise.all([mkdir(claudeConfig, { recursive: true }), mkdir(codexHome)])
  await symlink(fixture.claudeTranscripts, path.join(claudeConfig, 'projects'))
  const environment = {
    ...process.env,
    CLAUDE_CONFIG_DIR: claudeConfig,
    CODEX_HOME: codexHome,
    [SESSION_CLAUDE_EXECUTABLE_ENV]: run.executables.claude,
    [SESSION_CODEX_EXECUTABLE_ENV]: run.executables.codex,
    ...run.launchEnv({ slowReply: false }),
    [PROJECT_PROOF_STORE_ENV]: fixture.userData,
    [ACCEPTANCE_ENV]: '0',
  }
  const application = await electron.launch({
    ...launchCommand(fixture.application),
    env: environment,
    timeout: 30_000,
  })
  const page = await application.firstWindow()
  page.setDefaultTimeout(STEP_TIMEOUT_MS)
  await application.evaluate(({ BrowserWindow }, viewport) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(viewport.width, viewport.height)
  }, VIEWPORT)
  await page.waitForFunction(
    (viewport) => window.innerWidth === viewport.width && window.innerHeight === viewport.height,
    VIEWPORT,
  )
  // The Session List is read over tRPC, so its readiness is the bridge's readiness.
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
  return { application, page }
}

function activeRevision(page: Page) {
  return page.evaluate(
    () =>
      document
        .querySelector('.feed__document[data-active="true"]')
        ?.getAttribute('data-revision') ?? null,
  )
}

type RefreshRequest = {
  page: Page
  fixture: Fixture
  historyId: string
  sessionId: string
  appended: AppendedTurn
}

// Appends a turn, then dispatches the `focus` event `useFocusRefresh` listens for.
async function refreshAndWait(request: RefreshRequest) {
  const { page, fixture, historyId, sessionId, appended } = request
  const revisionBefore = await activeRevision(page)
  await appendFile(historyPath(fixture.claudeTranscripts, appended.cwd, historyId), appended.text)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(
    (previous) =>
      document
        .querySelector('.feed__document[data-active="true"]')
        ?.getAttribute('data-revision') !== previous,
    revisionBefore,
    { timeout: STEP_TIMEOUT_MS },
  )
  await scrollToTail(page, sessionId)
  await page.waitForSelector(
    `${viewportOf(sessionId)} [data-feed-row^="${appended.refreshUuid}"]`,
    {
      timeout: STEP_TIMEOUT_MS,
    },
  )
}

// Sends the probe prompt through the Composer and waits for the settled reply after its stream.
async function streamAndWait(page: Page, sessionId: string) {
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(STREAM_PROMPT)
  // Send stays disabled until the Harness catalog loads, and a click before then is dropped.
  await page.waitForSelector('button[aria-label="Send message"]:not([disabled])')
  await page.getByRole('button', { name: 'Send message' }).click()
  const feed = page.locator(viewportOf(sessionId))
  await feed
    .getByText(`Mock Claude read: ${STREAM_PROMPT}`)
    .first()
    .waitFor({ timeout: STEP_TIMEOUT_MS })
    .catch(async (error: unknown) => {
      await scrollToTail(page, sessionId)
      const tail = (await feed.locator('[data-feed-row]').allTextContents())
        .slice(-3)
        .map((text) => text.slice(0, 80))
      const send = await page.getByRole('button', { name: 'Send message' }).isEnabled()
      throw new Error(
        `The streamed reply never settled; Send enabled: ${send}; the Feed ends with ${JSON.stringify(tail)}`,
        { cause: error },
      )
    })
}

type RunStepsRequest = {
  page: Page
  application: ElectronApplication
  fixture: Fixture
  historyId: string
  // The Session List and Feed key Sessions by Argo id, not by the transcript's vendor id.
  sessionIds: SessionIds
  history: FeedHistory
  cwd: string
}

async function runSteps(request: RunStepsRequest) {
  const { page, application, fixture, historyId, sessionIds, history, cwd } = request
  const measure = (step: string, action: () => Promise<void>) =>
    measureStep({ step, page, application, action })
  const rows: StepResult[] = []
  rows.push(
    await measure('open', () => openAndReachTail(page, sessionIds.history, history.lastUuid)),
  )
  rows.push(await measure('switch away', () => openAndReachTail(page, sessionIds.other)))
  rows.push(
    await measure('switch back', () =>
      openAndReachTail(page, sessionIds.history, history.lastUuid),
    ),
  )
  const appended = refreshTurn(cwd, history.lastUuid)
  rows.push(
    await measure('refresh (append + focus)', () =>
      refreshAndWait({ page, fixture, historyId, sessionId: sessionIds.history, appended }),
    ),
  )
  rows.push(
    await measure('stream (300 text deltas)', () => streamAndWait(page, sessionIds.history)),
  )
  return { rows, lastUuid: appended.refreshUuid }
}

const HISTORY_TITLE = 'Run the composer tests for turn 1.'
const OTHER_FIRST_INDEX = 1000
const OTHER_TITLE = `Run the composer tests for turn ${OTHER_FIRST_INDEX + 1}.`

async function sessionListIds(page: Page): Promise<SessionIds> {
  const rows = 'nav[aria-label="Sessions"] button[data-session-id]'
  const history = page.locator(rows, { hasText: HISTORY_TITLE }).first()
  await history.waitFor({ timeout: STEP_TIMEOUT_MS })
  const other = page.locator(rows, { hasText: OTHER_TITLE }).first()
  const [historyId, otherId] = await Promise.all([
    history.getAttribute('data-session-id'),
    other.getAttribute('data-session-id'),
  ])
  if (historyId === null || otherId === null)
    throw new Error('Session List rows carry no Session id.')
  return { history: historyId, other: otherId }
}

const CYCLES = 10

type CycleRequest = {
  page: Page
  application: ElectronApplication
  fixture: Fixture
  historyId: string
  sessionIds: SessionIds
  lastUuid: string
  cwd: string
}

async function runCycles(request: CycleRequest) {
  const { page, application, fixture, historyId, sessionIds, cwd } = request
  const samples: MemorySample[] = [await sample('after steps', page, application)]
  let last = request.lastUuid
  for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
    await openAndReachTail(page, sessionIds.other)
    await openAndReachTail(page, sessionIds.history)
    const appended = refreshTurn(cwd, last)
    await refreshAndWait({ page, fixture, historyId, sessionId: sessionIds.history, appended })
    last = appended.refreshUuid
    samples.push(await sample(`cycle ${cycle}`, page, application))
  }
  await openAndReachTail(page, sessionIds.other)
  samples.push(await sample('parked on other', page, application))
  return samples
}

type SizeResult = { size: string; turns: number; bytes: number; steps: StepResult[] }

async function runSize(size: (typeof SIZES)[number]): Promise<SizeResult> {
  // The macOS temp folder is a symlink the history reader resolves, so the root is its real path.
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-feed-history-')))
  try {
    const fixture = await prepare(root, await applicationUnderTest(root), {
      projectSelected: true,
    })
    const historyId = randomUUID()
    const cwd = proofCwd(fixture.claudeTranscripts, 'history')
    // A Send resumes the Session in its recorded cwd, so the folder must exist.
    await mkdir(cwd, { recursive: true })
    const history = buildHistory(cwd, size.megabytes * 1_000_000)
    await writeHistory(historyPath(fixture.claudeTranscripts, cwd, historyId), history.text)
    const otherCwd = proofCwd(fixture.claudeTranscripts, 'other')
    const other = buildHistory(otherCwd, 20_000, OTHER_FIRST_INDEX)
    await writeHistory(historyPath(fixture.claudeTranscripts, otherCwd, randomUUID()), other.text)
    console.log(`\n${size.label} history: ${history.turns} turns, ${history.bytes} bytes on disk`)

    const { application, page } = await launchSession(root, fixture)
    try {
      await instrumentPage(page)
      await armDriftProbe(application)
      await armFeedIpcProbe(application)
      const sessionIds = await sessionListIds(page)
      const steps = await runSteps({
        page,
        application,
        fixture,
        historyId,
        sessionIds,
        history,
        cwd,
      })
      printTable(size.label, steps.rows)
      printSamples(
        size.label,
        await runCycles({
          page,
          application,
          fixture,
          historyId,
          sessionIds,
          lastUuid: steps.lastUuid,
          cwd,
        }),
      )
      return { size: size.label, turns: history.turns, bytes: history.bytes, steps: steps.rows }
    } finally {
      await application.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const chosen = argumentValue('sizes')?.split(',').map(Number) ?? null
const results: SizeResult[] = []
for (const size of SIZES) {
  if (chosen === null || chosen.includes(size.megabytes)) results.push(await runSize(size))
}
const json = argumentValue('json')
if (json !== null) await writeFile(json, `${JSON.stringify(results, null, 2)}\n`)
