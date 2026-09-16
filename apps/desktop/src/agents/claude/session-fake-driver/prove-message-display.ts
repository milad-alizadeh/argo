// #2001 against the installed `claude`: a real Turn streams into the Feed through the
// MessageDisplay hook, and its transcript row replaces the draft. It spends a Turn on the person's
// subscription, so only `bun run test:live-claude-display` runs it. Last passed on claude 2.1.270.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionReader } from '@/core/sessions/bridge'
import type { ClaudeTurnSetup } from '@/core/sessions/contract'
import { createSessionReader } from '@/core/sessions/reader'
import { createSystemClaudeSessionDriver } from '../drive/system-claude-session-driver'
import { claudeSessionSource } from '../sessions/read-sessions'
import { claudeTranscriptsRoot } from '../sessions/roots'

type Row = { id: string; shape: string; role?: string; text?: string }
type Reader = SessionReader

const PROMPT = 'Without using any tools, write twelve short numbered lines about ducks.'
const SETUP: ClaudeTurnSetup = { model: 'haiku', effort: 'low', mode: 'manual' }

async function replies(reader: Reader, sessionId: string) {
  const reply = (await reader.readSessionFeed({
    version: 1,
    type: 'session.feed',
    requestId: 'live',
    sessionId,
    delegationId: null,
    revision: null,
  })) as { rows?: Row[] }
  return (reply.rows ?? []).filter((row) => row.shape === 'prose' && row.role === 'assistant')
}

console.log(execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim())
// Run from inside a Claude Code session, claude would refuse to start a nested one.
delete process.env.CLAUDECODE
const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-live-claude-'))
const transcripts = claudeTranscriptsRoot(os.homedir())
const driver = createSystemClaudeSessionDriver({
  permissions: path.join(folder, 'plugins'),
  ledger: path.join(folder, 'ownership.json'),
  transcripts,
})
const overlaid = createSessionReader([
  claudeSessionSource({ transcripts, liveMessages: driver.liveMessages }),
])
const recorded = createSessionReader([claudeSessionSource({ transcripts })])
try {
  const sessionId = driver.start({ cwd: process.cwd(), prompt: PROMPT, setup: SETUP })
  const drafts: string[] = []
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const draft = (await replies(overlaid, sessionId)).at(-1)?.text
    if (draft !== undefined && draft !== drafts.at(-1)) drafts.push(draft)
    const landed = await replies(recorded, sessionId)
    if (landed.length > 0 && landed.at(-1)?.text === drafts.at(-1)) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const shown = await replies(overlaid, sessionId)
  const landed = await replies(recorded, sessionId)
  const [message] = driver.liveMessages(sessionId)

  assert.ok(drafts.length > 1, `the draft grew across Feed reads (${drafts.length} readings)`)
  assert.ok(
    drafts.every((draft, index) => index === 0 || draft.startsWith(drafts[index - 1] ?? '')),
  )
  assert.equal(landed.length, 1)
  assert.deepEqual(shown, [{ ...landed[0], id: `display:${message?.id}` }])
  console.log(`streamed ${drafts.length} growing drafts, then one transcript row under the same id`)
} finally {
  driver.close()
  await rm(folder, { recursive: true, force: true })
}
