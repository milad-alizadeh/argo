#!/usr/bin/env node
// What `scripts/node-version-gate.mjs` REFUSES, run via `bun run test:hooks` (#1777).
//
// Every case runs the real script against a throwaway root, because the gate resolves
// `.node-version` from its own location: copy it into `<tmp>/scripts/` beside a `<tmp>/`
// `.node-version` and it reads that one. Nothing here asserts on the source text of the
// comparison — a gate is proved by what it refuses, never by how it is spelled.
//
// That the gate is WIRED into `preinstall`, `quality` and the desktop toolchain is
// `node-version-pin.test.mjs`; that the version is written once is `node-version-source.test.mjs`.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = '.node-version'
const running = process.versions.node

// A root holding a copy of the gate and whatever `.node-version` the case wants, run and then
// removed — an earlier version left seven of these behind per run. `null` writes no file at all,
// which is the "somebody deleted the pin" case.
const runGate = (contents, exe = process.execPath) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'argo-node-pin-'))
  try {
    mkdirSync(path.join(dir, 'scripts'))
    copyFileSync(
      path.join(ROOT, 'scripts/node-version-gate.mjs'),
      path.join(dir, 'scripts', 'node-version-gate.mjs'),
    )
    if (contents !== null) writeFileSync(path.join(dir, SOURCE), contents)
    return spawnSync(exe, [path.join(dir, 'scripts', 'node-version-gate.mjs')], {
      encoding: 'utf8',
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

check('it accepts the version the file names', () => {
  const { status, stderr } = runGate(`${running}\n`)
  assert.equal(status, 0, `the gate exited ${status} on a matching pin. It said: ${stderr}`)
})

check('it refuses a Node that does not match, and names all three things', () => {
  // A version this machine cannot be on, whatever it is on. This case also holds the gate's
  // cwd-independence: a gate that read `./.node-version` instead of the one beside itself would
  // report the repo's own pin here, and the first assertion below would not find 0.0.1.
  const { status, stderr } = runGate('0.0.1\n')
  assert.equal(status, 1, `the gate exited ${status} against a pin of 0.0.1. It must refuse.`)
  assert.match(stderr, /\b0\.0\.1\b/, 'the refusal does not name the required version.')
  assert.match(
    stderr,
    new RegExp(running.replace(/\./g, '\\.')),
    'the refusal does not name the detected version.',
  )
  assert.match(stderr, /\.node-version/, `the refusal does not name ${SOURCE} as the source.`)
})

check('it refuses a newer patch, because the pin is exact', () => {
  // Derived from the REPO's pin, not from the running Node. Off the running Node this case had a
  // hole: on a nightly, `process.versions.node` is `25.0.0-nightly…`, so `patch + 1` was `NaN`,
  // the sandbox pin was `25.0.NaN`, and the gate refused it down the malformed-pin branch
  // without ever reaching the comparison. It passed while proving something else entirely.
  const [major, minor, patch] = readFileSync(path.join(ROOT, SOURCE), 'utf8').trim().split('.')
  const { status, stderr } = runGate(`${major}.${minor}.${Number(patch) + 1}\n`)
  assert.equal(
    status,
    1,
    'the gate accepted a pin one patch above the repository pin. The pin is exact by decision ' +
      '(#1751): a newer patch does not pass until the repository updates the file.',
  )
  assert.doesNotMatch(
    stderr,
    /not an exact version/,
    'the gate refused the neighbouring patch as MALFORMED rather than as a mismatch, so this ' +
      'case never reached the version comparison it exists to test.',
  )
})

check('it refuses a missing pin file rather than reading it as no pin', () => {
  const { status, stderr } = runGate(null)
  assert.equal(status, 1, `the gate exited ${status} with no ${SOURCE} at all — a fail-open.`)
  assert.match(stderr, /missing/i, 'the refusal does not say the file is missing.')
})

check('it refuses a pin that is a range rather than an exact version', () => {
  const { status, stderr } = runGate('>=24\n')
  assert.equal(status, 1, 'the gate accepted `>=24` as a pin.')
  assert.match(stderr, /not an exact version/, 'the refusal does not say why the pin is rejected.')
})

check('it refuses to answer when Bun runs it, even where Bun would agree with the pin', () => {
  // The sandbox pin is BUN'S OWN compatibility number, which is the one case where a Bun-executed
  // gate would otherwise exit 0 and wave a machine through on a Node it never looked at. Against
  // any other pin the ordinary mismatch path refuses anyway, so an earlier version of this case —
  // which pinned the running Node — proved the guard only through its stderr, and its exit-status
  // assertion held with the guard deleted. This one fails on both counts if the guard goes.
  let compat
  try {
    compat = execFileSync('bun', ['-e', 'console.log(process.versions.node)'], {
      encoding: 'utf8',
    }).trim()
  } catch (err) {
    assert.fail(
      `bun could not be run (${err.message}). It is this repository's package manager, and the ` +
        "gate's Bun guard is proved by running it, so this check cannot be answered without it.",
    )
  }
  const bun = runGate(`${compat}\n`, 'bun')
  assert.equal(
    bun.status,
    1,
    `bun reports process.versions.node as ${compat}; pinned to exactly that, the gate exited ` +
      `${bun.status}. It must refuse: that number is a compatibility claim, not the Node on ` +
      'this machine.',
  )
  assert.match(bun.stderr, /under Bun/, 'the refusal does not say Bun is the reason.')
})

report('node-version-gate')
