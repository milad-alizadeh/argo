// Opens 1, 5 and 10 MB Claude histories in the packaged app and reports read size, pauses and memory.
// Then repeats switch and refresh, sampling memory after forced GC, to tell a leak from a peak.
// Run with `bun run measure:feed-history`; every gesture is in-page, so no real input device is used.
import { randomUUID } from 'node:crypto'
import { appendFile, chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { type ElectronApplication, _electron as electron, type Page } from 'playwright-core'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/harnesses/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { appExecutable, packagedTestCopy } from '../../e2e/packaged-app'
import { prepare } from '../../e2e/sessions/fixtures/feed.fixture'
// `mock-session-harness-backend` imports a Codex mock driver whose `@/harnesses/codex/drive` modules are gone.
import { writeMockClaude } from '../../mocks/cli/claude/mock-claude-cli'
import { proofCwd } from '../../mocks/sessions/mock-transcript-files'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { type MemorySample, printSamples, processWorkingSetMb, sample } from './feed-memory-sample'

const SIZES = [
  { label: '1 MB', targetBytes: 1_000_000 },
  { label: '5 MB', targetBytes: 5_000_000 },
  { label: '10 MB', targetBytes: 10_000_000 },
]
const STEP_TIMEOUT_MS = 60_000
const VIEWPORT = { width: 1440, height: 860 }

function line(record: Record<string, unknown>): string {
  return `${JSON.stringify(record)}\n`
}

const LOREM =
  'Reviewed the call site, weighed the alternative shape, and kept the one that names the ' +
  'behaviour rather than the mechanism. '

function longProse(index: number): string {
  return `Turn ${index}: ${LOREM.repeat(24)}`
}

function toolOutput(index: number): string {
  return `$ bun test composer --grep "turn ${index}"\n${'ok 1 - renders the composer\n'.repeat(40)}`
}

type QuadContext = { cwd: string; timestamp: string; parentUuid: string | null; index: number }

function userPromptLine({ cwd, timestamp, parentUuid, index }: QuadContext, uuid: string) {
  return line({
    type: 'user',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: { role: 'user', content: `Run the composer tests for turn ${index}.` },
  })
}

function toolCallLine({ cwd, timestamp, index }: QuadContext, uuid: string, parentUuid: string) {
  return line({
    type: 'assistant',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: {
      role: 'assistant',
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: `tool-${index}`,
          name: 'Bash',
          input: { command: `bun test composer --grep "turn ${index}"` },
        },
      ],
    },
  })
}

function toolResultLine({ cwd, timestamp, index }: QuadContext, uuid: string, parentUuid: string) {
  return line({
    type: 'user',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: `tool-${index}`, content: toolOutput(index) }],
    },
  })
}

function prosedLine({ cwd, timestamp, index }: QuadContext, uuid: string, parentUuid: string) {
  return line({
    type: 'assistant',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: `Weighing turn ${index} before answering.` },
        { type: 'text', text: longProse(index) },
      ],
    },
  })
}

// One short prompt, one Bash call with output, and one long reply.
function turnQuad(cwd: string, index: number, parentUuid: string | null) {
  const base = `hist-${index}`
  const userUuid = `${base}-u`
  const toolUuid = `${base}-tool`
  const resultUuid = `${base}-result`
  const proseUuid = `${base}-prose`
  const context: QuadContext = {
    cwd,
    timestamp: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
    parentUuid,
    index,
  }
  const lines = [
    userPromptLine(context, userUuid),
    toolCallLine(context, toolUuid, userUuid),
    toolResultLine(context, resultUuid, toolUuid),
    prosedLine(context, proseUuid, resultUuid),
  ]
  return { lines, lastUuid: proseUuid }
}

function buildHistory(cwd: string, targetBytes: number, firstIndex = 0) {
  const lines: string[] = []
  let bytes = 0
  let parent: string | null = null
  let lastUuid = ''
  let index = firstIndex
  while (bytes < targetBytes) {
    index += 1
    const quad = turnQuad(cwd, index, parent)
    for (const written of quad.lines) bytes += Buffer.byteLength(written, 'utf8')
    lines.push(...quad.lines)
    parent = quad.lastUuid
    lastUuid = quad.lastUuid
  }
  return { text: lines.join(''), lastUuid, bytes, turns: index - firstIndex }
}

function refreshTurn(cwd: string, parentUuid: string) {
  const refreshUuid = `${parentUuid}-refresh`
  return {
    text: line({
      type: 'assistant',
      cwd,
      timestamp: new Date().toISOString(),
      uuid: refreshUuid,
      parentUuid,
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'A turn appended while the reader was looking.' }],
      },
    }),
    refreshUuid,
    cwd,
  }
}

// Drained between steps, so each row reports only its own long tasks.
async function instrumentPage(page: Page) {
  await page.evaluate(() => {
    const held: PerformanceEntry[] = []
    ;(window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks = held
    new PerformanceObserver((list) => held.push(...list.getEntries())).observe({
      type: 'longtask',
      buffered: true,
    })
  })
}

async function drainLongTasks(page: Page) {
  const durations = await page.evaluate(() => {
    const held = (window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks
    ;(window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks = []
    return held.map((entry) => entry.duration)
  })
  return {
    count: durations.length,
    totalMs: Number(durations.reduce((total, one) => total + one, 0).toFixed(1)),
    maxMs: Number((durations.length ? Math.max(...durations) : 0).toFixed(1)),
  }
}

// `window.argo.trpc` is a frozen contextBridge function, so the read is repeated rather than wrapped.
async function feedReadBytes(page: Page, sessionId: string) {
  return page.evaluate(async (id) => {
    const response = await window.argo.trpc({
      id: Date.now(),
      path: 'sessionFeedRead',
      type: 'query',
      input: { sessionId: id, subagentId: null },
    })
    return new TextEncoder().encode(JSON.stringify(response)).length
  }, sessionId)
}

async function rendererHeapMb(page: Page) {
  return page.evaluate(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return memory ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : null
  })
}

// How late a 20 ms main-process timer fires is the main thread's stall.
async function armDriftProbe(application: ElectronApplication) {
  await application.evaluate(() => {
    const state = globalThis as unknown as { __argoDrift: number[] }
    state.__argoDrift = []
    let last = Date.now()
    setInterval(() => {
      const now = Date.now()
      state.__argoDrift.push(now - last - 20)
      last = now
    }, 20)
  })
}

async function drainDrift(application: ElectronApplication) {
  const samples = await application.evaluate(() => {
    const state = globalThis as unknown as { __argoDrift: number[] }
    const held = state.__argoDrift
    state.__argoDrift = []
    return held
  })
  return {
    maxMs: samples.length ? Math.max(...samples) : 0,
    overMs: samples.filter((sample) => sample > 16).length,
  }
}

type StepResult = {
  step: string
  ms: number
  feedReadBytes: number | null
  longTasks: { count: number; totalMs: number; maxMs: number }
  mainThreadDrift: { maxMs: number; overMs: number }
  rendererHeapMb: number | null
  processWorkingSetMb: number
}

type MeasureStepRequest = {
  step: string
  page: Page
  application: ElectronApplication
  action: () => Promise<void>
  readBytesFor?: string
}

async function measureStep(request: MeasureStepRequest): Promise<StepResult> {
  const { step, page, application, action, readBytesFor } = request
  await drainLongTasks(page)
  await drainDrift(application)
  const started = Date.now()
  await action()
  const ms = Date.now() - started
  const [longTasks, mainThreadDrift, heapMb, workingSetMb, bytes] = await Promise.all([
    drainLongTasks(page),
    drainDrift(application),
    rendererHeapMb(page),
    processWorkingSetMb(application),
    readBytesFor !== undefined ? feedReadBytes(page, readBytesFor) : Promise.resolve(null),
  ])
  return {
    step,
    ms,
    feedReadBytes: bytes,
    longTasks,
    mainThreadDrift,
    rendererHeapMb: heapMb,
    processWorkingSetMb: workingSetMb,
  }
}

async function openAndReachTail(page: Page, sessionId: string, lastUuid?: string) {
  await page.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`).click()
  const viewport = `.feed__viewport[data-session="${sessionId}"]`
  await page.waitForSelector(`${viewport} [data-feed-row]`, { timeout: STEP_TIMEOUT_MS })
  await page.evaluate((selector) => {
    const element = document.querySelector(selector)
    if (element) element.scrollTop = element.scrollHeight
  }, viewport)
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
    'feedReadBytes',
    'longTasks(count/total/max ms)',
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
        row.feedReadBytes ?? '-',
        `${row.longTasks.count}/${row.longTasks.totalMs}/${row.longTasks.maxMs}`,
        `${row.mainThreadDrift.maxMs}/${row.mainThreadDrift.overMs}`,
        row.rendererHeapMb ?? '-',
        row.processWorkingSetMb,
      ].join(' | '),
    )
  }
}

// The app spawns Codex for readiness checks only, so exiting cleanly is enough.
async function writeStubCodexExecutable(root: string) {
  const executable = path.join(root, 'codex')
  await writeFile(executable, '#!/bin/sh\nexit 0\n')
  await chmod(executable, 0o755)
  return executable
}

async function launchSession(root: string, fixture: Awaited<ReturnType<typeof prepare>>) {
  // Claude discovery reads CLAUDE_CONFIG_DIR/projects, so point that at the fixture transcripts.
  const claudeConfig = path.join(root, 'claude-config')
  await mkdir(claudeConfig, { recursive: true })
  await symlink(fixture.claudeTranscripts, path.join(claudeConfig, 'projects'))
  const [claudeExecutable, codexExecutable] = await Promise.all([
    writeMockClaude(root, fixture.claudeTranscripts),
    writeStubCodexExecutable(root),
  ])
  const environment = {
    ...process.env,
    CLAUDE_CONFIG_DIR: claudeConfig,
    [SESSION_CLAUDE_EXECUTABLE_ENV]: claudeExecutable,
    [SESSION_CODEX_EXECUTABLE_ENV]: codexExecutable,
    [SESSION_MOCK_REPLY_DELAY_MS_ENV]: '0',
    [PROJECT_PROOF_STORE_ENV]: fixture.userData,
    [ACCEPTANCE_ENV]: '0',
  }
  const application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    env: environment,
    timeout: 30_000,
  })
  const page = await application.firstWindow()
  page.setDefaultTimeout(STEP_TIMEOUT_MS)
  await application.evaluate(({ BrowserWindow }, viewport) => {
    BrowserWindow.getAllWindows()[0].setContentSize(viewport.width, viewport.height)
  }, VIEWPORT)
  await page.waitForFunction(
    (viewport) => window.innerWidth === viewport.width && window.innerHeight === viewport.height,
    VIEWPORT,
  )
  // The Roster is read over tRPC, so its readiness is the bridge's readiness.
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
  fixture: Awaited<ReturnType<typeof prepare>>
  historyId: string
  sessionId: string
  appended: ReturnType<typeof refreshTurn>
  revisionBefore: string | null
}

// Appends a turn, then dispatches the `focus` event `useFocusRefresh` listens for.
async function refreshAndWait(request: RefreshRequest) {
  const { page, fixture, historyId, sessionId, appended, revisionBefore } = request
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
  const viewport = `.feed__viewport[data-session="${sessionId}"]`
  await page.evaluate((selector) => {
    const element = document.querySelector(selector)
    if (element) element.scrollTop = element.scrollHeight
  }, viewport)
  await page.waitForSelector(`${viewport} [data-feed-row^="${appended.refreshUuid}"]`, {
    timeout: STEP_TIMEOUT_MS,
  })
}

type RunStepsRequest = {
  page: Page
  application: ElectronApplication
  fixture: Awaited<ReturnType<typeof prepare>>
  historyId: string
  // The Roster and Feed key Sessions by Argo id, not by the transcript's vendor id.
  sessionIds: { history: string; other: string }
  history: ReturnType<typeof buildHistory>
  cwd: string
}

async function runSteps(request: RunStepsRequest) {
  const { page, application, fixture, historyId, sessionIds, history, cwd } = request
  const rows: StepResult[] = []
  rows.push(
    await measureStep({
      step: 'open',
      page,
      application,
      action: () => openAndReachTail(page, sessionIds.history, history.lastUuid),
      readBytesFor: sessionIds.history,
    }),
  )
  rows.push(
    await measureStep({
      step: 'switch away',
      page,
      application,
      action: () => openAndReachTail(page, sessionIds.other),
      readBytesFor: sessionIds.other,
    }),
  )
  rows.push(
    await measureStep({
      step: 'switch back',
      page,
      application,
      action: () => openAndReachTail(page, sessionIds.history, history.lastUuid),
      readBytesFor: sessionIds.history,
    }),
  )
  const revisionBefore = await activeRevision(page)
  const appended = refreshTurn(cwd, history.lastUuid)
  rows.push(
    await measureStep({
      step: 'refresh (append + focus)',
      page,
      application,
      action: () =>
        refreshAndWait({
          page,
          fixture,
          historyId,
          sessionId: sessionIds.history,
          appended,
          revisionBefore,
        }),
      readBytesFor: sessionIds.history,
    }),
  )
  return rows
}

const HISTORY_TITLE = 'Run the composer tests for turn 1.'
const OTHER_FIRST_INDEX = 1000
const OTHER_TITLE = `Run the composer tests for turn ${OTHER_FIRST_INDEX + 1}.`

async function writeHistory(file: string, text: string) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text)
}

async function rosterSessionIds(page: Page) {
  const rows = 'nav[aria-label="Sessions"] button[data-session-id]'
  const history = page.locator(rows, { hasText: HISTORY_TITLE }).first()
  await history.waitFor({ timeout: STEP_TIMEOUT_MS })
  const other = page.locator(rows, { hasText: OTHER_TITLE }).first()
  const [historyId, otherId] = await Promise.all([
    history.getAttribute('data-session-id'),
    other.getAttribute('data-session-id'),
  ])
  if (historyId === null || otherId === null) throw new Error('Roster rows carry no Session id.')
  return { history: historyId, other: otherId }
}

// The SDK reads a Session's history from the folder its cwd encodes to, not from where discovery found it.
function historyPath(transcripts: string, cwd: string, sessionId: string) {
  return path.join(transcripts, cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`)
}

const CYCLES = 10

type CycleRequest = {
  page: Page
  application: ElectronApplication
  fixture: Awaited<ReturnType<typeof prepare>>
  historyId: string
  sessionIds: { history: string; other: string }
  lastUuid: string
  cwd: string
}

async function runCycles(request: CycleRequest) {
  const { page, application, fixture, historyId, sessionIds, cwd } = request
  const samples: MemorySample[] = [await sample('after steps', page, application)]
  let last = request.lastUuid
  for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
    await openAndReachTail(page, sessionIds.other)
    await openAndReachTail(page, sessionIds.history, last)
    const revisionBefore = await activeRevision(page)
    const appended = refreshTurn(cwd, last)
    await refreshAndWait({
      page,
      fixture,
      historyId,
      sessionId: sessionIds.history,
      appended,
      revisionBefore,
    })
    last = appended.refreshUuid
    samples.push(await sample(`cycle ${cycle}`, page, application))
  }
  await openAndReachTail(page, sessionIds.other)
  samples.push(await sample('parked on other', page, application))
  return samples
}

async function runSize(size: (typeof SIZES)[number]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-feed-history-'))
  try {
    const packagedApplication = await packagedTestCopy(root)
    const fixture = await prepare(root, packagedApplication, { projectSelected: true })
    const historyId = randomUUID()
    const cwd = proofCwd(fixture.claudeTranscripts, 'history')
    const history = buildHistory(cwd, size.targetBytes)
    await writeHistory(historyPath(fixture.claudeTranscripts, cwd, historyId), history.text)
    const otherCwd = proofCwd(fixture.claudeTranscripts, 'other')
    const other = buildHistory(otherCwd, 20_000, OTHER_FIRST_INDEX)
    await writeHistory(historyPath(fixture.claudeTranscripts, otherCwd, randomUUID()), other.text)
    console.log(`\n${size.label} history: ${history.turns} turns, ${history.bytes} bytes on disk`)

    const { application, page } = await launchSession(root, fixture)
    try {
      await instrumentPage(page)
      await armDriftProbe(application)
      const sessionIds = await rosterSessionIds(page)
      const rows = await runSteps({
        page,
        application,
        fixture,
        historyId,
        sessionIds,
        history,
        cwd,
      })
      printTable(size.label, rows)
      const lastUuid = refreshTurn(cwd, history.lastUuid).refreshUuid
      printSamples(
        size.label,
        await runCycles({ page, application, fixture, historyId, sessionIds, lastUuid, cwd }),
      )
    } finally {
      await application.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

for (const size of SIZES) {
  await runSize(size)
}
