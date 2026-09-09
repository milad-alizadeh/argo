#!/usr/bin/env node
// The typecheck gate cannot go quiet, run via `bun run test:hooks` (#1733).
//
// `quality:types` is `turbo run typecheck`, and turbo answers a task NO workspace declares with a
// yellow `WARNING  No tasks were executed as part of this run.` and **exit 0**. So the gate
// disarms itself the moment the script it calls is renamed, deleted or never written for a new
// workspace: `bun run quality` stays green, the CI step stays green, and nothing type-checks
// anything. That is the same fail-open shape as a `.jscpd.json` matching no files and a
// `biome.json` holding a comment, and the house rule is the same — no gate is proved by exit code
// alone (AGENTS.md, "Quality gates").
//
// #1733 exists because `apps/desktop` shipped a `typecheck` script with no caller. This suite
// holds the mirror image: a caller with no script.
//
// Derived from the workspaces rather than listed. A new workspace carrying TypeScript is the case
// that would otherwise arrive unguarded, so the set comes from the tree — anything holding a
// tracked `.ts` or `.tsx` file owes a `typecheck` script, and a workspace with no TypeScript in it
// owes nothing.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'))

const tracked = (pathspec) =>
  execFileSync('git', ['ls-files', '--', pathspec], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

// `workspaces` holds globs (`apps/*`), so the manifests are found rather than named.
const manifests = tracked('*/*/package.json').filter((file) => {
  const [top] = file.split('/')
  return readJson('package.json').workspaces.some((glob) => glob.split('/')[0] === top)
})

// A workspace owes a `typecheck` script when it holds TypeScript a compiler could read.
const owesTypecheck = manifests.filter((manifest) => {
  const dir = path.dirname(manifest)
  return tracked(`${dir}/**/*.ts`).concat(tracked(`${dir}/**/*.tsx`)).length > 0
})

check('the workspace scan finds something, so this suite cannot pass on an empty set', () => {
  assert.ok(manifests.length > 0, 'found no workspace manifests at all')
  assert.ok(
    owesTypecheck.length > 0,
    'found no workspace holding TypeScript — if that is true, delete this suite rather than let it pass vacuously',
  )
})

check('every workspace holding TypeScript declares a typecheck script', () => {
  const missing = owesTypecheck.filter((manifest) => !readJson(manifest).scripts?.typecheck)
  assert.deepEqual(
    missing,
    [],
    `these workspaces hold TypeScript and declare no \`typecheck\` script, so \`turbo run typecheck\` skips them and exits 0: ${missing.join(', ')}`,
  )
})

check('the typecheck task is declared in turbo.json, or the script reaches nothing', () => {
  assert.ok(
    readJson('turbo.json').tasks.typecheck,
    'turbo.json declares no `typecheck` task, so `turbo run typecheck` runs nothing',
  )
})

check('quality:types is what runs it, and bun run quality calls quality:types', () => {
  const { scripts } = readJson('package.json')
  assert.match(scripts['quality:types'] ?? '', /turbo run typecheck/)
  assert.match(scripts.quality ?? '', /quality:types/)
})

check('Linux CI runs the typecheck, not only the local quality script', () => {
  const workflow = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')
  assert.match(
    workflow,
    /run: bun run quality:types/,
    '.github/workflows/ci.yml never runs quality:types, so a type error only fails on the author machine',
  )
})

// The renderer half of the boundary this ticket gated. `noRestrictedImports` reads import
// statements, so it cannot see an ambient global: without `"types": []` the renderer inherits every
// package in the root `@types`, `node` included, and `process.env.SOME_TOKEN` type-checks clean in
// a process that must never hold one (#1763).
check('the renderer project claims no ambient type packages', () => {
  const web = readJson('apps/desktop/tsconfig.web.json')
  assert.deepEqual(
    web.compilerOptions.types,
    [],
    'apps/desktop/tsconfig.web.json must set `"types": []`, or the renderer gets @types/node ambiently and Node globals type-check there',
  )
})

// The two `webPreferences` values that make every Node reach from the renderer inert at RUNTIME.
// The import rule and the empty `types` above are both compile-time: they stop the code being
// written. These stop it working if it is. A one-word edit to `nodeIntegration: true` passes
// biome, the typecheck, duplication and every other suite in this directory, and turns the
// renderer into a process holding Node — which is the thing #1763 says must never hold a token.
// `sandbox` is deliberately not asserted: it is `false` today so the preload can run, and
// changing that is a behaviour decision rather than a gate.
check('the renderer window keeps context isolation on and node integration off', () => {
  const main = readFileSync(path.join(ROOT, 'apps/desktop/src/main.ts'), 'utf8')
  assert.match(
    main,
    /contextIsolation:\s*true/,
    'apps/desktop/src/main.ts must set contextIsolation: true',
  )
  assert.match(
    main,
    /nodeIntegration:\s*false/,
    'apps/desktop/src/main.ts must set nodeIntegration: false',
  )
  assert.doesNotMatch(
    main,
    /nodeIntegration:\s*true|contextIsolation:\s*false|nodeIntegrationInWorker:\s*true/,
    'apps/desktop/src/main.ts re-opens Node to the renderer',
  )
})

report('typecheck gate')
