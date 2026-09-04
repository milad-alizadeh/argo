#!/usr/bin/env node
// Tests for `scripts/gate-cache.sh` — the content key that stops a rebase re-running a gate
// that has nothing new to check (#1377).
//
// A cache in front of a gate is a gate you can switch off by accident, so the burden here is
// the opposite of a normal cache's: every case asks whether a MISS still happens when it must.
// A wrong hit is a push that was never checked, and it looks exactly like a fast one.
//
// The five ways a hit would be wrong, each a case below: the tree changed, the tree is dirty,
// the scope widened, the toolchain moved, or the gate failed and recorded a pass anyway.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { gateScenario } from './gate-scenario.harness.mjs'

// The repository, the stubs and the runner come from `gate-scenario.harness.mjs`, shared with
// `swift-gate.test.mjs`. What this suite adds is the seed: a tree holding one of each file the
// verdict key covers, so a case can move each of them in turn.
const scenario = () =>
  gateScenario({
    seed: {
      'package.json': '{}\n',
      'turbo.json': '{}\n',
      'apps/macOS/A.swift': 'let a = 1\n',
    },
    change: { 'apps/macOS/B.swift': 'let b = 2\n' },
  })

check('a second run over the same tree runs no command at all', () => {
  const s = scenario()
  const first = s.run()
  assert.equal(first.status, 0, first.output)
  const after = s.commands()
  assert.ok(after > 0, 'the first run must actually gate')
  const second = s.run()
  assert.equal(second.status, 0, second.output)
  assert.match(second.output, /passed the gate/)
  assert.equal(s.commands(), after, 'the second run must not re-run the gate commands')
  s.cleanup()
})

check('a changed tree is gated again', () => {
  const s = scenario()
  s.run()
  const after = s.commands()
  s.commit('apps/macOS/A.swift', 'let a = 2\n')
  s.run()
  assert.ok(s.commands() > after, 'a new tree must miss the cache')
  s.cleanup()
})

check('a change to a gate script is gated again', () => {
  const s = scenario()
  s.run()
  const after = s.commands()
  // The scripts tree is in the key because the gate's own rules live there: a tightened
  // lint rule that reused an old verdict would never see the code it was written for.
  s.commit('scripts/swift-lint.sh', '# tightened\n')
  s.run()
  assert.ok(s.commands() > after, 'a changed gate script must miss the cache')
  s.cleanup()
})

check('a dirty tree is never recorded and never hit', () => {
  const s = scenario()
  // Uncommitted, so HEAD's hash does not describe what is on disk.
  s.write('apps/macOS/A.swift', 'let a = 99\n')
  s.run()
  const after = s.commands()
  const second = s.run()
  assert.ok(s.commands() > after, 'a dirty tree must be gated every time')
  assert.doesNotMatch(second.output, /passed the gate/)
  s.cleanup()
})

check('a failing gate records nothing', () => {
  const s = scenario()
  const failed = s.run({ STUB_BUN_STATUS: '1' })
  assert.notEqual(failed.status, 0, 'the stub was told to fail')
  const after = s.commands()
  const retry = s.run()
  assert.equal(retry.status, 0)
  assert.ok(s.commands() > after, 'the retry must run the gate, not read a verdict it never earned')
  s.cleanup()
})

check('a tree that goes dirty mid-run is not recorded', () => {
  const s = scenario()
  // The gate tests the working tree; the key describes HEAD. They agree when a run starts, and
  // a run long enough to build Xcode is long enough for somebody to save a file inside it. The
  // stub `bun` is what does the saving here, standing in for that person.
  const dirtied = s.run({ STUB_BUN_DIRTIES: path.join(s.dir, 'apps/macOS/A.swift') })
  assert.equal(dirtied.status, 0, dirtied.output)
  const after = s.commands()
  const next = s.run()
  assert.doesNotMatch(next.output, /passed the gate/, 'a tree nobody gated must not be certified')
  assert.ok(s.commands() > after, 'the next run must gate it properly')
  s.cleanup()
})

check('a new toolchain is gated again', () => {
  const s = scenario()
  s.run()
  const after = s.commands()
  // A different compiler compiles the same source differently. A verdict from the old one
  // says nothing about the new one, and this is the only signal that it moved.
  s.run({ STUB_SWIFT_VERSION: '6.3.0' })
  assert.ok(s.commands() > after, 'a toolchain change must miss the cache')
  s.cleanup()
})

check('a wider scope is not certified by a narrower pass', () => {
  const s = scenario()
  // The key is asked for directly here: a scenario has no packages directory, so its scope
  // is always ALL and the gate could not exercise this on its own.
  const keyFor = (scope) =>
    execFileSync('sh', ['-c', `. scripts/gate-cache.sh\ngate_cache_key "${scope}"`], {
      cwd: s.dir,
      encoding: 'utf8',
      env: { ...process.env, ARGO_GATE_CACHE_DIR: path.join(s.dir, 'cache') },
    }).trim()
  const narrow = keyFor('ArgoUI')
  const wide = keyFor('ALL')
  assert.ok(narrow, 'a clean tree must produce a key')
  assert.notEqual(narrow, wide, 'the scope must be part of the key')
  s.cleanup()
})

check('ARGO_GATE_CACHE=off gates every time', () => {
  const s = scenario()
  s.run()
  const after = s.commands()
  s.run({ ARGO_GATE_CACHE: 'off' })
  assert.ok(s.commands() > after, 'the escape hatch must actually run the gate')
  s.cleanup()
})

report('gate-cache')
