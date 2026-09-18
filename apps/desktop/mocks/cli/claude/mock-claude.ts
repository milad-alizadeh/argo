// A stand-in `claude` for the packaged resume proof, run by node's type stripping. It answers the
// flags Argo launches with and writes each Turn it is sent where the real CLI writes transcripts.

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '../../../src/domains/sessions/main/proof-protocol.ts'
import { type AdversarialTurn, adversarialTurn } from '../../sessions/adversarial-turns.ts'
import { MOCK_CLAUDE_PROCESS_TITLE } from '../mock-cli-process-titles.mts'

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
const adversarialSeed = process.env[SESSION_MOCK_ADVERSARIAL_SEED_ENV]
let turnIndex = 0

const [transcripts, ...flags] = process.argv.slice(2)

function flagValue(flag: string): string | null {
  const index = flags.indexOf(flag)
  return index === -1 ? null : (flags[index + 1] ?? null)
}

// claude 2.1.270 continues `--resume <id>` in that id's own transcript file (ADR-0026).
const sessionId = flagValue('--session-id') ?? flagValue('--resume')
const pluginRoot = flagValue('--plugin-dir')
if (transcripts === undefined || sessionId === null) process.exit(2)

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

function write(type: 'user' | 'assistant', message: Record<string, unknown>) {
  appendFileSync(transcript, record(type, message))
}

function compact() {
  const uuid = randomUUID()
  appendFileSync(
    transcript,
    `${JSON.stringify({ type: 'system', subtype: 'compact_boundary', uuid, timestamp: new Date().toISOString() })}\n`,
  )
}

function writeReply(text: string, plan: AdversarialTurn | null) {
  const reply = record('assistant', {
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: `Mock Claude read: ${text}${plan ? ' 🦜' : ''}` }],
  })
  if (plan === null) {
    appendFileSync(transcript, reply)
    return
  }
  const bytes = Buffer.from(reply)
  const characterAt = bytes.indexOf(Buffer.from('🦜'))
  const splitAt = characterAt + Math.min(plan.replySplitByte, Buffer.from('🦜').length - 1)
  appendFileSync(transcript, bytes.subarray(0, splitAt))
  setTimeout(() => appendFileSync(transcript, bytes.subarray(splitAt)), 1)
}

async function waitForPermission() {
  if (pluginRoot === null) return
  const hook = spawn('/bin/sh', [path.join(pluginRoot, 'permission-hook.sh')], {
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  hook.stdin.end(`${JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'bun test' } })}\n`)
  await once(hook, 'exit')
}

async function settleTurn(text: string, plan: AdversarialTurn | null) {
  if (plan?.permissionBeforeReply) await waitForPermission()
  if (plan?.outcome === 'stall') return
  const delay = plan?.firstReplyDelayMs ?? REPLY_DELAY_MS
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  if (plan?.outcome === 'failure') {
    process.stdout.write('Mock Claude failed a Turn.\r\n')
    process.exit(1)
  }
  writeReply(text, plan)
}

let pending = ''
if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
// The end of a synchronized frame, which is what Argo waits for before it sends a Turn (#2002).
process.stdout.write(`${ESCAPE}[?2026h> ${ESCAPE}[?2026l`)
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
    void settleTurn(text, plan)
  }
})
