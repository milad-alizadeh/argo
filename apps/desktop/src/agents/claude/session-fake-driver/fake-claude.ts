// A stand-in `claude` for the packaged resume proof, run by node's type stripping. It answers the
// flags Argo launches with and writes each Turn it is sent where the real CLI writes transcripts.
import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ESCAPE = String.fromCharCode(27)
const COMPACTION_DELAY = 10_000
const COMPACT = /\/compact[\r\n]/
// Argo's bracketed paste, then its carriage return, which the line discipline turns into a
// newline when it arrives before this process has switched the terminal to raw mode.
const TURN = new RegExp(`${ESCAPE}\\[200~([\\s\\S]*?)${ESCAPE}\\[201~[\\r\\n]`)

const [transcripts, ...flags] = process.argv.slice(2)

function flagValue(flag: string): string | null {
  const index = flags.indexOf(flag)
  return index === -1 ? null : (flags[index + 1] ?? null)
}

// claude 2.1.270 continues `--resume <id>` in that id's own transcript file (ADR-0026).
const sessionId = flagValue('--session-id') ?? flagValue('--resume')
if (transcripts === undefined || sessionId === null) process.exit(2)

const folder = path.join(transcripts, 'fake-claude')
mkdirSync(folder, { recursive: true })
const transcript = path.join(folder, `${sessionId}.jsonl`)
let parentUuid: string | null = null

function write(type: 'user' | 'assistant', message: Record<string, unknown>) {
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
  appendFileSync(transcript, `${JSON.stringify(record)}\n`)
  parentUuid = uuid
}

function compact() {
  const uuid = randomUUID()
  appendFileSync(
    transcript,
    `${JSON.stringify({ type: 'system', subtype: 'compact_boundary', uuid, timestamp: new Date().toISOString() })}\n`,
  )
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
    write('user', { role: 'user', content: text })
    write('assistant', {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: `Fake Claude read: ${text}` }],
    })
  }
})
