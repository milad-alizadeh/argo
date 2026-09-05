#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the UserPromptSubmit to-do-list nudge (#1254), run via `bun run test:hooks`.
// Two things here are worth a test: the hook must never wedge a prompt, and it must not read the
// harness's own mention of a task tool as a list the session already wrote — that false positive
// silences the hook completely, and silently.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { decide, transcriptHasList } from './task-list-nudge.mjs'

const DIR = mkdtempSync(path.join(tmpdir(), 'task-list-nudge-'))
const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'task-list-nudge.mjs')
let seq = 0

const transcript = (lines) => {
  const file = path.join(DIR, `t${seq++}.jsonl`)
  writeFileSync(file, lines.join('\n'))
  return file
}

const fire = (payload, env = {}) =>
  execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDECODE: '1', ...env },
  })

// A fresh session id per call: the count is per-session state under tmpdir, and that file outlives
// the suite — a fixed id would make one run of the suite depend on the run before it.
const sessionId = () => `${process.pid}-${Date.now()}-${seq++}`
const run = (payload, env) => fire({ session_id: sessionId(), ...payload }, env)

const injected = (out) => JSON.parse(out).hookSpecificOutput.additionalContext

check('a session with no list gets the nudge', () => {
  const out = run({ transcript_path: transcript(['{"type":"user"}']) })
  assert.match(injected(out), /to-do list/)
  assert.equal(JSON.parse(out).hookSpecificOutput.hookEventName, 'UserPromptSubmit')
})

check('the nudge carries the order rule', () =>
  assert.match(injected(run({ transcript_path: transcript(['{}']) })), /item 1 to item 3/),
)

// The nudge and AGENTS.md state the same rule and nothing projects one from the other, so both
// halves are asserted here: an edit that drops the tail from either side fails (#1419).
check('the nudge carries the tail rule', () => {
  const text = injected(run({ transcript_path: transcript(['{}']) }))
  assert.match(text, /verification tail/)
  assert.match(text, /open PR/)
})

check('AGENTS.md states the tail rule too', () => {
  const rule = readFileSync(path.resolve('AGENTS.md'), 'utf8')
  const section = rule.slice(rule.indexOf('## Task tracking'), rule.indexOf('## Rules'))
  assert.match(section, /verification tail/)
  assert.match(section, /open PR/)
})

check('a session that already wrote a list is left alone', () => {
  const file = transcript(['{"message":{"content":[{"type":"tool_use","name":"TaskCreate"}]}}'])
  assert.equal(run({ transcript_path: file }).trim(), '')
})

// Structural, not textual: a bare `"name": "TodoWrite"` is not a call, and reading one as a list
// silences the nudge for a session that never wrote one.
check('a bare name key is not a list', () =>
  assert.equal(transcriptHasList(transcript(['{"name": "TodoWrite"}'])), false),
)

check('a TodoWrite call still counts as a list', () =>
  assert.equal(
    transcriptHasList(
      transcript(['{"message":{"content":[{"type":"tool_use","name":"TodoWrite"}]}}']),
    ),
    true,
  ),
)

// ADR-0020: the Plan is Session-scoped, so a delegate's list is never the Session's. A session
// whose sub-agent kept a list still owes one, and must still be nudged.
check('a sub-agent list does not answer for the Session', () => {
  const file = transcript([
    '{"isSidechain":true,"message":{"content":[{"type":"tool_use","name":"TaskCreate"}]}}',
  ])
  assert.equal(transcriptHasList(file), false)
  assert.notEqual(run({ transcript_path: file }).trim(), '')
})

// The regression structural reading exists for. The harness writes both of these lines into
// transcripts of its own accord; a bare substring search reads them as a list, and the hook then
// goes quiet for every session there is.
check('the harness mentioning a task tool is not a list', () => {
  const file = transcript([
    '{"type":"user","message":{"content":"consider using TaskCreate to add new tasks"}}',
    '{"type":"system","content":"Available tools: TaskCreate, TaskUpdate, TodoWrite"}',
  ])
  assert.equal(transcriptHasList(file), false)
  assert.notEqual(run({ transcript_path: file }).trim(), '')
})

check('it stops after three nudges in one session', () => {
  const id = sessionId()
  const file = transcript(['{}'])
  const say = () => fire({ session_id: id, transcript_path: file }).trim()
  assert.deepEqual([say(), say(), say()].map(Boolean), [true, true, true])
  assert.equal(say(), '')
})

check('decide() reads both facts', () => {
  assert.equal(decide({ hasList: true, nudges: 0 }), false)
  assert.equal(decide({ hasList: false, nudges: 0 }), true)
  assert.equal(decide({ hasList: false, nudges: 3 }), false)
})

// The ways it can go wrong. Each has to end in a silent, zero-exit allow, or every prompt in the
// session pays for it.
check('malformed JSON says nothing', () =>
  assert.equal(
    execFileSync(process.execPath, [HOOK], {
      input: 'not json {{',
      encoding: 'utf8',
      env: { ...process.env, CLAUDECODE: '1' },
    }).trim(),
    '',
  ),
)

check('a missing transcript still nudges rather than throwing', () =>
  assert.notEqual(run({ transcript_path: path.join(DIR, 'gone.jsonl') }).trim(), ''),
)

check('outside an agent it says nothing', () =>
  assert.equal(
    run({ transcript_path: transcript(['{}']) }, { CLAUDECODE: '', ARGO_HOOK_AGENT: '' }).trim(),
    '',
  ),
)

report('task-list-nudge')
