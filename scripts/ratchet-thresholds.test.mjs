#!/usr/bin/env node
// The two ratchet thresholds, against the REAL tree (#1511).
//
// `swift-boundaries.ink.test.mjs` and `swift-boundaries.tokens.test.mjs` hold the MECHANISM, over
// fixtures, so that no case there passes or fails on what this repository happens to hold today.
// This suite holds the other half: that the number and the allowlist beside those scripts still
// describe the tree they sit in.
//
// It runs in `bun run test:hooks` rather than beside the gate because counting a pattern in Swift
// TEXT needs no Swift toolchain, so this reaches the Linux CI job — where `ARGO_SKIP_SWIFT_GATE`
// and `--no-verify` do not.
//
// Each script owns the shape it recognises and the threshold it reads; a case here only ever asks
// the script what it found.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INK = 'scripts/check-text-ink-swift.sh'
const TOKENS = 'scripts/check-design-tokens-swift.sh'

// Both streams and the exit code as a value: a failing ratchet prints its findings, and putting
// those in front of whoever broke it is the whole point of a case here.
function ratchet(script) {
  try {
    const output = execFileSync('sh', [script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
    return { status: 0, output }
  } catch (err) {
    return { status: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

// Exit 0 already means the count equals the budget — the script fails both over and under. What
// it does NOT mean is that anything was counted: a scan matching nothing reports a clean tree at a
// budget of zero, which is the fail-open this ticket is an instance of.
check('the ink budget describes the tree, and the tree was read', () => {
  const result = ratchet(INK)
  assert.equal(
    result.status,
    0,
    `${INK} fails on this tree, so every Swift commit is refused:\n${result.output}`,
  )
  const counted = result.output.match(/(\d+) hand-picked text rungs/)
  assert.ok(counted, `${INK} said nothing about a count:\n${result.output}`)
  assert.ok(Number(counted[1]) > 0, `${INK} counted no rungs at all — it scanned nothing`)
})

// No count to read back here, so the message is the only evidence the scan ran to its end rather
// than exiting 0 early.
check('the token allowlist describes the tree it sits beside', () => {
  const result = ratchet(TOKENS)
  assert.equal(result.status, 0, `${TOKENS} fails on this tree:\n${result.output}`)
  assert.match(result.output, /clean/, `${TOKENS} exited 0 without reaching its verdict`)
})

report('ratchet thresholds')
