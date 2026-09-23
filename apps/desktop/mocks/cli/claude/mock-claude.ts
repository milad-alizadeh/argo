// A stand-in `claude` for the packaged resume proof, run by node's type stripping. It answers the
// flags Argo launches with and writes each Turn it is sent where the real CLI writes transcripts.

import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/domains/sessions/contract/proof-protocol'
import { type AdversarialTurn, adversarialTurn } from '../../sessions/adversarial-turns.ts'
import { MOCK_CLAUDE_PROCESS_TITLE } from '../mock-cli-process-titles.mts'
import { createMockClaudeHooks } from './mock-claude-hooks.ts'
import { replyToSdkPrompt } from './mock-claude-sdk-reply.ts'
import { startMockClaudeSdkStream } from './mock-claude-sdk-stream.ts'
import { settleMockClaudeTurn } from './mock-claude-turn.ts'
import { projectSetupReply } from './mock-project-setup.ts'

process.title = MOCK_CLAUDE_PROCESS_TITLE

const ESCAPE = String.fromCharCode(27)
// Long enough for the proof to read the running compaction before the boundary ends it; that read
// landed 6ms after the click when measured (#2225).
const COMPACTION_DELAY = 1_000
const COMPACT = /\/compact[\r\n]/
// Argo's bracketed paste, then its carriage return, which the line discipline turns into a
// newline when it arrives before this process has switched the terminal to raw mode.
const TURN = new RegExp(`${ESCAPE}\\[200~([\\s\\S]*?)${ESCAPE}\\[201~[\\r\\n]`)
// The real CLI's own slash command: it writes a `custom-title` record rather than answering as a
// Turn, and Argo's `driver.rename` reads that record back with source `custom` (issue #2134).
const RENAME = /^\/rename (.+)$/
const replyDelay = Number(process.env[SESSION_MOCK_REPLY_DELAY_MS_ENV] ?? '0')
const REPLY_DELAY_MS = Number.isFinite(replyDelay) && replyDelay > 0 ? replyDelay : 0
// A fresh SDK session has to push its opening prompt before the SDK will even identify it
// (mock-claude-sdk-stream.ts's own comment on that constraint), so this process can otherwise
// record that prompt's reply before the app's own identify → authorize → paint round trip
// finishes and the Roster shows the row (`session-created-by-click`, #e2e-real-cheap-models). A
// resumed session's row already exists, so only a session this process is creating fresh needs
// the floor. 50ms cleared 0/50 on a local machine but still lost the race twice in one CI run
// (once on the initial attempt, once on its retry), so a loaded CI runner's own round trip is
// routinely slower than that; 300ms is still negligible next to a real CLI's reply time.
const SDK_FRESH_SESSION_REPLY_FLOOR_MS = 300
const adversarialSeed = process.env[SESSION_MOCK_ADVERSARIAL_SEED_ENV]
const projectSetupScenario = process.env.ARGO_PROJECT_SETUP_MOCK_SCENARIO
let turnIndex = 0

const arguments_ = process.argv.slice(2)
const [transcriptRoot] = arguments_
const agentSdk = arguments_.includes('stream-json')
const transcripts = agentSdk ? process.env[SESSION_CLAUDE_TRANSCRIPTS_ENV] : transcriptRoot

function flagValue(flag: string): string | null {
  const index = arguments_.indexOf(flag)
  if (index !== -1) return arguments_[index + 1] ?? null
  const assignment = arguments_.find((argument_) => argument_.startsWith(`${flag}=`))
  return assignment === undefined ? null : assignment.slice(flag.length + 1)
}

// claude 2.1.270 continues `--resume <id>` in that id's own transcript file (ADR-0026).
const sessionId =
  flagValue('--session-id') ?? flagValue('--resume') ?? (agentSdk ? randomUUID() : null)
const pluginRoot = flagValue('--plugin-dir')
if (transcripts === undefined || sessionId === null) process.exit(2)
const { displayReply, waitForPermission } = createMockClaudeHooks(pluginRoot)
const folder = path.join(transcripts, 'mock-claude')
mkdirSync(folder, { recursive: true })
const transcript = path.join(folder, `${sessionId}.jsonl`)
let parentUuid: string | null = null
function record(type: 'user' | 'assistant', message: Record<string, unknown>) {
  const uuid = randomUUID()
  const record = {
    type,
    sessionId,
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
    uuid,
    parentUuid,
    message,
  }
  parentUuid = uuid
  return `${JSON.stringify(record)}\n`
}
const write = (type: 'user' | 'assistant', message: Record<string, unknown>) =>
  appendFileSync(transcript, record(type, message))
const compact = () => {
  const uuid = randomUUID()
  appendFileSync(
    transcript,
    `${JSON.stringify({ type: 'system', subtype: 'compact_boundary', uuid, timestamp: new Date().toISOString() })}\n`,
  )
}
function writeReply(text: string, plan: AdversarialTurn | null) {
  const response =
    projectSetupReply(text, projectSetupScenario) ?? `Mock Claude read: ${text}${plan ? ' 🦜' : ''}`
  const reply = record('assistant', {
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: response }],
  })
  if (plan === null) {
    appendFileSync(transcript, reply)
    return response
  }
  const bytes = Buffer.from(reply)
  const characterAt = bytes.indexOf(Buffer.from('🦜'))
  const splitAt = characterAt + Math.min(plan.replySplitByte, Buffer.from('🦜').length - 1)
  appendFileSync(transcript, bytes.subarray(0, splitAt))
  setTimeout(() => appendFileSync(transcript, bytes.subarray(splitAt)), 1)
  return response
}
let pending = ''
if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
if (agentSdk) {
  const isFreshSession = flagValue('--resume') === null
  const sdkReplyDelayMs = isFreshSession
    ? Math.max(REPLY_DELAY_MS, SDK_FRESH_SESSION_REPLY_FLOOR_MS)
    : REPLY_DELAY_MS
  startMockClaudeSdkStream(sessionId, (prompt, sdkWaitForPermission) =>
    replyToSdkPrompt({
      prompt,
      waitForPermission: sdkWaitForPermission,
      compact,
      rename: RENAME,
      transcript,
      recordUser: (text) => write('user', { role: 'user', content: text }),
      nextPlan: () =>
        adversarialSeed === undefined ? null : adversarialTurn(adversarialSeed, turnIndex++),
      projectSetupScenario,
      replyDelayMs: sdkReplyDelayMs,
      writeReply,
    }),
  )
}
// The terminal frame is not valid stream JSON, so only the PTY protocol receives it.
if (!agentSdk) process.stdout.write(`${ESCAPE}[?2026h> ${ESCAPE}[?2026l`)
process.stdin.on('data', (chunk: string) => {
  pending += chunk
  if (COMPACT.test(pending)) {
    pending = pending.replace(COMPACT, '')
    process.stdout.write('Compacting conversation… (0m 00s · ↓ 10.1k tokens) 22%\r\n')
    setTimeout(compact, COMPACTION_DELAY)
  }
  for (let turn = TURN.exec(pending); turn !== null; turn = TURN.exec(pending)) {
    pending = pending.slice(turn.index + turn[0].length)
    const text = turn[1] ?? ''
    const rename = RENAME.exec(text)
    if (rename !== null) {
      appendFileSync(
        transcript,
        `${JSON.stringify({ type: 'custom-title', customTitle: rename[1] })}\n`,
      )
      continue
    }
    write('user', { role: 'user', content: text })
    const plan =
      adversarialSeed === undefined ? null : adversarialTurn(adversarialSeed, turnIndex++)
    void settleMockClaudeTurn({
      text,
      plan,
      projectSetupScenario,
      replyDelayMs: REPLY_DELAY_MS,
      waitForPermission,
      writeReply,
      displayReply,
    })
  }
})
