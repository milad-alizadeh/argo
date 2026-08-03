#!/usr/bin/env node

/**
 * Earned-shared gate: fails when a symbol sits in the shared tier for only one module's benefit.
 *
 *   node scripts/earned-shared-check.mjs --map apps/desktop/scripts/module-boundaries.json
 *
 * `rules/file-structure.md` — "shared code is earned, not chosen" — puts a one-caller helper in its
 * caller's own folder and hoists on the third. Nothing mechanical held that line: a shared file
 * with a single caller exports through the tier's declared public entry, so the boundary gate sees
 * a legal edge and passes. Waiting for the third caller is the point, so it gets counted.
 *
 * Counting is per SYMBOL, not per file, because everything leaves the tier through a barrel: a
 * file-level graph shows every module depending on every leaf behind it and can prove nothing.
 * Named import specifiers are what actually record who wanted what.
 *
 * Caller-counting only judges the DOMAIN-AWARE half of the tier. `file-structure.md` earns the
 * generic tier by category instead — "it would stand alone as its own published package" — so a
 * vendored primitive or an icon belongs to the kit on its first caller and forever after. Those
 * paths are excluded by config, not by 60 ratchet entries.
 *
 * Config lives in the map's `placement.earnedShared` block. Exits 0 clean, 1 on a breach or on a
 * stale ratchet entry, 2 on bad usage.
 */

import { glob, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fail, moduleOf, placementBlock, readModuleMap } from './module-map.mjs'

const GATE = 'earned-shared-check'
const IMPORTS = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
const ALIASES = [
  ['@/', 'src/renderer/src/'],
  ['@renderer/', 'src/renderer/src/'],
]

const argv = process.argv.slice(2)
const mapFlag = argv.indexOf('--map')
if (mapFlag === -1 || argv[mapFlag + 1] === undefined) {
  fail(GATE, 'usage: earned-shared-check --map <module-boundaries.json>')
}

const { map, workspace } = await readModuleMap(argv[mapFlag + 1]).catch((error) =>
  fail(GATE, `cannot read the module map: ${error.message}`),
)
const config = placementBlock(map, GATE, 'earnedShared')
const modules = map.modules ?? []
const target = modules.find((module) => module.name === config.module)
if (target === undefined) fail(GATE, `no module named "${config.module}" in the map`)

const inTarget = new RegExp(target.path)
const excluded = (config.exclude ?? []).map((pattern) => new RegExp(pattern))
const minimum = config.minImportingModules ?? 2
const ratchet = config.ratchet ?? {}

/** A specifier as a workspace-relative path, or null when it points outside the workspace. */
function toWorkspacePath(specifier, fromFile) {
  for (const [alias, expansion] of ALIASES) {
    if (specifier.startsWith(alias)) return expansion + specifier.slice(alias.length)
  }
  if (!specifier.startsWith('.')) return null
  return relative(workspace, resolve(workspace, dirname(fromFile), specifier))
    .split('\\')
    .join('/')
}

/** `type Foo`, `Foo as Bar` and trailing commas all name the same one symbol: `Foo`. */
function namesIn(clause) {
  return clause
    .split(',')
    .map((entry) =>
      entry
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim(),
    )
    .filter((name) => name !== '')
}

/** symbol → the set of modules that named it in an import. */
const wanters = new Map()
for await (const relPath of glob('src/**/*.{ts,tsx}', { cwd: workspace })) {
  const posix = relPath.split('\\').join('/')
  if (/\.(test|spec|stories)\.[jt]sx?$/.test(posix)) continue
  const owner = moduleOf(posix, modules)
  // A module importing its own tier is staying home, not sharing — only outsiders count.
  if (owner === null || owner.name === target.name) continue
  const source = await readFile(resolve(workspace, posix), 'utf8')
  for (const [, clause, specifier] of source.matchAll(IMPORTS)) {
    const imported = toWorkspacePath(specifier, posix)
    if (imported === null || !inTarget.test(imported)) continue
    if (excluded.some((pattern) => pattern.test(imported))) continue
    for (const name of namesIn(clause)) {
      if (!wanters.has(name)) wanters.set(name, new Set())
      wanters.get(name).add(owner.name)
    }
  }
}

const unearned = [...wanters]
  .filter(([name, modulesWanting]) => modulesWanting.size < minimum && !(name in ratchet))
  .map(([name, modulesWanting]) => ({ name, only: [...modulesWanting].join(', ') }))
const stale = Object.keys(ratchet).filter((name) => (wanters.get(name)?.size ?? 0) >= minimum)

if (unearned.length === 0 && stale.length === 0) process.exit(0)

if (unearned.length > 0) {
  console.error(
    `${GATE}: ${unearned.length} shared symbol(s) wanted by fewer than ${minimum} modules\n`,
  )
  for (const { name, only } of unearned.sort((a, b) => a.name.localeCompare(b.name))) {
    console.error(`  ${name.padEnd(28)} only ${only}`)
  }
  console.error(
    '\nMove each into the one module that wants it; hoist it back when a second module genuinely' +
      '\nwants it too. Deliberate exceptions go in `placement.earnedShared.ratchet`.',
  )
}

if (stale.length > 0) {
  console.error(`\n${GATE}: ${stale.length} ratchet entry(ies) now earned — delete them:\n`)
  for (const name of stale.sort()) console.error(`  ${name}`)
}

process.exit(1)
