// Re-records the vendor history recordings from the installed claude and codex CLIs, under a
// throwaway HOME. Run from apps/desktop: `bun run record:vendor-history`.
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import type {
  CodexAppServerClient,
  ThreadListResponse,
  ThreadReadResponse,
  ThreadTurnsListResponse,
  WireMessage,
} from '@/harnesses/codex/app-server'
import { CODEX_SESSION_SOURCE_KINDS } from '@/harnesses/codex/app-server'
import { readModelCatalog } from '@/harnesses/codex/catalog'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import {
  claudeSessionMessages,
  claudeSessions,
} from '../../e2e/sessions/real-harness/claude-vendor-reader'
import { codexClientUnderHome } from '../../e2e/sessions/real-harness/real-codex-harness'
import {
  prepareRealSessionHome,
  realHarnessEnvironment,
  resolveRealSessionExecutables,
  verifyRealSessionAuthentication,
} from '../../e2e/sessions/real-harness/real-session-harness-backend'
import type { ClaudeRecording } from '../../mocks/cli/claude/recorded-claude-sessions'
import type {
  CodexRecording,
  RecordedCodexCall,
} from '../../mocks/cli/codex/recorded-codex-threads'
import { RECORDED_PROMPTS } from '../../mocks/cli/recorded-prompts'
import { loadRecording, type RecordingMetadata } from '../../mocks/recordings/recording'

// Recorded paths read as this mock home, which a selected Project scopes out.
const MOCK_HOME = '/Users/x'
const CLAUDE_MODEL = 'haiku'
const CODEX_MODEL = 'gpt-6-luna'
const CODEX_EFFORT = 'low'
const TURN_BUDGET_MS = 180_000
// A user config with hooks of its own, which the status hook install must keep.
const CODEX_USER_CONFIG = `model = "gpt-6-luna"

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "say done"

[[hooks.PreToolUse]]
matcher = "^Bash$"
[[hooks.PreToolUse.hooks]]
type = "command"
command = "./check.sh"
`
const RECORDINGS = {
  claude: {
    producer: 'claude-cli',
    file: 'session-history-claude.ts',
    harness: 'claude',
    loader: 'recorded-claude-sessions',
    type: 'ClaudeRecording',
    name: 'claudeRecording',
  },
  codex: {
    producer: 'codex-app-server',
    file: 'thread-history-codex.ts',
    harness: 'codex',
    loader: 'recorded-codex-threads',
    type: 'CodexRecording',
    name: 'codexRecording',
  },
} as const
const CODEX_SUBAGENT_RECORDING = 'thread-read-subagents.json'

type Executables = Record<'claude' | 'codex', string>
type Recorder = { root: string; home: string; executables: Executables }

function cliVersion(executable: string): string {
  const output = execFileSync(executable, ['--version'], { encoding: 'utf8' })
  const version = output.match(/\d+\.\d+\.\d+/)?.[0]
  if (version === undefined) throw new Error(`${executable} --version printed no version.`)
  return version
}

async function project(
  recorder: Pick<Recorder, 'root'>,
  name: string,
  files: Record<string, string> = {},
) {
  const directory = path.join(recorder.root, name)
  await mkdir(directory, { recursive: true })
  execFileSync('git', ['init', '--quiet'], { cwd: directory })
  for (const [file, text] of Object.entries(files)) {
    await writeFile(path.join(directory, file), text)
  }
  return directory
}

type ClaudeTurn = { cwd: string; prompt: string; flags?: string[] }

// One headless Claude turn; returns the Session it wrote to.
function claudeTurn(recorder: Recorder, { cwd, prompt, flags = [] }: ClaudeTurn) {
  const output = execFileSync(
    recorder.executables.claude,
    ['-p', prompt, '--model', CLAUDE_MODEL, '--effort', 'low', '--output-format', 'json', ...flags],
    { cwd, env: realHarnessEnvironment(recorder.home), encoding: 'utf8', timeout: TURN_BUDGET_MS },
  )
  const sessionId = (JSON.parse(output) as { session_id?: unknown }).session_id
  if (typeof sessionId !== 'string') throw new Error(`Claude printed no session_id: ${output}`)
  return sessionId
}

async function recordClaudeSessions(recorder: Recorder) {
  claudeTurn(recorder, {
    cwd: await project(recorder, 'prose'),
    prompt: RECORDED_PROMPTS.claudeProse,
  })
  claudeTurn(recorder, {
    cwd: await project(recorder, 'thought'),
    prompt: RECORDED_PROMPTS.claudeThought,
  })
  claudeTurn(recorder, {
    cwd: await project(recorder, 'command', { 'notes.txt': 'old\n' }),
    prompt: RECORDED_PROMPTS.claudeToolCalls,
    flags: ['--allowedTools', 'Bash(echo argo-recorded)', 'Read', 'Edit'],
  })
  const cwd = await project(recorder, 'resume')
  const parent = claudeTurn(recorder, {
    cwd,
    prompt: RECORDED_PROMPTS.claudeParent,
  })
  claudeTurn(recorder, {
    cwd,
    prompt: RECORDED_PROMPTS.claudeContinue,
    flags: ['--resume', parent],
  })
  claudeTurn(recorder, {
    cwd,
    prompt: RECORDED_PROMPTS.claudeBranch,
    flags: ['--resume', parent, '--fork-session'],
  })
}

async function recordClaude(recorder: Recorder): Promise<ClaudeRecording> {
  await recordClaudeSessions(recorder)
  const configDirectory = path.join(recorder.home, '.claude')
  const sessions = await claudeSessions(configDirectory)
  const calls: ClaudeRecording['calls'] = [
    { method: 'listSessions', params: { includeProgrammatic: true }, result: sessions },
  ]
  for (const { sessionId } of sessions) {
    const result = await claudeSessionMessages(configDirectory, sessionId)
    calls.push({ method: 'getSessionMessages', params: { sessionId }, result })
  }
  return {
    producer: 'claude-cli',
    version: cliVersion(recorder.executables.claude),
    recordedAt: new Date().toISOString(),
    agentSdk: await sdkVersion(),
    calls,
  }
}

async function sdkVersion(): Promise<string> {
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
    dependencies: Record<string, string>
  }
  const version = manifest.dependencies['@anthropic-ai/claude-agent-sdk']
  if (version === undefined) throw new Error('package.json names no Agent SDK version.')
  return version
}

function turnCompleted(client: CodexAppServerClient, threadId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Codex turn timed out.')), TURN_BUDGET_MS)
    const stop = client.onNotification((message: WireMessage) => {
      if (!('method' in message) || message.method !== 'turn/completed') return undefined
      if (message.params.threadId !== threadId) return undefined
      clearTimeout(timer)
      stop()
      resolve()
      return undefined
    })
  })
}

async function codexThread(client: CodexAppServerClient, cwd: string, prompt: string) {
  const { thread } = await client.request(
    'thread/start',
    { cwd, model: CODEX_MODEL, approvalPolicy: 'never', sandbox: 'read-only' },
    (value) => value as { thread: { id: string } },
  )
  const completed = turnCompleted(client, thread.id)
  await client.request(
    'turn/start',
    {
      threadId: thread.id,
      input: [{ type: 'text', text: prompt, text_elements: [] }],
      model: CODEX_MODEL,
      effort: CODEX_EFFORT,
    },
    (value) => value,
  )
  await completed
  return thread.id
}

async function recordCodex(
  recorder: Recorder,
): Promise<{ history: CodexRecording; models: unknown }> {
  const client = await codexClientUnderHome(recorder.home, recorder.executables.codex)
  try {
    const cwd = await project(recorder, 'project-codex')
    await codexThread(client, cwd, RECORDED_PROMPTS.codexCommand)
    await codexThread(client, cwd, RECORDED_PROMPTS.codexReply)
    await codexThread(client, cwd, RECORDED_PROMPTS.codexNotice)
    const listParams = { limit: 50 }
    const listed = await client.request(
      'thread/list',
      listParams,
      (value) => value as ThreadListResponse,
    )
    const calls: RecordedCodexCall[] = [
      { method: 'thread/list', params: listParams, result: listed },
    ]
    for (const { id: threadId } of listed.data) {
      const readParams = { threadId, includeTurns: true }
      const read = await client.request(
        'thread/read',
        readParams,
        (value) => value as ThreadReadResponse,
      )
      calls.push({ method: 'thread/read', params: readParams, result: read })
      const turnsParams = { threadId, limit: 50, itemsView: 'full' as const }
      const turns = await client.request(
        'thread/turns/list',
        turnsParams,
        (value) => value as ThreadTurnsListResponse,
      )
      calls.push({ method: 'thread/turns/list', params: turnsParams, result: turns })
    }
    calls.push(await recordCodexConfig(recorder))
    return {
      history: {
        producer: 'codex-app-server',
        version: cliVersion(recorder.executables.codex),
        recordedAt: new Date().toISOString(),
        calls,
      },
      models: await recordCodexModels(client),
    }
  } finally {
    client.shutdown()
  }
}

type CodexSubagentCapture = {
  thread: ThreadReadResponse['thread']
  threadList: ThreadListResponse
  childThread: ThreadReadResponse['thread']
}

type CodexSubagentRecorder = { root: string; home: string; executable: string }

function runCodexSubagent(recorder: CodexSubagentRecorder, cwd: string) {
  execFileSync(
    recorder.executable,
    [
      'exec',
      '--enable',
      'multi_agent',
      '--model',
      CODEX_MODEL,
      '--config',
      'model_reasoning_effort="low"',
      '--sandbox',
      'read-only',
      '--cd',
      cwd,
      '--json',
      RECORDED_PROMPTS.codexSubagent,
    ],
    {
      env: realHarnessEnvironment(recorder.home),
      stdio: ['ignore', 'ignore', 'inherit'],
      timeout: TURN_BUDGET_MS,
    },
  )
}

async function recordCodexSubagent(recorder: CodexSubagentRecorder): Promise<CodexSubagentCapture> {
  await writeFile(
    path.join(recorder.home, '.codex', 'config.toml'),
    '[features]\nmulti_agent = true\n',
  )
  const cwd = await project(recorder, 'project-codex-subagent')
  runCodexSubagent(recorder, cwd)
  return readCodexSubagentCapture(recorder, cwd)
}

async function readCodexSubagentCapture(
  recorder: CodexSubagentRecorder,
  cwd: string,
): Promise<CodexSubagentCapture> {
  const client = await codexClientUnderHome(recorder.home, recorder.executable, cwd)
  try {
    const params = {
      limit: 50,
      sourceKinds: ['exec', ...CODEX_SESSION_SOURCE_KINDS] as (
        | 'exec'
        | (typeof CODEX_SESSION_SOURCE_KINDS)[number]
      )[],
    }
    const threadList = await client.request(
      'thread/list',
      params,
      (value): ThreadListResponse => value as ThreadListResponse,
    )
    const parent = threadList.data.find(
      ({ cwd: threadCwd, parentThreadId }) => threadCwd === cwd && parentThreadId == null,
    )
    if (parent === undefined) throw new Error('Codex did not list the recorded parent Thread.')
    const parentId = parent.id
    const parentResponse = await client.request(
      'thread/read',
      { threadId: parentId, includeTurns: true },
      (value) => value as ThreadReadResponse,
    )
    const childId =
      threadList.data.find(({ parentThreadId }) => parentThreadId === parentId)?.id ??
      parentResponse.thread.turns
        .flatMap(({ items }) => items)
        .find(
          (
            item,
          ): item is Extract<
            ThreadReadResponse['thread']['turns'][number]['items'][number],
            { type: 'subAgentActivity' }
          > => item.type === 'subAgentActivity' && item.kind === 'started',
        )?.agentThreadId
    if (childId === undefined)
      throw new Error('Codex did not spawn a child for its subagent prompt.')
    const childResponse = await client.request(
      'thread/read',
      { threadId: childId, includeTurns: false },
      (value) => value as ThreadReadResponse,
    )
    if (childResponse.thread.parentThreadId !== parentId) {
      throw new Error('Codex child Thread did not retain its recorded parentThreadId.')
    }
    return {
      thread: parentResponse.thread,
      threadList,
      childThread: childResponse.thread,
    }
  } finally {
    client.shutdown()
  }
}

async function writeCodexSubagentRecording(
  capture: CodexSubagentCapture,
  version: string,
  writer: RecordingWriter,
) {
  const recording = {
    producer: 'codex-app-server',
    version,
    recordedAt: new Date().toISOString(),
    payload: capture,
  } satisfies RecordingMetadata & { payload: CodexSubagentCapture }
  const file = await recordingFile(recording, CODEX_SUBAGENT_RECORDING, recording)
  await writeFile(file, sanitized(writer.recorder, recording, writer.resolvedRoot))
  return file
}

// The config layers, read by a fresh app-server once the user config holds hooks; after the
// threads, so no recorded Turn runs them.
async function recordCodexConfig(recorder: Recorder): Promise<RecordedCodexCall> {
  await writeFile(path.join(recorder.home, '.codex', 'config.toml'), CODEX_USER_CONFIG)
  const client = await codexClientUnderHome(recorder.home, recorder.executables.codex)
  try {
    const params = { includeLayers: true }
    const { layers } = await client.request(
      'config/read',
      params,
      (value) => value as Extract<RecordedCodexCall, { method: 'config/read' }>['result'],
    )
    return { method: 'config/read', params, result: { layers } }
  } finally {
    client.shutdown()
  }
}

// Every throwaway and personal path becomes the mock home; a user name left over is refused.
function sanitized(
  recorder: Pick<Recorder, 'root' | 'home'>,
  recording: unknown,
  resolvedRoot: string,
): string {
  let text = JSON.stringify(recording, null, 2)
  for (const local of [resolvedRoot, recorder.root, os.homedir()]) {
    text = text.split(local).join(MOCK_HOME)
  }
  const username = os.userInfo().username
  // A listing a CLI ran names the file owner.
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  text = text.replace(new RegExp(`\\b${escaped}\\b`, 'g'), 'x')
  const named = text.indexOf(username)
  if (named !== -1) {
    const context = text.slice(Math.max(0, named - 80), named + 80)
    throw new Error(`The recording still names the local user; nothing was written:\n${context}`)
  }
  return text
}

async function recordCodexModels(client: CodexAppServerClient): Promise<unknown> {
  return client.request('model/list', { includeHidden: true, limit: 100 }, (value) => {
    const catalog = readModelCatalog(value)
    if (catalog.nextCursor)
      throw new Error('Model catalog exceeds one page; recording was not saved.')
    return value
  })
}

type RecordingWriter = { recorder: Pick<Recorder, 'root' | 'home'>; resolvedRoot: string }

async function recordCodexSubagentsOnly(root: string) {
  const executable = findExecutableOnLoginShellPath('codex')
  if (executable === null) throw new Error('Codex is not available on PATH.')
  const home = path.join(root, 'home')
  const sourceAuth = path.join(os.homedir(), '.codex', 'auth.json')
  const destinationAuth = path.join(home, '.codex', 'auth.json')
  try {
    await mkdir(path.dirname(destinationAuth), { recursive: true })
    await copyFile(sourceAuth, destinationAuth)
  } catch {
    throw new Error(`Codex authentication is unavailable: ${sourceAuth} is missing.`)
  }
  await mkdir(path.join(home, '.codex', 'sessions'), { recursive: true })
  try {
    execFileSync(executable, ['login', 'status'], {
      env: realHarnessEnvironment(home),
      stdio: 'pipe',
    })
  } catch (error) {
    const output = error instanceof Error && 'stderr' in error ? String(error.stderr).trim() : ''
    throw new Error(
      `Codex authentication is unavailable. Sign in and try again.${output ? `\n${output}` : ''}`,
    )
  }
  const recorder = { root, home, executable }
  const capture = await recordCodexSubagent(recorder)
  const metadata = {
    producer: 'codex-app-server',
    version: cliVersion(executable),
    recordedAt: new Date().toISOString(),
  }
  const writer = { recorder, resolvedRoot: await realpath(root) }
  const file = await writeCodexSubagentRecording(capture, metadata.version, writer)
  execFileSync('bunx', ['biome', 'format', '--write', file], { stdio: 'inherit' })
  execFileSync(process.execPath, ['tools/recordings/generate-recording-imports.mts'], {
    stdio: 'inherit',
  })
  process.stdout.write(
    'Recorded Codex parent and child Threads. Read the diff, then run `bun run typecheck` and the tests.\n',
  )
}

async function recordingFile(metadata: RecordingMetadata, name: string, value: unknown) {
  const relative = `${metadata.producer}/${metadata.version}/${name}`
  loadRecording(relative, value)
  const file = path.join('mocks/recordings', relative)
  await mkdir(path.dirname(file), { recursive: true })
  return file
}

async function writeRecording(
  specification: (typeof RECORDINGS)[keyof typeof RECORDINGS],
  recording: ClaudeRecording | CodexRecording,
  writer: RecordingWriter,
) {
  const file = await recordingFile(recording, specification.file, recording)
  await writeFile(
    file,
    `// Written by \`bun run record:vendor-history\`; do not edit by hand.
import type { Recorded } from '../../recorded'
import type { ${specification.type} } from '../../../cli/${specification.harness}/${specification.loader}'

export const ${specification.name}: Recorded<${specification.type}> = ${sanitized(writer.recorder, recording, writer.resolvedRoot)}
`,
  )
  return file
}

async function writeModels(writer: RecordingWriter, history: CodexRecording, models: unknown) {
  const recording = {
    producer: history.producer,
    version: history.version,
    recordedAt: history.recordedAt,
    payload: models,
  }
  const file = await recordingFile(recording, 'model-list.json', recording)
  await writeFile(file, sanitized(writer.recorder, recording, writer.resolvedRoot))
  return file
}

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-vendor-recording-'))
  try {
    if (process.argv.includes('--codex-subagents-only')) {
      await recordCodexSubagentsOnly(root)
      return
    }
    const executables = resolveRealSessionExecutables(findExecutableOnLoginShellPath)
    const home = await prepareRealSessionHome(root, os.homedir())
    verifyRealSessionAuthentication(executables, home)
    const recorder = { root, home, executables }
    const resolvedRoot = await realpath(root)
    const writer = { recorder, resolvedRoot }
    const claude = await recordClaude(recorder)
    const codex = await recordCodex(recorder)
    const codexSubagents = await recordCodexSubagent({
      root,
      home,
      executable: executables.codex,
    })
    const files = [
      await writeRecording(RECORDINGS.claude, claude, writer),
      await writeRecording(RECORDINGS.codex, codex.history, writer),
      await writeModels(writer, codex.history, codex.models),
      await writeCodexSubagentRecording(codexSubagents, codex.history.version, writer),
    ]
    execFileSync('bunx', ['biome', 'format', '--write', ...files], {
      stdio: 'inherit',
    })
    execFileSync(process.execPath, ['tools/recordings/generate-recording-imports.mts'], {
      stdio: 'inherit',
    })
    process.stdout.write('Recorded. Read the diff, then run `bun run typecheck` and the tests.\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

await main()
