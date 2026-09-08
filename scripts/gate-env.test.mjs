#!/usr/bin/env node
// What survives turbo, run via `bun run test:hooks` (#1711).
//
// Turbo 2 runs in **strict** env mode: a task sees a default allowlist plus whatever the config
// declares, and NOTHING else. Every variable the gate exports for its steps therefore has to be
// named in `globalPassThroughEnv`, and none of it is visible when it is not — the step just
// behaves as though nobody had asked for anything:
//
//   - `ARGO_REQUIRE_SWIFT_TOOLS` stripped means a missing SwiftFormat SKIPS instead of failing,
//     and the gate reports success having checked nothing. That is the one failure mode
//     `swift-tool-guard.sh` exists for.
//   - `ARGO_TEST_SCOPE` stripped means `swift-gate.sh` works out which packages a change reaches
//     and then runs all of them anyway (#1377).
//   - `ARGO_GATE_CALLER` stripped means every step row reads `unknown`, and the report cannot
//     say which step paid.
//
// Derived from the scripts rather than listed, because the list is the bug: a variable added to
// `swift-gate.sh` and not to `turbo.json` is silent in exactly this way.
//
// `passThroughEnv` and not `env`: these change how a step BEHAVES and what it RECORDS, never
// what it produces, so none of them belongs in turbo's cache hash.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8')

// The scripts the gate runs THROUGH turbo — `bun run build` and `bun run test`. A variable
// exported before one of those has to cross the boundary.
const EXPORTERS = ['scripts/swift-gate.sh', 'scripts/build-lock.sh']

const exported = () => {
  const names = new Set()
  for (const file of EXPORTERS) {
    for (const line of read(file).split('\n')) {
      const match = line.match(/^\s*export (ARGO_[A-Z_]+)\s*$/)
      if (match) names.add(match[1])
    }
  }
  return [...names].sort()
}

const passThrough = () => JSON.parse(read('turbo.json')).globalPassThroughEnv ?? []

check('every variable the gate exports crosses turbo, or its steps never see it', () => {
  const declared = passThrough()
  const missing = exported().filter((name) => !declared.includes(name))
  assert.deepEqual(missing, [], `strict env mode will strip: ${missing.join(', ')}`)
})

check('the exporters really do export something, so this suite cannot pass on an empty set', () => {
  const names = exported()
  assert.ok(names.length >= 4, `found only ${names.length}: ${names.join(', ')}`)
  for (const name of ['ARGO_GATE_CALLER', 'ARGO_GATE_PHASE', 'ARGO_REQUIRE_SWIFT_TOOLS']) {
    assert.ok(names.includes(name), `${name} is no longer exported by any gate script`)
  }
})

// In `env`, these would each become part of turbo's cache key, so labelling a run `implement`
// rather than `ship` would invalidate a build. They are not inputs; they are labels and modes.
check('none of them is a cache input', () => {
  const config = JSON.parse(read('turbo.json'))
  const inputs = [
    ...(config.globalEnv ?? []),
    ...Object.values(config.tasks ?? {}).flatMap((task) => task.env ?? []),
  ]
  for (const name of exported()) {
    assert.ok(!inputs.includes(name), `${name} is in turbo's cache hash, and must not be`)
  }
})

report('gate env')
