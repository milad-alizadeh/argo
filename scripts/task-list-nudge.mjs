#!/usr/bin/env node
// UserPromptSubmit nudge: the to-do list rule, delivered on its own instead of buried in
// AGENTS.md. Measured on 2981 transcripts, only 38% of sessions with three or more file edits
// wrote a list at all, and the rate fell over time — a rule that competes with a whole file for
// attention is a rule sessions skip (#1254).
//
// It nudges only while the session has written NO list, and at most MAX_NUDGES times, so a
// session that keeps one is never told twice and a session that needs none is never nagged.
// decide() is pure (no fs, no git) and unit-tested in task-list-nudge.test.mjs.
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readStdin, underAgent } from './hook-io.mjs'
import { toolCallsIn, writesSessionList } from './transcript-plans.mjs'

// The first prompt of a session is often a question, and the work arrives later (#1254).
const MAX_NUDGES = 3

const NUDGE =
  `Task tracking (Argo house rule). If this request needs three or more distinct steps, ` +
  `edits across multiple files, or carries out a plan the user approved, write a live to-do ` +
  `list BEFORE the first edit — not as a summary afterwards. Claude Code: load the tools once ` +
  `with ToolSearch("select:TaskCreate,TaskUpdate"), then one TaskCreate per item and TaskUpdate ` +
  `for each status change. Codex: update_plan. Keep exactly one item in_progress, and mark an ` +
  `item completed the moment it is done. Work the items in the order the list gives them: mark ` +
  `an item in_progress before you start it, so the list never jumps from item 1 to item 3. If ` +
  `the real order turns out to be different, reorder the list rather than skip an item. If the ` +
  `request is a lookup, a single edit, or a conversation, write no list: a one-item list is noise.`

/**
 * Whether this prompt gets the nudge. Pure — the caller resolves both facts.
 * @param {{ hasList: boolean, nudges: number }} state
 */
export function decide({ hasList, nudges }) {
  if (hasList) return false
  return nudges < MAX_NUDGES
}

// The transcript is the only place that says whether a list exists, and it is append-only, so
// the tail carries every write the session has made by now. Capped: a long session's transcript
// runs to megabytes, and a prompt-time hook that stalls is a hook the user turns off.
const TAIL_BYTES = 4 * 1024 * 1024

function tailOf(file) {
  const size = statSync(file).size
  const from = Math.max(0, size - TAIL_BYTES)
  const length = size - from
  if (length === 0) return ''
  const descriptor = openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(length)
    // Looped: one readSync may return short, and a silently truncated tail is a list the hook
    // cannot see.
    let filled = 0
    while (filled < length) {
      const read = readSync(descriptor, buffer, filled, length - filled, from + filled)
      if (read === 0) break
      filled += read
    }
    return buffer.toString('utf8', 0, filled)
  } finally {
    closeSync(descriptor)
  }
}

/** True when the session has already written a list. The first line of a tail that started
 * mid-file is a fragment, and `toolCallsIn` drops it along with any other line it cannot parse. */
export function transcriptHasList(file) {
  if (!file || !existsSync(file)) return false
  return tailOf(file)
    .split('\n')
    .some((line) => {
      const made = toolCallsIn(line)
      return made !== null && writesSessionList(made)
    })
}

const stateFile = (sessionId) =>
  path.join(tmpdir(), 'argo-task-list-nudge', `${String(sessionId).replace(/[^\w-]/g, '_')}.count`)

function countFor(sessionId) {
  try {
    return Number.parseInt(readFileSync(stateFile(sessionId), 'utf8'), 10) || 0
  } catch {
    return 0
  }
}

function record(sessionId, count) {
  const file = stateFile(sessionId)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, String(count))
}

// Fails open in every direction, like the two guards beside it: a nudge that wedges a prompt is
// far worse than the missing list it was watching for.
async function main() {
  try {
    if (!underAgent()) return
    const payload = JSON.parse((await readStdin()) || '{}')
    const sessionId = payload.session_id ?? 'unknown'
    const nudges = countFor(sessionId)
    if (!decide({ hasList: transcriptHasList(payload.transcript_path), nudges })) return
    record(sessionId, nudges + 1)
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: NUDGE },
      }),
    )
  } catch {
    // A bad payload, an unreadable transcript, a read-only tmpdir — say nothing.
  }
}

// Guarded: the test imports decide() and transcriptHasList() from here, and an unguarded main()
// would read the test runner's own stdin and exit the suite before its first case.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
  process.exit(0)
}
