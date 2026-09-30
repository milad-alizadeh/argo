// Reproducible Session List workload for #2934 and its comparisons. Run from apps/desktop through run-tool.mts.

import { execFileSync } from 'node:child_process'
import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import {
  type ElectronApplication,
  _electron as electron,
  type Locator,
  type Page,
} from 'playwright-core'
import { openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import * as claudeProof from '@/harnesses/claude/proof-protocol'
import * as codexProof from '@/harnesses/codex/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { applicationUnderTest, launchCommand } from '../../e2e/application-under-test'
import { prepare } from '../../e2e/sessions/fixtures/feed.fixture'
import { createMockSessionHarnessBackend } from '../../mocks/sessions/mock-session-harness-backend'
import { proofCwd } from '../../mocks/sessions/mock-transcript-files'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { buildHistory, historyPath, writeHistory } from './feed-history-fixture'

const PROJECT_ID = 'session-proof-project'
const SESSION_COUNT = 600
const ARCHIVED_COUNT = 120
const HISTORY_BYTES = 12_000_000
const EXTRA_CLAUDE_FILES = 120
const EXTRA_CODEX_FILES = 40
const WAIT_MS = 60_000
const VIEWPORT = { width: 1440, height: 860 }
const PRELOAD = path.join(process.cwd(), 'tools/sessions/session-list-startup-probe.mts')

function value(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null
}

function sessionId(index: number) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
}

function savedTitle(index: number) {
  if (index === 0) return 'Needle session list search target'
  if (index === 1) return 'Massive Session List transcript'
  return `Saved Session ${index + 1}`
}

async function buildCorpus(fixture: Awaited<ReturnType<typeof prepare>>) {
  const cwd = proofCwd(fixture.claudeTranscripts, 'list-workload')
  await mkdir(cwd, { recursive: true })
  const largeNativeId = '11111111-2222-4333-8444-666666666666'
  const history = buildHistory(cwd, HISTORY_BYTES)
  const largePath = historyPath(fixture.claudeTranscripts, cwd, largeNativeId)
  await writeHistory(largePath, history.text)
  const small = buildHistory(cwd, 2_000).text
  for (let index = 0; index < EXTRA_CLAUDE_FILES; index += 1) {
    const nativeId = `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    await writeHistory(historyPath(fixture.claudeTranscripts, cwd, nativeId), small)
  }
  const codexDirectory = path.join(fixture.codexTranscripts, '2026/09/10')
  const codexExample = path.join(codexDirectory, 'rollout-codexParent.jsonl')
  const firstCodexLine = (await readFile(codexExample, 'utf8')).split('\n').find(Boolean)
  if (firstCodexLine === undefined) throw new Error('The recorded Codex transcript is empty.')
  const codexAppend = `${firstCodexLine}\n`
  for (let index = 0; index < EXTRA_CODEX_FILES; index += 1)
    await copyFile(codexExample, path.join(codexDirectory, `rollout-list-${index}.jsonl`))

  const database = openDatabase(fixture.userData)
  const now = Date.now()
  const rows = Array.from({ length: SESSION_COUNT }, (_, index) => ({
    argoId: sessionId(index),
    harness: index === 1 || index % 2 === 0 ? 'claude' : 'codex',
    nativeId: index === 1 ? largeNativeId : `list-baseline-${index}`,
    projectId: PROJECT_ID,
    customTitle: savedTitle(index),
    preview: `Saved preview ${index + 1}`,
    firstPrompt: `Saved prompt ${index + 1}`,
    cwd,
    activityAt: now - index * 60_000,
    listOrderAt: now - index * 60_000,
  }))
  database.insert(sessionTable).values(rows).run()
  database
    .insert(sessionArchive)
    .values(rows.slice(-ARCHIVED_COUNT).map((row) => ({ sessionId: row.argoId })))
    .run()
  database.$client.close()
  return {
    largePath,
    largeSessionId: sessionId(1),
    largeNativeId,
    largeBytes: history.bytes,
    largeTurns: history.turns,
    codexExample,
    codexAppend,
    cwd,
  }
}

type MainSnapshot = {
  syncReads: number
  syncReadBytes: number
  syncDirectoryReads: number
  syncStats: number
  asyncReads: number
  asyncReadBytes: number
  watcherStarts: number
  activeWatchers: number
  delay: { p50Ms: number; p95Ms: number; maxMs: number }
  mainRssMb: number
  rendererWorkingSetMb: number
  ipc: Record<string, { messages: number; bytes: number }>
}

async function mainSnapshot(application: ElectronApplication): Promise<MainSnapshot> {
  return application.evaluate(({ app }) => {
    const probe = globalThis.__argoSessionListProbe
    if (probe === undefined) throw new Error('The startup probe did not load in Electron main.')
    const ipc =
      (globalThis as unknown as { __argoListIpc?: MainSnapshot['ipc'] }).__argoListIpc ?? {}
    const delay = probe.delay
    const nsToMs = (value: number) => Number((value / 1_000_000).toFixed(2))
    return {
      syncReads: probe.syncReads,
      syncReadBytes: probe.syncReadBytes,
      syncDirectoryReads: probe.syncDirectoryReads,
      syncStats: probe.syncStats,
      asyncReads: probe.asyncReads,
      asyncReadBytes: probe.asyncReadBytes,
      watcherStarts: probe.watcherStarts,
      activeWatchers: probe.activeWatchers,
      delay: {
        p50Ms: nsToMs(delay.percentile(50)),
        p95Ms: nsToMs(delay.percentile(95)),
        maxMs: nsToMs(delay.max),
      },
      mainRssMb: Math.round(globalThis.process.memoryUsage().rss / 1_048_576),
      rendererWorkingSetMb: Math.round(
        app
          .getAppMetrics()
          .filter((metric) => metric.type === 'Renderer' || metric.type === 'Tab')
          .reduce((sum, metric) => sum + (metric.memory?.workingSetSize ?? 0), 0) / 1024,
      ),
      ipc: structuredClone(ipc),
    }
  })
}

async function armIpc(application: ElectronApplication) {
  const armed = await application.evaluate(({ ipcMain, BrowserWindow }) => {
    type Count = { messages: number; bytes: number }
    const counts: Record<string, Count> = {}
    ;(globalThis as unknown as { __argoListIpc: typeof counts }).__argoListIpc = counts
    const add = (path: string, value: unknown) => {
      if (counts[path] === undefined) counts[path] = { messages: 0, bytes: 0 }
      const count = counts[path]
      count.messages += 1
      count.bytes += Buffer.byteLength(JSON.stringify(value) ?? '')
    }
    type Handler = (event: unknown, ...arguments_: unknown[]) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers?: Map<string, Handler> })
      ._invokeHandlers
    const original = handlers?.get('argo:trpc')
    const window = BrowserWindow.getAllWindows()[0]
    if (handlers === undefined || original === undefined || window === undefined) return false
    const subscriptions = new Map<number, string>()
    const send = window.webContents.send.bind(window.webContents)
    window.webContents.send = (channel: string, ...arguments_: unknown[]) => {
      const message = arguments_[0] as { id?: number } | undefined
      const path = subscriptions.get(message?.id ?? -1)
      if (channel === 'argo:trpc' && path !== undefined) add(`${path}:out`, message)
      send(channel, ...arguments_)
    }
    handlers.set('argo:trpc', (event, ...arguments_) => {
      const input = arguments_[0] as { id?: number; path?: string; type?: string } | undefined
      if (input?.path !== undefined) {
        add(`${input.path}:in`, input)
        if (input.type === 'subscription') subscriptions.set(input.id ?? -1, input.path)
      }
      const response = original(event, ...arguments_)
      if (input?.path !== undefined)
        void Promise.resolve(response).then((result) => add(`${input.path}:reply`, result))
      return response
    })
    return true
  })
  if (!armed) throw new Error('The tRPC IPC handler was unavailable for measurement.')
}

async function armFrames(page: Page) {
  await page.evaluate(() => {
    const state = window as unknown as { __argoFrameTimes: number[]; __argoLongTasks: number[] }
    state.__argoFrameTimes = []
    state.__argoLongTasks = []
    let previous = performance.now()
    const frame = (now: number) => {
      state.__argoFrameTimes.push(now - previous)
      previous = now
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    new PerformanceObserver((entries) => {
      state.__argoLongTasks.push(...entries.getEntries().map((entry) => entry.duration))
    }).observe({ type: 'longtask' })
  })
}

async function rendererSnapshot(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const heap = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number }
  await cdp.detach()
  return page.evaluate((usedSize) => {
    const state = window as unknown as { __argoFrameTimes: number[]; __argoLongTasks: number[] }
    const frames = state.__argoFrameTimes.splice(0)
    const tasks = state.__argoLongTasks.splice(0)
    const sorted = [...frames].sort((a, b) => a - b)
    return {
      frameCount: frames.length,
      frameP95Ms: Number((sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2)),
      framesOver33Ms: frames.filter((duration) => duration > 33).length,
      longestFrameMs: Number(Math.max(0, ...frames).toFixed(2)),
      longTasks: tasks.length,
      longestTaskMs: Number(Math.max(0, ...tasks).toFixed(2)),
      rendererHeapMb: Math.round(usedSize / 1_048_576),
    }
  }, heap.usedSize)
}

async function step(request: {
  label: string
  page: Page
  application: ElectronApplication
  action: () => Promise<void>
}) {
  const { label, page, application, action } = request
  await rendererSnapshot(page)
  const before = await mainSnapshot(application)
  await application.evaluate(() => globalThis.__argoSessionListProbe?.delay.reset())
  const started = performance.now()
  await action()
  await page.waitForTimeout(300)
  const elapsedMs = Number((performance.now() - started).toFixed(2))
  const after = await mainSnapshot(application)
  const renderer = await rendererSnapshot(page)
  const sidebar = page.getByRole('complementary', { name: 'Sessions' })
  const listOffset = Number(await sidebar.getAttribute('data-offset'))
  const listRetained = Number(await sidebar.getAttribute('data-retained'))
  const listTotal = Number(await sidebar.getAttribute('data-total'))
  const ipc = Object.fromEntries(
    Object.entries(after.ipc).map(([name, current]) => {
      const previous = before.ipc[name] ?? { messages: 0, bytes: 0 }
      return [
        name,
        { messages: current.messages - previous.messages, bytes: current.bytes - previous.bytes },
      ]
    }),
  )
  return {
    label,
    elapsedMs,
    syncReads: after.syncReads - before.syncReads,
    syncReadBytes: after.syncReadBytes - before.syncReadBytes,
    syncDirectoryReads: after.syncDirectoryReads - before.syncDirectoryReads,
    syncStats: after.syncStats - before.syncStats,
    asyncReads: after.asyncReads - before.asyncReads,
    asyncReadBytes: after.asyncReadBytes - before.asyncReadBytes,
    activeWatchers: after.activeWatchers,
    listOffset,
    listRetained,
    listTotal,
    listOwnedReaderCount: listRetained,
    eventLoopDelay: after.delay,
    mainRssMb: after.mainRssMb,
    rendererWorkingSetMb: after.rendererWorkingSetMb,
    ...renderer,
    ipc,
  }
}

function sqlMeasurements(userData: string) {
  const databaseFile = path.join(userData, 'argo.sqlite')
  const database = new DatabaseSync(databaseFile)
  const listColumns = `session.argo_id, session.harness, session.native_id,
    session.custom_title, session.preview, session.first_prompt, session.cwd,
    session.workspace_id, session.activity_at, session.list_order_at, session.updated_at,
    session_ticket_link.project_id, session_ticket_link.ticket_key,
    session_ticket_link.title, session_ticket_link.state, session_ticket_link.created_at`
  const listFrom = `FROM session LEFT JOIN session_ticket_link
    ON session_ticket_link.session_id = session.argo_id`
  const browse = `SELECT ${listColumns} ${listFrom} WHERE session.project_id = ? AND NOT EXISTS
    (SELECT 1 FROM session_archive WHERE session_archive.session_id = session.argo_id)
    AND (session.list_order_at, session.argo_id) <= (?, ?)
    ORDER BY session.list_order_at DESC, session.argo_id DESC LIMIT 60`
  const earlier = `SELECT ${listColumns} ${listFrom} WHERE session.project_id = ? AND NOT EXISTS
    (SELECT 1 FROM session_archive WHERE session_archive.session_id = session.argo_id)
    AND (session.list_order_at, session.argo_id) > (?, ?)
    ORDER BY session.list_order_at ASC, session.argo_id ASC LIMIT 30`
  const search = `SELECT ${listColumns} ${listFrom} WHERE session.project_id = ? AND NOT EXISTS
    (SELECT 1 FROM session_archive WHERE session_archive.session_id = session.argo_id)
    AND (instr(lower(coalesce(session.custom_title, '')), lower(?)) > 0
      OR instr(lower(coalesce(session.preview, '')), lower(?)) > 0)
    ORDER BY session.list_order_at DESC, session.argo_id DESC LIMIT 60`
  const count = `SELECT count(*) FROM session WHERE project_id = ? AND NOT EXISTS
    (SELECT 1 FROM session_archive WHERE session_archive.session_id = session.argo_id)`
  const archive = `SELECT session_id FROM session_archive`
  const archivedIds = database
    .prepare(archive)
    .all()
    .map((row) => String(row.session_id))
  const archiveRows = `SELECT session.argo_id FROM session LEFT JOIN session_ticket_link
    ON session_ticket_link.session_id = session.argo_id WHERE session.project_id = ?
    AND session.argo_id IN (${archivedIds.map(() => '?').join(',')})`
  // A key in the middle of the active list, where a scrolled window seeks from.
  const middle = database
    .prepare(
      'SELECT list_order_at, argo_id FROM session WHERE project_id = ? ORDER BY list_order_at DESC, argo_id DESC LIMIT 1 OFFSET 300',
    )
    .get(PROJECT_ID) as { list_order_at: number; argo_id: string }
  const key = [middle.list_order_at, middle.argo_id]
  const queries = [
    { name: 'browse', sql: browse, arguments: [PROJECT_ID, ...key] },
    { name: 'earlier', sql: earlier, arguments: [PROJECT_ID, ...key] },
    { name: 'search', sql: search, arguments: [PROJECT_ID, 'Needle', 'Needle'] },
    { name: 'count', sql: count, arguments: [PROJECT_ID] },
    { name: 'archive', sql: archive, arguments: [] },
    { name: 'archive rows', sql: archiveRows, arguments: [PROJECT_ID, ...archivedIds] },
  ]
  const measurements = queries.map((query) => {
    const statement = database.prepare(query.sql)
    const runs: number[] = []
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now()
      statement.all(...query.arguments)
      runs.push(Number((performance.now() - started).toFixed(4)))
    }
    const plan = database.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.arguments)
    let literalSql = query.sql
    for (const argument of query.arguments)
      literalSql = literalSql.replace('?', `'${String(argument).replaceAll("'", "''")}'`)
    const scanStats = execFileSync('sqlite3', ['-cmd', '.scanstats on', databaseFile, literalSql], {
      encoding: 'utf8',
    })
    return { name: query.name, sql: query.sql, runsMs: runs, plan, scanStats }
  })
  const update = database.prepare('UPDATE session SET preview = ? WHERE argo_id = ?')
  const commitsMs: number[] = []
  for (let index = 0; index < 20; index += 1) {
    database.exec('BEGIN')
    update.run(`Updated preview ${index}`, sessionId(0))
    const started = performance.now()
    database.exec('COMMIT')
    commitsMs.push(Number((performance.now() - started).toFixed(4)))
  }
  database.close()
  return { measurements, commitsMs }
}

type Fixture = Awaited<ReturnType<typeof prepare>>
type Corpus = Awaited<ReturnType<typeof buildCorpus>>

async function launchEnvironment(root: string, fixture: Fixture) {
  const mock = await createMockSessionHarnessBackend().start({ root, fixture })
  const homes = {
    claude: path.join(root, 'claude-config'),
    codex: path.join(root, 'codex-home'),
  }
  await Promise.all(Object.values(homes).map((home) => mkdir(home, { recursive: true })))
  const claudeConfig = homes.claude
  const codexHome = homes.codex
  await symlink(fixture.claudeTranscripts, path.join(claudeConfig, 'projects'))
  return {
    ...process.env,
    ARGO_SESSION_LIST_CORPUS_ROOTS: [
      fixture.claudeTranscripts,
      fixture.codexTranscripts,
      claudeConfig,
      codexHome,
    ].join(':'),
    CLAUDE_CONFIG_DIR: claudeConfig,
    CODEX_HOME: codexHome,
    [claudeProof.SESSION_CLAUDE_TRANSCRIPTS_ENV]: fixture.claudeTranscripts,
    [codexProof.SESSION_CODEX_TRANSCRIPTS_ENV]: fixture.codexTranscripts,
    [claudeProof.SESSION_CLAUDE_EXECUTABLE_ENV]: mock.executables.claude,
    [codexProof.SESSION_CODEX_EXECUTABLE_ENV]: mock.executables.codex,
    ...mock.launchEnv({ slowReply: false }),
    [PROJECT_PROOF_STORE_ENV]: fixture.userData,
    [ACCEPTANCE_ENV]: '0',
  }
}

async function withStartupProbe(root: string, action: () => Promise<void>) {
  const mainEntry = path.join(process.cwd(), '.vite/build/main.js')
  const preloadPath = path.join(root, 'session-list-startup-probe.cjs')
  execFileSync('bun', [
    'build',
    PRELOAD,
    '--target=node',
    '--format=cjs',
    `--outfile=${preloadPath}`,
  ])
  const original = await readFile(mainEntry, 'utf8')
  try {
    await writeFile(mainEntry, `require(${JSON.stringify(preloadPath)});${original}`)
    await action()
  } finally {
    await writeFile(mainEntry, original)
  }
}

async function readyPage(application: ElectronApplication, started: number) {
  const page = await application.firstWindow()
  page.setDefaultTimeout(WAIT_MS)
  await application.evaluate(({ BrowserWindow }, size) => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    mainWindow.setContentSize(size.width, size.height)
  }, VIEWPORT)
  await page.waitForFunction(
    (size) =>
      document.documentElement.clientWidth === size.width &&
      document.documentElement.clientHeight === size.height,
    VIEWPORT,
  )
  const sidebar = page.getByRole('complementary', { name: 'Sessions' })
  await sidebar.waitFor()
  const total = Number(await sidebar.getAttribute('data-total'))
  if (total < SESSION_COUNT - ARCHIVED_COUNT)
    throw new Error(`Expected at least ${SESSION_COUNT - ARCHIVED_COUNT} Sessions, got ${total}.`)
  const startupMs = Number((performance.now() - started).toFixed(2))
  const startup = await mainSnapshot(application)
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show())
  await armIpc(application)
  await armFrames(page)
  return { page, sidebar, startupMs, startup }
}

type GestureContext = {
  application: ElectronApplication
  page: Page
  sidebar: Locator
  corpus: Corpus
}

function measureFor(context: GestureContext) {
  return (label: string, action: () => Promise<void>) =>
    step({ label, page: context.page, application: context.application, action })
}

async function waitForOne(sidebar: Locator, page: Page) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await sidebar.getAttribute('data-total')) === '1') return
    await page.waitForTimeout(100)
  }
  throw new Error(`Search returned ${await sidebar.getAttribute('data-total')} rows, expected 1.`)
}

async function browseGestures(context: GestureContext) {
  const { page } = context
  const measure = measureFor(context)
  const scroll = page.locator('[data-slot="session-list-scroll"]')
  const down = await measure('down scroll', async () => {
    const box = await scroll.boundingBox()
    if (box === null) throw new Error('Session List scroll area is not visible.')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let index = 0; index < 8; index += 1) {
      await page.mouse.wheel(0, 1100)
      await page.waitForTimeout(80)
    }
  })
  const up = await measure('up scroll', async () => {
    for (let index = 0; index < 8; index += 1) {
      await page.mouse.wheel(0, -1100)
      await page.waitForTimeout(80)
    }
  })
  return [down, up]
}

async function feedAndSearchGestures(context: GestureContext) {
  const { page, sidebar, corpus } = context
  const measure = measureFor(context)
  const search = page.getByRole('textbox', { name: 'Search Sessions' })
  const open = await measure('find and open massive transcript', async () => {
    await search.fill('Massive Session List transcript')
    await waitForOne(sidebar, page)
    await page.locator(`[data-session-id="${corpus.largeSessionId}"]`).click()
    await page.locator('.feed__document[data-active="true"] [data-feed-row]').first().waitFor()
    await search.clear()
  })
  const found = await measure('search', async () => {
    await search.fill('Needle')
    await waitForOne(sidebar, page)
  })
  await search.clear()
  return [open, found]
}

async function archiveAndSelectionGestures(context: GestureContext) {
  const { page, corpus } = context
  const measure = measureFor(context)
  const archive = await measure('Archive', async () => {
    await page.getByRole('button', { name: 'Filter Sessions' }).click()
    await page.getByRole('menuitemradio', { name: 'Archived' }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(750)
    if ((await page.locator('[data-archived="true"]').count()) === 0)
      throw new Error('Archive filter showed no Session rows.')
  })
  const append = await measure('large Claude and Codex append', async () => {
    await appendFile(corpus.largePath, buildHistory(corpus.cwd, 1_000_000).text)
    await appendFile(corpus.codexExample, corpus.codexAppend)
    await page.waitForTimeout(750)
  })
  const selection = await measure('rapid selection', async () => {
    const visibleIds = await page
      .locator('nav[aria-label="Sessions"] button[data-session-id]')
      .evaluateAll((elements) =>
        elements.slice(0, 6).map((element) => element.getAttribute('data-session-id')),
      )
    if (visibleIds.length < 6)
      throw new Error(`Only ${visibleIds.length} Session rows are visible.`)
    for (const id of visibleIds)
      await page.locator(`nav[aria-label="Sessions"] button[data-session-id="${id}"]`).click()
  })
  return [archive, append, selection]
}

async function runGestures(context: GestureContext) {
  return [
    ...(await browseGestures(context)),
    ...(await feedAndSearchGestures(context)),
    ...(await archiveAndSelectionGestures(context)),
  ]
}

async function reportRun(request: {
  application: ElectronApplication
  fixture: Fixture
  corpus: Corpus
  startupMs: number
  startup: MainSnapshot
  steps: Awaited<ReturnType<typeof runGestures>>
}) {
  const { application, fixture, corpus, startupMs, startup, steps } = request
  const result = {
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    machine: {
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpus: os
        .cpus()
        .map((cpu) => cpu.model)
        .filter((cpu, index, all) => all.indexOf(cpu) === index),
      memoryGb: Number((os.totalmem() / 1_073_741_824).toFixed(1)),
      node: process.version,
      electron: await application.evaluate(() => globalThis.process.versions.electron),
    },
    corpus: {
      savedSessions: SESSION_COUNT,
      archivedSessions: ARCHIVED_COUNT,
      extraClaudeFiles: EXTRA_CLAUDE_FILES,
      extraCodexFiles: EXTRA_CODEX_FILES,
      largeTranscriptBytes: corpus.largeBytes,
      largeTranscriptTurns: corpus.largeTurns,
    },
    viewport: VIEWPORT,
    cache:
      'fresh temporary userData and Electron process; prebuilt Vite assets and OS file cache not flushed',
    startupMs,
    startup,
    steps,
    final: await mainSnapshot(application),
    sql: sqlMeasurements(fixture.userData),
  }
  const json = value('json')
  if (json !== null) await writeFile(json, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
}

async function measureApplication(request: {
  fixture: Fixture
  corpus: Corpus
  environment: NodeJS.ProcessEnv
}) {
  const { fixture, corpus, environment } = request
  const started = performance.now()
  const command = launchCommand(fixture.application)
  const application = await electron.launch({
    ...command,
    env: environment,
  })
  try {
    const { page, sidebar, startupMs, startup } = await readyPage(application, started)
    const steps = await runGestures({ application, page, sidebar, corpus })
    await reportRun({ application, fixture, corpus, startupMs, startup, steps })
  } finally {
    await application.close()
  }
}

async function run() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-session-list-')))
  try {
    const fixture = await prepare(root, await applicationUnderTest(root), { projectSelected: true })
    const corpus = await buildCorpus(fixture)
    const environment = await launchEnvironment(root, fixture)
    await withStartupProbe(root, () => measureApplication({ fixture, corpus, environment }))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

await run()
