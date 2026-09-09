#!/usr/bin/env node
// That the Node pin is WIRED, run via `bun run test:hooks` (#1777).
//
// `.node-version` is the single source and `scripts/node-version-gate.mjs` enforces it, but a
// source nobody consults is not a pin. So this suite reads the wiring: the root `preinstall`, the
// root `quality` gate, every `apps/desktop` toolchain command, and every workflow. What the gate
// DOES when it runs is `node-version-gate.test.mjs`; that the version is written in one place is
// `node-version-source.test.mjs`.
//
// Two things here were review findings, and both are the reason this file is not shorter:
//
//   - **Launching the gate is not gating.** `node …gate.mjs || true` and `node …gate.mjs ; next`
//     both run it and then carry on past its refusal. An earlier version of this suite matched
//     only the invocation, and passed on a tree where a wrong Node did not fail the install. So
//     `gateCall` anchors both ends: the gate is the FIRST command, and what follows it is `&&`
//     or nothing at all.
//   - **The manifest list is derived, not listed.** It comes off the root `workspaces` globs via
//     `git ls-files`, so a new workspace is read the day it lands. A literal list here would
//     pass on exactly the day somebody added a fifth manifest that spawns the gate under `bun`.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { MANIFESTS, ROOT, read, readJson } from './repo-manifests.mjs'

const GATE = 'scripts/node-version-gate.mjs'
const SOURCE = '.node-version'
const pinned = read(SOURCE).trim()

// The gate as THIS manifest has to spell it: `node`, the path relative to the manifest's own
// directory, and then `&&` or the end of the command. Nothing else — a trailing `|| true`, a `;`,
// or a `.bak` suffix on the path all fall outside it, and all three are ways to keep the gate in
// the command while removing its authority over what follows.
const gateCall = (manifest) => {
  const up = path.relative(path.dirname(path.join(ROOT, manifest)), ROOT)
  const spec = up ? `${up}/${GATE}` : GATE
  return new RegExp(`^node ${spec.replace(/[./]/g, '\\$&')}(?: &&(?= )|$)`)
}

const gateFirst = (manifest, name, command) =>
  assert.match(
    command,
    gateCall(manifest),
    `${manifest} \`${name}\` is ${JSON.stringify(command)}. It has to START with ` +
      `\`node ${GATE}\` (spelled relative to that manifest) and be followed by \`&&\` or ` +
      'nothing: a gate whose non-zero exit does not stop the rest of the command has been ' +
      'launched, not obeyed.',
  )

check('the gate script exists on disk', () => {
  // Deleting `gate.mjs` and `gate.test.mjs` together passed every other check here: the wiring
  // checks read the COMMAND out of a manifest and never look for the file it names. The breakage
  // then surfaced as `Cannot find module` at the next install, and the obvious fix — dropping the
  // `preinstall` line — is the one thing that was caught.
  assert.ok(
    existsSync(path.join(ROOT, GATE)),
    `${GATE} does not exist, but the manifests still call it. Every install and every Forge ` +
      'command now fails with `Cannot find module`.',
  )
})

check(`${SOURCE} pins one exact version`, () => {
  assert.match(
    pinned,
    /^\d+\.\d+\.\d+$/,
    `${SOURCE} reads ${JSON.stringify(pinned)}. The pin is exact by decision (#1751): three ` +
      'numbers, no range, no leading `v`, no alias, one line.',
  )
})

check('the root preinstall runs the gate, so a wrong Node fails the install', () => {
  const { scripts } = readJson('package.json')
  assert.ok(
    scripts.preinstall,
    'the root manifest declares no `preinstall`. That is the only hook firing before the root ' +
      'install, and it is what turns a wrong Node into a failed `bun install` (#1777).',
  )
  gateFirst('package.json', 'preinstall', scripts.preinstall)
})

check('the quality gate runs the pin check before any other gate', () => {
  const { scripts } = readJson('package.json')
  assert.ok(scripts['quality:node'], 'the root manifest declares no `quality:node`.')
  gateFirst('package.json', 'quality:node', scripts['quality:node'])
  const first = scripts.quality.split('&&')[0].trim()
  assert.equal(
    first,
    'bun run quality:node',
    `\`quality\` starts with ${JSON.stringify(first)}. A gate run on an unpinned toolchain ` +
      'measures the toolchain, so the pin check goes first (#1777).',
  )
})

check('every caller of the gate lets its refusal stop the command', () => {
  // Derived over every workspace manifest, so a new package that spawns the gate under `bun`, or
  // spawns it and shrugs at the exit code, is read the day it lands.
  const callers = MANIFESTS.flatMap((manifest) =>
    Object.entries(readJson(manifest).scripts ?? {})
      .filter(([, command]) => command.includes('node-version-gate'))
      .map(([name, command]) => [manifest, name, command]),
  )
  assert.ok(
    callers.length > 0,
    `no script in any of ${MANIFESTS.join(', ')} mentions the gate at all. The pin is wired to ` +
      'nothing — or this check has stopped reading the manifests.',
  )
  for (const [manifest, name, command] of callers) gateFirst(manifest, name, command)
})

check('every apps/desktop toolchain command runs the gate first', () => {
  // The toolchain commands are the ones reaching Electron or Forge, and those are the ones that
  // die with `ERR_REQUIRE_ESM` on an older Node, with nothing in the message about the Node.
  const manifest = 'apps/desktop/package.json'
  const toolchain = Object.entries(readJson(manifest).scripts).filter(([, command]) =>
    /electron-forge|electron\b|prove-packaged-pty/.test(command),
  )
  assert.ok(
    toolchain.length > 0,
    'no `apps/desktop` script mentions electron, electron-forge or the packaged smoke. Either ' +
      'the toolchain moved or this check has stopped reading it.',
  )
  for (const [name, command] of toolchain) gateFirst(manifest, name, command)
})

check("the pinned version satisfies Electron's declared engines.node", () => {
  // Resolved rather than path-joined: hoisting is bun's to decide, and a nested
  // `apps/desktop/node_modules/electron` would turn a hard-coded root path red for a reason that
  // has nothing to do with the pin.
  let engines
  try {
    const specifier = createRequire(path.join(ROOT, 'package.json')).resolve(
      'electron/package.json',
    )
    engines = JSON.parse(readFileSync(specifier, 'utf8')).engines ?? {}
  } catch (err) {
    assert.fail(
      `electron/package.json could not be resolved (${err.message}). This check reads the ` +
        'installed Electron rather than a number copied out of a ticket, so it needs a `bun ' +
        'install` first. CI installs before `test:hooks`; a fresh clone does not.',
    )
  }
  assert.ok(
    engines.node,
    'the installed electron declares no `engines.node`. If that is real, this check has lost ' +
      'its subject and needs rewriting rather than deleting.',
  )
  const floor = engines.node.match(/>=?\s*(\d+)\.(\d+)\.(\d+)/)
  assert.ok(
    floor,
    `electron declares engines.node ${JSON.stringify(engines.node)}, which this check cannot ` +
      'parse. Widen the parser rather than dropping the check.',
  )
  const tuple = (a, b, c) => Number(a) * 1e6 + Number(b) * 1e3 + Number(c)
  const [major, minor, patch] = pinned.split('.')
  assert.ok(
    tuple(major, minor, patch) >= tuple(floor[1], floor[2], floor[3]),
    `${SOURCE} pins ${pinned}, below electron's engines.node ${engines.node}. Electron's ` +
      'installer is CommonJS and requires an ESM-only @electron/get, so it dies with ' +
      'ERR_REQUIRE_ESM rather than saying the Node is too old.',
  )
})

report('node-version-pin')
