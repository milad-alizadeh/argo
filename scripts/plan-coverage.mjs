#!/usr/bin/env node
// How many sessions wrote a to-do list at all — the measurement the nudge hook exists to move
// (#1254). Kept in the repo rather than run once and quoted, because the ticket's success test is
// a SECOND reading of the same number weeks later, and a number produced by a script nobody can
// re-run is a number nobody can check.
//
// Usage:
//   node scripts/plan-coverage.mjs                     # every transcript
//   node scripts/plan-coverage.mjs --since 2026-09-04  # sessions modified on or after a date
//
// The baseline it produced on 2026-09-04, over 2981 transcripts: 4.7% of all sessions, 25.4% of
// sessions with 5 or more tool calls, 38.4% of sessions with 3 or more file edits.
import { createReadStream, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { EDIT_TOOLS, LIST_TOOLS, toolCallsIn } from './transcript-plans.mjs'

const ROOT = path.join(homedir(), '.claude', 'projects')

const transcripts = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return transcripts(full)
    return entry.name.endsWith('.jsonl') ? [full] : []
  })

// A sub-agent's calls are counted apart, never into the Session's own: the Plan is Session-scoped
// (ADR-0020), so a delegate's list cannot excuse a Session that wrote none. This is the same rule
// the nudge hook applies, from the same module, so the two numbers stay comparable.
function count(session, { names, sidechain }) {
  for (const name of names) {
    if (sidechain) {
      if (LIST_TOOLS.has(name)) session.sidechainList = true
      continue
    }
    session.tools += 1
    if (LIST_TOOLS.has(name)) session.list = true
    if (EDIT_TOOLS.has(name)) session.edits += 1
  }
}

async function readSession(file) {
  const session = { tools: 0, edits: 0, list: false, sidechainList: false }
  const lines = createInterface({
    input: createReadStream(file),
    crlfDelay: Number.POSITIVE_INFINITY,
  })
  for await (const line of lines) {
    const made = toolCallsIn(line)
    if (made) count(session, made)
  }
  return session
}

const BANDS = [
  ['all sessions', () => true],
  ['5 or more tool calls', (session) => session.tools >= 5],
  ['1 or more file edits', (session) => session.edits >= 1],
  ['3 or more file edits', (session) => session.edits >= 3],
]

async function main() {
  const sinceArg = process.argv.indexOf('--since')
  const since = sinceArg === -1 ? null : Date.parse(process.argv[sinceArg + 1])
  if (since !== null && Number.isNaN(since)) {
    console.error('--since needs a date node can parse, such as 2026-09-04')
    process.exit(1)
  }

  const files = transcripts(ROOT).filter(
    (file) => since === null || statSync(file).mtimeMs >= since,
  )
  const sessions = []
  for (const file of files) sessions.push(await readSession(file))

  if (sessions.length === 0) {
    console.error('no transcripts matched — a run that read nothing is not a measurement')
    process.exit(1)
  }

  const share = (kept) =>
    `${((kept.filter((session) => session.list).length / kept.length) * 100).toFixed(1)}%`
  console.log(`${sessions.length} transcripts${since === null ? '' : ' since the given date'}\n`)
  for (const [label, keep] of BANDS) {
    const kept = sessions.filter(keep)
    const rate = kept.length === 0 ? 'no sessions' : share(kept)
    console.log(`${label.padEnd(22)} ${String(kept.length).padStart(5)}  wrote a list: ${rate}`)
  }

  const missing = sessions.filter((session) => session.edits >= 3 && !session.list)
  const excused = missing.filter((session) => session.sidechainList).length
  console.log(
    `\n3 or more edits and no list: ${missing.length}, of which a sub-agent wrote one: ${excused}`,
  )
}

await main()
