// The rules guard's memory of what a session has already been told. Split off rules-guard.test.mjs
// on file length alone, the way guards.test.mjs is.
//
// This is the half that decides whether the guard speaks at all on the second call, so a bug here
// is silent: the hook stays installed, keeps exiting 0, and enforces nothing.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { record, seenFor, sessionKey } from './rules-guard.mjs'

const unique = (suffix) => `argo-test-${process.pid}-${Date.now()}-${suffix}`

// `record` writes into the same directory the shipped guard uses, so the files this suite leaves
// there would otherwise sit in tmpdir until the machine cleared it.
const written = []
const recordUnder = (id, names) => {
  written.push(id)
  record(id, names)
}
after(() => {
  for (const id of written) {
    rmSync(path.join(tmpdir(), 'argo-rules-guard', `${id.replace(/[^\w-]/g, '_')}.json`), {
      force: true,
    })
  }
})

test('a session that has been told about a rule remembers it on the next call', () => {
  const id = unique('remembers')
  recordUnder(id, ['house.md', 'desktop.md'])
  assert.deepEqual(seenFor(id), ['house.md', 'desktop.md'])
})

test('a session nothing was recorded for remembers nothing', () => {
  assert.deepEqual(seenFor(unique('fresh')), [])
})

test('state older than the window is forgotten, so a stale file cannot silence the guard', () => {
  const id = unique('stale')
  recordUnder(id, ['house.md'])
  const thirteenHoursOn = Date.now() + 13 * 60 * 60 * 1000
  assert.deepEqual(seenFor(id, thirteenHoursOn), [])
})

test('the harness names the session when it can', () => {
  assert.match(sessionKey({ session_id: 'abc-123' }, '/repo'), /^abc-123-/)
  assert.match(sessionKey({ sessionId: 'abc-123' }, '/repo'), /^abc-123-/)
})

test('a harness that names no session gets the same key on every call, not a new one', () => {
  // The key a markerless harness lands on has to survive the shell the command runs under, or the
  // second call reads no state and the same write is denied forever.
  assert.equal(sessionKey({}, '/repo'), sessionKey({}, '/repo'))
  assert.notEqual(sessionKey({}, '/repo-one'), sessionKey({}, '/repo-two'))
})

test('a session that names itself with an empty string is treated as naming nothing', () => {
  assert.equal(sessionKey({ session_id: '' }, '/repo'), sessionKey({}, '/repo'))
})

test('a session that moves between projects keeps one memory per project', () => {
  assert.notEqual(
    sessionKey({ session_id: 'a' }, '/repo-one'),
    sessionKey({ session_id: 'a' }, '/repo-two'),
  )
})
