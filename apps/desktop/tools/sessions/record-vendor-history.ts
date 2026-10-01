// Re-records the vendor history recordings from the installed claude and codex CLIs, under a
// throwaway HOME. Run from apps/desktop: `bun run record:vendor-history`.
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import type {
  CodexAppServerClient,
  ThreadListResponse,
  ThreadReadResponse,
  ThreadTurnsListParams,
  ThreadTurnsListResponse,
  WireMessage,
} from '@/harnesses/codex/app-server'
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
const CLAUDE_MODEL = 'sonnet'
const CODEX_MODEL = 'gpt-5.6-luna'
const CODEX_EFFORT = 'low'
const TURN_BUDGET_MS = 180_000
// A user config with hooks of its own, which the status hook install must keep.
const CODEX_USER_CONFIG = `model = "gpt-5.5"

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

type Executables = Record<'claude' | 'codex', string>
type Recorder = { root: string; home: string; executables: Executables }

function cliVersion(executable: string): string {
  const output = execFileSync(executable, ['--version'], { encoding: 'utf8' })
  const version = output.match(/\d+\.\d+\.\d+/)?.[0]
  if (version === undefined) throw new Error(`${executable} --version printed no version.`)
  return version
}

async function project(recorder: Recorder, name: string, files: Record<string, string> = {}) {
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
    ['-p', prompt, '--model', CLAUDE_MODEL, '--output-format', 'json', ...flags],
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

async function codexTurn(client: CodexAppServerClient, threadId: string, prompt: string) {
  const completed = turnCompleted(client, threadId)
  await client.request(
    'turn/start',
    {
      threadId,
      input: [{ type: 'text', text: prompt, text_elements: [] }],
      model: CODEX_MODEL,
      effort: CODEX_EFFORT,
    },
    (value) => value,
  )
  await completed
}

async function codexThread(client: CodexAppServerClient, cwd: string, prompts: string[]) {
  const { thread } = await client.request(
    'thread/start',
    { cwd, model: CODEX_MODEL, approvalPolicy: 'never', sandbox: 'read-only' },
    (value) => value as { thread: { id: string } },
  )
  for (const prompt of prompts) await codexTurn(client, thread.id, prompt)
}

// A thread's Turns one to a page, so a thread of two Turns records the cursor between them.
async function recordCodexTurnPages(client: CodexAppServerClient, threadId: string) {
  const calls: RecordedCodexCall[] = []
  let cursor: string | null = null
  do {
    const params: ThreadTurnsListParams = {
      threadId,
      limit: 1,
      itemsView: 'full',
      sortDirection: 'asc',
      cursor,
    }
    const result: ThreadTurnsListResponse = await client.request(
      'thread/turns/list',
      params,
      (value) => value as ThreadTurnsListResponse,
    )
    calls.push({ method: 'thread/turns/list', params, result })
    cursor = result.nextCursor
  } while (cursor !== null)
  return calls
}

async function recordCodex(
  recorder: Recorder,
): Promise<{ history: CodexRecording; models: unknown }> {
  const client = await codexClientUnderHome(recorder.home, recorder.executables.codex)
  try {
    const cwd = await project(recorder, 'project-codex')
    await codexThread(client, cwd, [RECORDED_PROMPTS.codexCommand, RECORDED_PROMPTS.codexFollowUp])
    await codexThread(client, cwd, [RECORDED_PROMPTS.codexReply])
    await codexThread(client, cwd, [RECORDED_PROMPTS.codexNotice])
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
      const readParams = { threadId, includeTurns: false as const }
      const read = await client.request(
        'thread/read',
        readParams,
        (value) => value as ThreadReadResponse,
      )
      calls.push({ method: 'thread/read', params: readParams, result: read })
      calls.push(...(await recordCodexTurnPages(client, threadId)))
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
function sanitized(recorder: Recorder, recording: unknown, resolvedRoot: string): string {
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

type RecordingWriter = { recorder: Recorder; resolvedRoot: string }

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
    const executables = resolveRealSessionExecutables(findExecutableOnLoginShellPath)
    const home = await prepareRealSessionHome(root, os.homedir())
    verifyRealSessionAuthentication(executables, home)
    const recorder = { root, home, executables }
    const resolvedRoot = await realpath(root)
    const writer = { recorder, resolvedRoot }
    const claude = await recordClaude(recorder)
    const codex = await recordCodex(recorder)
    const files = [
      await writeRecording(RECORDINGS.claude, claude, writer),
      await writeRecording(RECORDINGS.codex, codex.history, writer),
      await writeModels(writer, codex.history, codex.models),
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
