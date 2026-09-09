#!/usr/bin/env node
// The Node pin, enforced. `.node-version` at the repo root is the single source, and this file is
// what refuses a Node that does not match it (#1751, #1777). It is not the file's only reader:
// `actions/setup-node` reads it in `.github/actions/setup/action.yml`, which is how CI installs
// the pin rather than agreeing with it by coincidence, and two suites read it too. Single source
// means one place it is WRITTEN.
//
// It runs at three moments. Root `preinstall`, so a wrong Node fails `bun install` rather than
// failing something subtler an hour later. Then every `apps/desktop` toolchain command, because
// Electron 44's installer is CommonJS and requires an ESM-only `@electron/get`, so on an older
// Node it dies with `ERR_REQUIRE_ESM` and nothing in that message says "your Node is too old".
// Then `bun run quality`, so a gate run is a gate run on the pinned toolchain rather than on
// whatever the shell happened to have.
//
// **`preinstall` does not run before the install, whatever its name says.** Measured on bun
// 1.3.13: a dependency's own `postinstall` fires about 40ms BEFORE the root `preinstall`, the
// lockfile is already saved, and `node_modules` is fully linked by the time this file speaks. So
// what it buys is a non-zero `bun install`, not an install that never happened — and on the wrong
// Node, `node-pty` has already been compiled against the wrong ABI. After switching Node, delete
// `node_modules` and install again; a green second install over that tree proves nothing.
// `preinstall` is still the right hook, because it is the only one bun runs at the root at all.
//
// The pin is EXACT. 24.20.1 does not pass until this repository says 24.20.1. A range would make
// the failure mode "works on my machine at a patch nobody else has", which is the thing being
// closed here rather than a strictness anybody wanted.
//
// ROOT is resolved from this file's own location, never the working directory: `preinstall` runs
// at the root but a desktop toolchain command runs in `apps/desktop`, and a gate that reads a
// different file depending on who called it is not a single source.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = '.node-version'

const die = (lines) => {
  console.error(`\n${lines.join('\n')}\n`)
  process.exit(1)
}

// Bun reports a Node-COMPATIBILITY number in `process.versions.node`, not the Node on this
// machine: bun 1.3.13 says 24.3.0 on a machine whose `node -v` is v22.10.0. So a gate Bun ran
// would answer a question nobody asked — is Bun's compatibility claim equal to the pin — and the
// answer is worthless either way. It usually refuses by accident, because the compat number is
// not the pin; but pin the repo to 24.3.0 and it would exit 0 on a machine with no Node at all.
// That is not a hypothetical shape: #1751 records the Forge commands being run by hand on Node
// 24.3.0, which is exactly bun 1.3.13's number.
if (process.versions.bun) {
  die([
    `${SOURCE} gate: this ran under Bun, and Bun's process.versions.node is a compatibility`,
    "number rather than this machine's Node. It proves nothing about the pin.",
    '',
    'Invoke it with node, from the repo root:  node scripts/node-version-gate.mjs',
  ])
}

let required
try {
  required = readFileSync(path.join(ROOT, SOURCE), 'utf8').trim()
} catch {
  // A pin whose file has gone reads as "no pin" to every tool that consumes it, and a preflight
  // that shrugs at that is the fail-open this repo keeps finding (AGENTS.md, "Quality gates").
  die([
    `${SOURCE} gate: ${path.join(ROOT, SOURCE)} is missing.`,
    '',
    "That file is the repository's Node pin, and the shared CI setup action reads it by name.",
    'Restore it rather than deleting this check.',
  ])
}

if (!/^\d+\.\d+\.\d+$/.test(required)) {
  die([
    `${SOURCE} gate: ${SOURCE} reads ${JSON.stringify(required)}, which is not an exact version.`,
    '',
    '#1751 decided the pin is exact — a newer patch does not pass until the repository updates',
    'this file. Requiring three bare numbers, with no `v` and no alias, is this gate reading',
    'that literally so there is one spelling to compare against.',
  ])
}

const detected = process.versions.node

if (detected !== required) {
  die([
    `Node ${required} is required and this is Node ${detected}.`,
    '',
    `  required   ${required}   (from ${SOURCE})`,
    `  detected   ${detected}   (${process.execPath})`,
    '',
    'The pin is exact: a newer patch does not pass until this repository updates',
    `${SOURCE}. Install the pinned version and re-run.`,
    '',
    `  nvm install ${required} && nvm use ${required}   # nvm reads .nvmrc, so name the version`,
    `  fnm install ${required} && fnm use ${required}   # fnm reads ${SOURCE}, but installs nothing`,
  ])
}
