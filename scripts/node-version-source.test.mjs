#!/usr/bin/env node
// That `.node-version` is the ONLY place the Node version is written, run via
// `bun run test:hooks` (#1751's "treat that file as the single source", #1777).
//
// This suite exists because of what the first version of it got wrong, and the mistake is worth
// keeping written down. It grepped the manifests for the literal string in `.node-version`. But
// the duplicate this rule guards against is the one somebody FORGETS on the day the pin moves —
// and a forgotten copy holds the OLD value, while the grep is hunting the new one. So the check
// went green precisely when the duplicate had diverged, which is the only moment it is dangerous.
// Verified under review: with `.node-version` at 24.21.0 and an `engines.node` of 24.20.0 in the
// root manifest, it passed.
//
// So nothing here compares against the current pin. Each check refuses a KIND of second source —
// an `engines.node`, a version-manager file, a literal in a workflow — whatever version it holds.
// That is a rule about shape, and it survives every bump.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { MANIFESTS, ROOT, read, readJson, tracked } from './repo-manifests.mjs'

const SOURCE = '.node-version'
// Composite actions as well as workflows, because the Node version is set in a composite action
// here and in no workflow. A sweep of `workflows/` alone would read every file except the one
// that actually decides which Node CI installs.
const CI_FILES = tracked(
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
  '.github/**/action.yml',
)

check(`${SOURCE} exists and is tracked`, () => {
  assert.ok(
    tracked(SOURCE).includes(SOURCE),
    `${SOURCE} is not tracked by git. Untracked, it reaches no clone and no CI runner, and the ` +
      'pin is enforced only on the machine that happens to have the file.',
  )
})

check('no manifest declares an engines.node', () => {
  // A second source with a second syntax: `engines` is a RANGE field, so the copy that lands
  // there is usually a range, and it then disagrees with the exact pin in a way that reads as
  // agreement. `bun` and `npm` both consult it, so it is a real second authority, not a comment.
  for (const manifest of MANIFESTS) {
    const engines = readJson(manifest).engines ?? {}
    assert.ok(
      !engines.node,
      `${manifest} declares engines.node ${JSON.stringify(engines.node)}. ${SOURCE} is the ` +
        'single source (#1751); a manifest that repeats it is a second thing to forget on the ' +
        'day it moves. `scripts/node-version-gate.mjs` is what enforces the version.',
    )
  }
})

check('no second version-manager file competes with the pin', () => {
  // nvm reads `.nvmrc` and not `.node-version`, so `.nvmrc` is the tempting fix for the trap
  // documented in `docs/agents/quality-gates.md`. It is also exactly the drift this rule bans:
  // two files, one of them stale, and no way to tell which a given tool obeyed.
  // `mise.toml` and `volta` are in the list because `actions/setup-node` honours them, and a
  // `volta.node` in a manifest takes precedence over `node-version-file` — so that one would
  // silently overrule the pin on CI rather than merely disagreeing with it locally.
  for (const rival of [
    '.nvmrc',
    '.tool-versions',
    '.node-version.txt',
    'mise.toml',
    '.mise.toml',
  ]) {
    assert.ok(
      !existsSync(path.join(ROOT, rival)),
      `${rival} exists alongside ${SOURCE}. Pick one, and it is ${SOURCE} (#1751). The nvm ` +
        'trap is documented rather than solved with a second file, for this reason.',
    )
  }
  for (const manifest of MANIFESTS) {
    assert.ok(
      !readJson(manifest).volta,
      `${manifest} declares a \`volta\` block. actions/setup-node prefers volta's version over ` +
        `\`node-version-file\`, so that block would quietly outrank ${SOURCE} on CI.`,
    )
  }
})

check('no workflow or composite action hard-codes a Node version', () => {
  // `node-version-file:` is the only accepted spelling. A literal here makes CI the one machine
  // that installs an unpinned Node and then fails the gate it just paid to reach — and it does
  // not have to be the setup action: any workflow can call `actions/setup-node` directly.
  assert.ok(
    CI_FILES.length > 0,
    'no workflow or action files were found at all. This check has lost its subject.',
  )
  for (const file of CI_FILES) {
    assert.doesNotMatch(
      read(file),
      /^\s*node-version:\s*\S/m,
      `${file} hard-codes a \`node-version:\`. Pass \`node-version-file: ${SOURCE}\` instead, ` +
        'so CI installs the pin rather than agreeing with it by coincidence.',
    )
  }
})

check(`the shared setup action reads ${SOURCE} by name`, () => {
  // The positive half of the check above: banning literals is satisfied by a workflow that sets
  // no Node at all, which is not the same as one that reads the pin.
  assert.match(
    read('.github/actions/setup/action.yml'),
    /node-version-file:\s*\.node-version/,
    'the shared setup action does not pass `node-version-file: .node-version` to ' +
      'actions/setup-node, so CI installs whatever Node the runner image ships.',
  )
})

check(`nothing but ${SOURCE} and its own docs spells the pinned version out`, () => {
  // The weak check, kept deliberately and named for what it is. It cannot catch a STALE
  // duplicate — that is what the shape checks above are for — but it does catch a copy made
  // today, which is how one starts. Prose may name the version; a manifest or a CI file may not.
  const pinned = read(SOURCE).trim()
  for (const file of [...MANIFESTS, ...CI_FILES]) {
    assert.doesNotMatch(
      read(file),
      new RegExp(pinned.replace(/\./g, '\\.')),
      `${file} spells out ${pinned}. ${SOURCE} is the single source; that file should read it ` +
        'rather than repeat it.',
    )
  }
})

report('node-version-source')
